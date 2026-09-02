import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { connect, type NatsConnection, type Subscription } from "nats";
import { WebSocketServer, WebSocket } from "ws";

const decoder = new TextDecoder();

type ClientMsg =
  | { type: "connect"; host: string; port: number; user?: string; pass?: string; token?: string }
  | { type: "disconnect" };

type Session = {
  nc: NatsConnection | null;
  sub: Subscription | null;
  closing: boolean;
  demoTimer?: ReturnType<typeof setInterval>;
};

export type StartServerOptions = {
  port?: number;
  host?: string;
  distDir?: string;
};

export type RunningServer = {
  port: number;
  close: () => Promise<void>;
};

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function parsePayload(data: Uint8Array): unknown {
  if (data.byteLength === 0) return null;
  let text: string;
  try {
    text = decoder.decode(data);
  } catch {
    return `<binary ${data.byteLength} bytes>`;
  }
  try {
    return JSON.parse(text);
  } catch {
    const asNum = Number(text);
    if (text.trim() !== "" && Number.isFinite(asNum)) return asNum;
    return text;
  }
}

async function closeSession(session: Session) {
  session.closing = true;
  if (session.demoTimer) {
    clearInterval(session.demoTimer);
    session.demoTimer = undefined;
  }
  try {
    session.sub?.unsubscribe();
  } catch {
    /* ignore */
  }
  session.sub = null;
  if (session.nc) {
    try {
      await session.nc.close();
    } catch {
      try {
        session.nc.drain();
      } catch {
        /* ignore */
      }
    }
    session.nc = null;
  }
}

function emit(ws: WebSocket, subject: string, payload: unknown) {
  const encoded = JSON.stringify(payload);
  send(ws, {
    type: "message",
    subject,
    payload,
    timestamp: Date.now(),
    size: encoded.length,
  });
}

function startDemo(ws: WebSocket, session: Session) {
  let t = 0;
  session.demoTimer = setInterval(() => {
    t += 1;
    emit(ws, "vehicle.engine.rpm", Math.round(800 + (Math.sin(t / 8) + 1) * 2500));
    emit(ws, "vehicle.engine.temp", Number((82 + Math.sin(t / 15) * 6).toFixed(2)));
    emit(ws, "vehicle.speed", Math.max(0, Math.round(40 + Math.sin(t / 12) * 35)));
    emit(ws, "vehicle.gear", 1 + (Math.floor(t / 10) % 6));
    emit(ws, "vehicle.doors", { fl: t % 20 > 2, fr: true, rl: true, rr: t % 33 > 4 });
    emit(ws, "vehicle.gps", {
      lat: Number((52.48 + Math.sin(t / 40) * 0.01).toFixed(6)),
      lon: Number((-1.89 + Math.cos(t / 40) * 0.01).toFixed(6)),
    });
    emit(ws, "cluster.status", t % 17 === 0 ? "degraded" : "ok");
  }, 280);
}

function attachBridge(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    const session: Session = { nc: null, sub: null, closing: false };

    ws.on("message", async (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw)) as ClientMsg;
      } catch {
        send(ws, { type: "status", connected: false, error: "Invalid control message" });
        return;
      }

      if (msg.type === "disconnect") {
        await closeSession(session);
        send(ws, { type: "status", connected: false });
        return;
      }

      if (msg.type !== "connect") return;

      await closeSession(session);
      session.closing = false;

      const host = (msg.host || "").trim() || "127.0.0.1";
      const port = Number(msg.port) || 4222;

      if (host.toLowerCase() === "demo") {
        send(ws, { type: "status", connected: true, server: "demo" });
        startDemo(ws, session);
        return;
      }

      const servers = `${host}:${port}`;
      send(ws, { type: "status", connected: false, connecting: true, server: servers });

      try {
        const nc = await connect({
          servers,
          user: msg.user || undefined,
          pass: msg.pass || undefined,
          token: msg.token || undefined,
          timeout: 5000,
          maxReconnectAttempts: -1,
          reconnectTimeWait: 2000,
          pingInterval: 20000,
        });
        session.nc = nc;

        nc.closed().then((err) => {
          if (session.closing) return;
          send(ws, {
            type: "status",
            connected: false,
            error: err ? err.message : "NATS connection closed",
          });
        });

        const sub = nc.subscribe(">");
        session.sub = sub;
        send(ws, { type: "status", connected: true, server: servers });

        void (async () => {
          for await (const m of sub) {
            send(ws, {
              type: "message",
              subject: m.subject,
              payload: parsePayload(m.data),
              timestamp: Date.now(),
              size: m.data.byteLength,
            });
          }
        })();
      } catch (err) {
        session.nc = null;
        send(ws, {
          type: "status",
          connected: false,
          error: err instanceof Error ? err.message : "Failed to connect",
        });
      }
    });

    ws.on("close", () => {
      void closeSession(session);
    });
  });
  return wss;
}

export function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const port = options.port ?? Number(process.env.PORT ?? 3847);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const distDir =
    options.distDir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist");

  const app = express();
  app.use(express.static(distDir));
  app.get("/{*path}", (req, res, next) => {
    if (req.path === "/ws") return next();
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next();
    });
  });

  const server = http.createServer(app);
  const wss = attachBridge(server);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        port: actualPort,
        close: async () => {
          for (const client of wss.clients) client.close();
          wss.close();
          await new Promise<void>((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          });
        },
      });
    });
  });
}
