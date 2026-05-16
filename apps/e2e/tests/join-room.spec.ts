import { expect, test } from "../fixtures";

test.describe("join room", () => {
  test("alice and bob both appear in participant list after joining", async ({
    alice,
    bob,
    roomId,
  }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    // Alice sees herself (she joined first — server echoes RoomState back)
    await alice.waitForParticipantByName("Alice");

    // Bob sees himself
    await bob.waitForParticipantByName("Bob");

    // Both browsers see each other via broadcast
    await alice.waitForParticipantByName("Bob");
    await bob.waitForParticipantByName("Alice");
  });

  test("connection status shows Connected on load", async ({ alice }) => {
    await alice.goto();
    await expect(alice.connectionStatus).toHaveText("Connected");
  });
});
