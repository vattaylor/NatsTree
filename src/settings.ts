const KEY = "natstree.nats";

export type SavedServer = {
  host: string;
  port: string;
  user: string;
};

const DEFAULT_SERVER: SavedServer = {
  host: "127.0.0.1",
  port: "4222",
  user: "",
};

export function loadServer(): SavedServer {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SERVER };
    const parsed = JSON.parse(raw) as Partial<SavedServer>;
    return {
      host: typeof parsed.host === "string" && parsed.host.trim() ? parsed.host : DEFAULT_SERVER.host,
      port: typeof parsed.port === "string" && parsed.port.trim() ? parsed.port : DEFAULT_SERVER.port,
      user: typeof parsed.user === "string" ? parsed.user : "",
    };
  } catch {
    return { ...DEFAULT_SERVER };
  }
}

export function saveServer(server: SavedServer) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        host: server.host.trim() || DEFAULT_SERVER.host,
        port: server.port.trim() || DEFAULT_SERVER.port,
        user: server.user.trim(),
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
