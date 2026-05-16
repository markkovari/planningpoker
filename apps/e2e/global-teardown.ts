import { execSync } from "child_process";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../..");

export default async function globalTeardown() {
  // Brief wait so the last test's WS/NATS publishes can finish before NATS shuts down.
  await new Promise((r) => setTimeout(r, 2000));
  console.log("[e2e] stopping NATS …");
  execSync("docker compose -f docker-compose.e2e.yml down --volumes --remove-orphans", {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });
  console.log("[e2e] NATS stopped");
}
