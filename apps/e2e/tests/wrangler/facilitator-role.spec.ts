import { WebSocket as NodeWS } from "ws";
import { expect, test } from "../../fixtures/wrangler";

const WS_URL = "ws://localhost:8787/ws";

/** Send a message as a fresh non-facilitator raw WS client and return the first Error response. */
async function expectServerError(roomId: string, msg: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new NodeWS(`${WS_URL}?room=${roomId}`);
    const pid = crypto.randomUUID();
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "JoinRoom", room_id: roomId, participant_id: pid, display_name: "Intruder" }));
      setTimeout(() => ws.send(JSON.stringify(msg)), 300);
    });
    ws.on("message", (data: Buffer) => {
      const parsed = JSON.parse(data.toString()) as { type: string; message?: string };
      if (parsed.type === "Error") { ws.close(); resolve(parsed.message ?? ""); }
    });
    ws.on("error", reject);
    setTimeout(() => { ws.close(); reject(new Error("timeout")); }, 6000);
  });
}

test.describe("facilitator role enforcement", () => {
  test("creator gets Facilitator role, joiner gets Voter role", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Facilitator Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();
    await alice.waitForParticipantByName("Bob");

    const aliceRow = alice.participantList.locator("li").filter({ hasText: "Alice" });
    await expect(aliceRow.getByTestId("facilitator-badge")).toBeVisible();

    const bobRow = alice.participantList.locator("li").filter({ hasText: "Bob" });
    await expect(bobRow.getByTestId("facilitator-badge")).not.toBeVisible();
  });

  test("only facilitator sees enabled Start Session button", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Auth Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();
    await alice.waitForParticipantByName("Bob");

    await expect(alice.startSessionBtn).toBeEnabled();
    await expect(bob.startSessionBtn).toBeDisabled();
  });

  test("non-facilitator StartSession rejected by server", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("API Auth Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    const error = await expectServerError(roomId, { type: "StartSession", room_id: roomId });
    expect(error).toContain("facilitator");
  });

  test("non-facilitator RevealVotes rejected by server", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Reveal API Auth");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });
    const sessionId = await alice.page.evaluate(() => {
      const data = (window as unknown as { __room?: { active_session?: { id: string } } }).__room;
      return data?.active_session?.id ?? "";
    });

    const error = await expectServerError(roomId, { type: "RevealVotes", room_id: roomId, session_id: sessionId });
    expect(error).toContain("facilitator");
  });

  test("non-facilitator ResetSession rejected by server", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Reset API Auth");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });

    const error = await expectServerError(roomId, { type: "ResetSession", room_id: roomId, session_id: "any" });
    expect(error).toContain("facilitator");
  });

  test("only facilitator can reveal votes", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Reveal Auth Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();
    await alice.waitForParticipantByName("Bob");

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });
    await bob.page.getByTestId("card-picker").waitFor({ state: "visible" });

    await expect(alice.revealBtn).toBeEnabled();
    await expect(bob.revealBtn).toBeDisabled();
  });

  test("only facilitator can reset session", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Reset Auth Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();
    await alice.waitForParticipantByName("Bob");

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });
    await bob.page.getByTestId("card-picker").waitFor({ state: "visible" });

    await expect(alice.resetBtn).toBeEnabled();
    await expect(bob.resetBtn).toBeDisabled();
  });

  test("facilitator reloads page and regains Facilitator role", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Reload Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await expect(alice.startSessionBtn).toBeEnabled();

    // Reload — URL retains ?room= param, localStorage retains participant ID
    await alice.page.reload();
    await alice.waitForConnected();

    // Re-join with same room ID (pre-filled from URL) and same name
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    // Must still be Facilitator — Start button enabled
    await expect(alice.startSessionBtn).toBeEnabled();

    const aliceRow = alice.participantList.locator("li").filter({ hasText: "Alice" });
    await expect(aliceRow.getByTestId("facilitator-badge")).toBeVisible();
  });

  test("facilitator starts session, both users can vote", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Happy Path");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();
    await alice.waitForParticipantByName("Bob");

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });
    await bob.page.getByTestId("card-picker").waitFor({ state: "visible" });

    await alice.selectCard("5");
    await bob.selectCard("8");

    await alice.waitForVoteCheckmark("Alice");
    await alice.waitForVoteCheckmark("Bob");

    await alice.revealBtn.click();
    await alice.waitForRevealedCard("Alice", "5");
    await alice.waitForRevealedCard("Bob", "8");
  });
});
