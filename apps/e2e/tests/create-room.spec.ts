import { expect, test } from "../fixtures";

test.describe("create room", () => {
  test("user creates room via UI and joins it", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();

    const roomId = await alice.createRoom("My Poker Room");

    // Room ID is a valid UUID
    expect(roomId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();
    await alice.waitForParticipantByName("Alice");
  });

  test("two users join a UI-created room and see each other", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();

    const roomId = await alice.createRoom("Shared Room");

    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await alice.waitForParticipantByName("Bob");
    await bob.waitForParticipantByName("Alice");
  });
});
