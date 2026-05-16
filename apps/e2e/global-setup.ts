import { execSync } from "child_process";
import path from "path";
import { waitForNats } from "./helpers/wait-for-nats";

const REPO_ROOT = path.resolve(__dirname, "../..");

export default async function globalSetup() {
  console.log("[e2e] starting NATS via docker-compose.e2e.yml …");
  execSync("docker compose -f docker-compose.e2e.yml up -d --wait", {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });

  console.log("[e2e] waiting for NATS monitoring endpoint …");
  await waitForNats("http://localhost:8222/healthz", 30_000);
  console.log("[e2e] NATS ready");
}
