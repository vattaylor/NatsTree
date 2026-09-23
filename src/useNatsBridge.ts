import { useCallback, useEffect, useRef, useState } from "react";
import { connect as connectNatsWs, type NatsConnection, type Subscription } from "nats.ws";
import { startDemoFeed } from "./demoFeed";
import { natsWebsocketServers, parseNatsPayload } from "./natsPayload";
import type { NatsMessage, ServerStatus } from "./types";

type ClientConnect = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  token?: string;
};

function useDirectTransport() {
  return (
    import.meta.env.VITE_STATIC === "true" ||
    (typeof location !== "undefined" && /\.github\.io$/i.test(location.hostname))
  );
}

function bridgeUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return import.meta.env.DEV ? "ws://127.0.0.1:3847/ws" : `${proto}://${location.host}${base}/ws`;
}

export function useNatsBridge(onMessage: (msg: NatsMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const natsRef = useRef<NatsConnection | null>(null);
  const subRef = useRef<Subscription | null>(null);
  const demoStop = useRef<(() => void) | undefined>(undefined);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const directRef = useRef(useDirectTransport());

  const [status, setStatus] = useState<ServerStatus>({ connected: false });
  const [socketReady, setSocketReady] = useState(directRef.current);
  const [direct, setDirect] = useState(directRef.current);

  useEffect(() => {
    if (directRef.current) return;

    const url = bridgeUrl();
    let current: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;
    let attempts = 0;

    const open = () => {
      if (closed) return;
      const ws = new WebSocket(url);
      current = ws;
      wsRef.current = ws;
      ws.onopen = () => {
        if (wsRef.current === ws) {
          attempts = 0;
          setSocketReady(true);
        }
      };
      ws.onmessage = (ev) => {
        if (wsRef.current !== ws) return;
        try {
          const data = JSON.parse(String(ev.data));
          if (data.type === "status") {
            setStatus({
              connected: Boolean(data.connected),
              connecting: Boolean(data.connecting),
              error: data.error,
              server: data.server,
            });
          } else if (data.type === "message") {
            onMessageRef.current(data as NatsMessage);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          setSocketReady(false);
          wsRef.current = null;
        }
        if (closed) return;
        attempts += 1;
        if (!import.meta.env.DEV && attempts >= 2) {
          directRef.current = true;
          setDirect(true);
          setSocketReady(true);
          return;
        }
        retry = window.setTimeout(open, 1500);
      };
    };

    open();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      current?.close();
    };
  }, []);

  const stopDirect = useCallback(async () => {
    demoStop.current?.();
    demoStop.current = undefined;
    try {
      subRef.current?.unsubscribe();
    } catch {
      /* ignore */
    }
    subRef.current = null;
    if (natsRef.current) {
      try {
        await natsRef.current.close();
      } catch {
        /* ignore */
      }
      natsRef.current = null;
    }
  }, []);

  const connect = useCallback(
    async (opts: ClientConnect) => {
      setStatus({ connected: false, connecting: true, error: undefined });
      const host = opts.host.trim() || "127.0.0.1";

      if (host.toLowerCase() === "demo") {
        await stopDirect();
        if (!directRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "connect", ...opts, host }));
          return;
        }
        demoStop.current = startDemoFeed((subject, payload) => {
          const encoded = JSON.stringify(payload);
          onMessageRef.current({
            type: "message",
            subject,
            payload,
            timestamp: Date.now(),
            size: encoded.length,
          });
        });
        setStatus({ connected: true, connecting: false, server: "demo" });
        return;
      }

      if (!directRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "connect", ...opts, host }));
        return;
      }

      await stopDirect();
      const servers = natsWebsocketServers(host, opts.port);
      try {
        const nc = await connectNatsWs({
          servers,
          user: opts.user || undefined,
          pass: opts.pass || undefined,
          token: opts.token || undefined,
          timeout: 5000,
          maxReconnectAttempts: -1,
          reconnectTimeWait: 2000,
          pingInterval: 20000,
        });
        natsRef.current = nc;
        const sub = nc.subscribe(">");
        subRef.current = sub;
        setStatus({ connected: true, connecting: false, server: servers[0] });
        void (async () => {
          for await (const m of sub) {
            if (natsRef.current !== nc) break;
            onMessageRef.current({
              type: "message",
              subject: m.subject,
              payload: parseNatsPayload(m.data),
              timestamp: Date.now(),
              size: m.data.length,
            });
          }
        })();
        void nc.closed().then((err) => {
          if (natsRef.current !== nc) return;
          natsRef.current = null;
          setStatus({
            connected: false,
            connecting: false,
            error: err ? String(err) : "Disconnected",
          });
        });
      } catch (err) {
        setStatus({
          connected: false,
          connecting: false,
          error:
            err instanceof Error
              ? err.message
              : "Could not reach a NATS WebSocket. Use the server WebSocket port (often 9222 or 8443).",
        });
      }
    },
    [stopDirect],
  );

  const disconnect = useCallback(() => {
    if (!directRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "disconnect" }));
      setStatus((s) => ({ ...s, connected: false, connecting: false, error: undefined }));
      return;
    }
    void stopDirect();
    setStatus({ connected: false, connecting: false });
  }, [stopDirect]);

  return { status, socketReady, connect, disconnect, direct };
}
