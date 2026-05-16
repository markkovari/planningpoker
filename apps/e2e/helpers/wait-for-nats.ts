export async function waitForNats(
  url = "http://localhost:8222/healthz",
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise<void>((r) => setTimeout(r, 500));
  }
  throw new Error(`NATS not healthy at ${url} after ${timeoutMs}ms`);
}
