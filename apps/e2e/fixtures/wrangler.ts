import { test as base } from "@playwright/test";
import { RoomPage } from "../pages/RoomPage";

type WranglerFixtures = {
  alice: RoomPage;
  bob: RoomPage;
};

export const test = base.extend<WranglerFixtures>({
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
