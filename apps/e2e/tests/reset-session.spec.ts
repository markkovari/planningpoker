import { expect, test } from "../fixtures";

test.describe("reset session", () => {
  test("alice resets; votes clear in both browsers", async ({ alice, bob, roomId }) => {
    // Setup: both join, session, vote, reveal
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

    await bob.cardPicker.waitFor({ state: "visible" });
    await bob.selectCard("3");
    await bob.waitForVoteCheckmark("Bob");

    await alice.revealBtn.waitFor({ state: "visible" });
    await alice.revealBtn.click();
    await alice.waitForRevealedCard("Bob", "3");

    // Alice resets
    await alice.resetBtn.click();

    // Both browsers show votes cleared (— column) and no vote reveal section
    await alice.waitForVotesCleared();
    await bob.waitForVotesCleared();

    await expect(alice.voteReveal).not.toBeVisible();
    await expect(bob.voteReveal).not.toBeVisible();

    // Start Session button re-appears
    await expect(alice.startSessionBtn).toBeVisible();
  });
});
