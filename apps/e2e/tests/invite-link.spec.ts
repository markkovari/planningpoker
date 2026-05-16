import { expect, test } from "../fixtures";

test.describe("invite link", () => {
  test("?room= param pre-fills room id on load", async ({ alice, bob, roomId }) => {
    // Alice joins first to establish the room
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    // Bob opens the invite URL directly — room ID should be pre-filled
    await bob.page.goto(`/?room=${roomId}`);
    await bob.waitForConnected();

    // Room ID field should already contain the room ID
    await expect(bob.roomIdInput).toHaveValue(roomId);

    // Bob only needs to enter their name and join
    await bob.nameInput.fill("Bob");
    await bob.nameInput.press("Enter");
    await bob.waitForRoomView();

    await alice.waitForParticipantByName("Bob");
  });

  test("invite button in room header copies link with ?room= param", async ({ alice, roomId, browserName }) => {
    test.skip(browserName === "firefox", "Firefox clipboard API not available in test context");
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    // Grant clipboard permissions
    await alice.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    const inviteBtn = alice.page.getByTestId("invite-btn");
    await inviteBtn.waitFor({ state: "visible" });
    await inviteBtn.click();

    // Button briefly shows "Copied!" state
    await expect(inviteBtn).toContainText(/copied/i);

    // Read clipboard and verify it contains the room ID
    const clipText = await alice.page.evaluate(() => navigator.clipboard.readText());
    expect(clipText).toContain(`room=${roomId}`);
  });

  test("copy invite btn appears after room creation and encodes room id", async ({ alice, browserName }) => {
    test.skip(browserName === "firefox", "Firefox clipboard API not available in test context");
    await alice.goto();
    await alice.waitForConnected();

    const roomId = await alice.createRoom("Shareable Room");

    // The copy invite button should be visible
    const copyBtn = alice.page.getByTestId("copy-invite-btn");
    await copyBtn.waitFor({ state: "visible" });

    await alice.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await copyBtn.click();

    const clipText = await alice.page.evaluate(() => navigator.clipboard.readText());
    expect(clipText).toContain(`room=${roomId}`);
    expect(clipText).toMatch(/^https?:\/\//);
  });
});
