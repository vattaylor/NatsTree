const decoder = new TextDecoder();

export function parseNatsPayload(data: Uint8Array): unknown {
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

export function natsWebsocketServers(host: string, port: number): string[] {
  const urls: string[] = [];
  const add = (p: number, forceSecure?: boolean) => {
    const secure =
      forceSecure ||
      location.protocol === "https:" ||
      p === 443 ||
      p === 8443;
    const url = `${secure ? "wss" : "ws"}://${host}:${p}`;
    if (!urls.includes(url)) urls.push(url);
  };
  add(port);
  if (port === 4222) add(9222);
  return urls;
}
