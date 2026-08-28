import { startServer } from "./bridge";

const { port } = await startServer();
console.log(`NatsTree server on http://127.0.0.1:${port}`);
