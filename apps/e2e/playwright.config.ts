import { defineConfig, devices } from "@playwright/test";

// Pick a stable-per-run free port: use env if set, else derive from PID to avoid collisions
const GATEWAY_PORT = process.env.GATEWAY_PORT
  ? parseInt(process.env.GATEWAY_PORT, 10)
  : 18000 + (process.pid % 1000);
const GATEWAY_URL = `http://localhost:${GATEWAY_PORT}`;
const FRONTEND_URL = "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 60_000,
  // workers=1: tests share one gateway instance; isolation via unique room_id per test
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Firefox first — avoids accumulated NATS consumers from Chromium slowing it down
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // Start NATS first so gateway can connect on boot.
      command: "docker compose -f ../../docker-compose.e2e.yml up --wait && sleep 86400",
      url: "http://localhost:8222/healthz",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @planning-poker/web dev --port 5173",
      url: FRONTEND_URL,
      env: { GATEWAY_PORT: String(GATEWAY_PORT) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "../../target/release/pp-gateway",
      url: `${GATEWAY_URL}/health`,
      env: {
        NATS_URL: "nats://localhost:4222",
        RUST_LOG: "warn",
        PORT: String(GATEWAY_PORT),
      },
      reuseExistingServer: false,
      timeout: 15_000,
    },
  ],

  globalTeardown: "./global-teardown.ts",
});
