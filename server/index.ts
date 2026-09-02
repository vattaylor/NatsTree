import { startServer } from "./bridge";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3847);
const running = await startServer({ host, port });
const shown = host === "0.0.0.0" ? "127.0.0.1" : host;
console.log(`NatsTree server on http://${shown}:${running.port}`);
