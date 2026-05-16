import { expect, test } from "../fixtures";

test.describe("vote reveal actions", () => {
  test("'Vote on new ticket' starts a new session after reveal", async ({ alice, bob, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await alice.startSessionBtn.waitFor({ state: "visible" });
    await alice.startSessionBtn.click();

    await alice.selectCard("5");
    await bob.selectCard("5");

    await alice.revealBtn.waitFor({ state: "visible" });
    await alice.revealBtn.click();
    await alice.waitForVoteReveal();

    // "Vote on new ticket" button is visible in reveal panel
    const startNewBtn = alice.page.getByTestId("start-new-btn");
    await startNewBtn.waitFor({ state: "visible" });
    await startNewBtn.click();

    // New session starts — card picker reappears, reveal is gone
    await alice.cardPicker.waitFor({ state: "visible" });
    await expect(alice.voteReveal).not.toBeVisible();
    await expect(alice.cardPicker).toBeVisible();
  });

  test("'Re-vote this ticket' resets and shows card picker again", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.waitFor({ state: "visible" });
    await alice.startSessionBtn.click();

    await alice.selectCard("8");

    await alice.revealBtn.waitFor({ state: "visible" });
    await alice.revealBtn.click();
    await alice.waitForVoteReveal();

    const reVoteBtn = alice.page.getByTestId("reset-from-reveal-btn");
    await reVoteBtn.waitFor({ state: "visible" });
    await reVoteBtn.click();

    // Session reset — reveal gone, start-session-btn reappears
    await expect(alice.voteReveal).not.toBeVisible();
    await alice.startSessionBtn.waitFor({ state: "visible" });
  });

  test("consensus badge shown when all numeric votes match", async ({ alice, bob, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await alice.startSessionBtn.waitFor({ state: "visible" });
    await alice.startSessionBtn.click();

    await alice.selectCard("5");
    await bob.selectCard("5");

    await alice.revealBtn.waitFor({ state: "visible" });
    await alice.revealBtn.click();
    await alice.waitForVoteReveal();

    await expect(alice.voteReveal).toContainText("Consensus");
  });

  test("min/avg/max stats shown for numeric votes", async ({ alice, bob, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await alice.startSessionBtn.waitFor({ state: "visible" });
    await alice.startSessionBtn.click();

    await alice.selectCard("3");
    await bob.selectCard("8");

    await alice.revealBtn.waitFor({ state: "visible" });
    await alice.revealBtn.click();
    await alice.waitForVoteReveal();

    await expect(alice.voteReveal).toContainText("Min");
    await expect(alice.voteReveal).toContainText("Avg");
    await expect(alice.voteReveal).toContainText("Max");
    await expect(alice.voteReveal).toContainText("3");
    await expect(alice.voteReveal).toContainText("8");
  });
});
