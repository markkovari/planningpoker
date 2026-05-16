import { test as base } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { RoomPage } from "../pages/RoomPage";

const CLI_BIN = path.resolve(__dirname, "../../../target/release/pp");
const NATS_URL = "nats://localhost:4222";

type E2EFixtures = {
  roomId: string;
  alice: RoomPage;
  bob: RoomPage;
};

export const test = base.extend<E2EFixtures>({
  roomId: async ({}, use) => {
    const out = execSync(
      `${CLI_BIN} --nats-url ${NATS_URL} room-create --name "E2E Room"`,
    ).toString();
    const match = out.match(/created room ([0-9a-f-]{36})/);
    if (!match) throw new Error(`pp-cli did not return a room_id. Output: ${out}`);
    await use(match[1]);
  },

  alice: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await use(new RoomPage(page));
    await ctx.close();
  },

  bob: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await use(new RoomPage(page));
    await ctx.close();
  },
});

export { expect } from "@playwright/test";
