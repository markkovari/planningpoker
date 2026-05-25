import { WebSocket } from "ws";

const WORKER_WS = "ws://127.0.0.1:8787/ws";

/**
 * Warm up workerd + D1 before any test runs.
 * Playwright starts webServers before globalSetup. By the time this runs,
 * wrangler is up but workerd may not have compiled the DO isolate or
 * initialised D1 (lazy first-access). We create a real room, wait for the
 * RoomCreated response, then tear down — this forces full DO+D1 init so the
 * first real test never pays the cold-start penalty.
 */
export default async function globalSetup() {
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(`${WORKER_WS}?room=__warmup__`);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve();
    };
    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "CreateRoom",
        name: "__warmup__",
        creator_id: "warmup-probe",
      }));
    });
    ws.on("message", () => finish());
    ws.on("error", () => setTimeout(resolve, 2000));
    setTimeout(finish, 8000);
  });
}
