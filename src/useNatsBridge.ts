import { useCallback, useEffect, useRef, useState } from "react";
import type { NatsMessage, ServerStatus } from "./types";

type ClientConnect = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  token?: string;
};

export function useNatsBridge(onMessage: (msg: NatsMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [status, setStatus] = useState<ServerStatus>({ connected: false });
  const [socketReady, setSocketReady] = useState(false);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = import.meta.env.DEV ? "ws://127.0.0.1:3847/ws" : `${proto}://${location.host}/ws`;
    let current: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;

    const open = () => {
      if (closed) return;
      const ws = new WebSocket(url);
      current = ws;
      wsRef.current = ws;
      ws.onopen = () => {
        if (wsRef.current === ws) setSocketReady(true);
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
        if (!closed) retry = window.setTimeout(open, 1500);
      };
    };

    open();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      current?.close();
    };
  }, []);

  const connect = useCallback((opts: ClientConnect) => {
    setStatus({ connected: false, connecting: true, error: undefined });
    wsRef.current?.send(JSON.stringify({ type: "connect", ...opts }));
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "disconnect" }));
    setStatus((s) => ({ ...s, connected: false, connecting: false }));
  }, []);

  return { status, socketReady, connect, disconnect };
}
