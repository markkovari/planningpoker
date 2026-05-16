import { expect, test } from "../fixtures";

test.describe("reveal votes", () => {
  test("alice reveals; bob card '5' visible in both browsers + results histogram", async ({
    alice,
    bob,
    roomId,
  }) => {
    // Setup: both join, session started, bob votes
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
    await bob.selectCard("5");
    await bob.waitForVoteCheckmark("Bob");

    // Alice also votes to have a result
    await alice.selectCard("8");
    await alice.waitForVoteCheckmark("Alice");

    // Alice reveals
    await alice.revealBtn.waitFor({ state: "visible" });
    await alice.revealBtn.click();

    // Both see revealed cards in participant list
    await alice.waitForRevealedCard("Bob", "5");
    await bob.waitForRevealedCard("Bob", "5");
    await alice.waitForRevealedCard("Alice", "8");
    await bob.waitForRevealedCard("Alice", "8");

    // VoteReveal results section appears in both browsers
    await alice.waitForVoteReveal();
    await bob.waitForVoteReveal();

    await expect(alice.voteReveal).toContainText("5");
    await expect(alice.voteReveal).toContainText("8");
  });
});
