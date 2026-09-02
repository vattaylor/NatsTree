export type DemoEmit = (subject: string, payload: unknown) => void;

export function startDemoFeed(emit: DemoEmit, intervalMs = 280): () => void {
  let t = 0;
  const id = setInterval(() => {
    t += 1;
    emit("vehicle.engine.rpm", Math.round(800 + (Math.sin(t / 8) + 1) * 2500));
    emit("vehicle.engine.temp", Number((82 + Math.sin(t / 15) * 6).toFixed(2)));
    emit("vehicle.speed", Math.max(0, Math.round(40 + Math.sin(t / 12) * 35)));
    emit("vehicle.gear", 1 + (Math.floor(t / 10) % 6));
    emit("vehicle.doors", { fl: t % 20 > 2, fr: true, rl: true, rr: t % 33 > 4 });
    emit("vehicle.gps", {
      lat: Number((52.48 + Math.sin(t / 40) * 0.01).toFixed(6)),
      lon: Number((-1.89 + Math.cos(t / 40) * 0.01).toFixed(6)),
    });
    emit("cluster.status", t % 17 === 0 ? "degraded" : "ok");
  }, intervalMs);
  return () => clearInterval(id);
}
