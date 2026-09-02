# Docker

Run NatsTree as a web service on port **8888**.

From the repository root:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Then open [http://localhost:8888](http://localhost:8888).

Connect the UI to a NATS server. If NATS is on the Docker host, use **Server** `host.docker.internal` and port `4222`. For a demo without NATS, set **Server** to `demo`.
