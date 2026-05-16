import { expect, test } from "../fixtures";

test.describe("vote hidden before reveal", () => {
  test("bob casts vote; both browsers see ✓ but not the card value", async ({
    alice,
    bob,
    roomId,
  }) => {
    // Setup: both join
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    // Alice starts the session
    await alice.startSessionBtn.waitFor({ state: "visible" });
    await alice.startSessionBtn.click();

    // Card picker should appear for both
    await alice.cardPicker.waitFor({ state: "visible" });
    await bob.cardPicker.waitFor({ state: "visible" });

    // Bob votes "5"
    await bob.selectCard("5");

    // Bob sees his own ✓ immediately
    await bob.waitForVoteCheckmark("Bob");

    // Alice sees Bob's ✓ via broadcast (card value must NOT be "5" yet)
    await alice.waitForVoteCheckmark("Bob");
    await expect(alice.participantList).not.toContainText("5");
  });
});
