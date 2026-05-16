import { defineConfig, devices } from "@playwright/test";

const GATEWAY_URL = "http://localhost:8080";
const FRONTEND_URL = "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
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
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "../../target/release/pp-gateway",
      url: `${GATEWAY_URL}/health`,
      env: {
        NATS_URL: "nats://localhost:4222",
        RUST_LOG: "warn",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],

  globalTeardown: "./global-teardown.ts",
});
