import { defineConfig, devices } from "@playwright/test";

const WORKER_PORT = 8787;
const WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`;
const FRONTEND_URL = "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests/wrangler",
  globalSetup: "./global-setup.wrangler.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: 90_000,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report-wrangler", open: "never" }],
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
      // wrangler dev must be started from the worker directory
      command: "cd ../../crates/pp-worker && wrangler dev --port 8787",
      url: WORKER_URL,
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: `pnpm --filter @planning-poker/web dev --port 5173 --host 127.0.0.1`,
      url: FRONTEND_URL,
      env: { GATEWAY_PORT: String(WORKER_PORT) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
