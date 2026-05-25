import { WebSocket as NodeWS } from "ws";
import { expect, test } from "../../fixtures/wrangler";

const WS_URL = "ws://localhost:8787/ws";

test.describe("session creation and ticket flow", () => {
  test("facilitator creates room and adds tickets to queue", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Ticket Queue Room");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.addTicket("PROJ-1", "First story");
    await alice.addTicket("PROJ-2", "Second story");
    await alice.addTicket("PROJ-3", "Third story");

    await alice.waitForTicketInQueue("PROJ-1");
    await alice.waitForTicketInQueue("PROJ-2");
    await alice.waitForTicketInQueue("PROJ-3");
  });

  test("facilitator starts session with no tickets", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("No Tickets Room");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();

    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });
    await alice.page.getByTestId("session-header").waitFor({ state: "visible" });
  });

  test("session state visible to participant who joins after session starts", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Late Join Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await bob.page.getByTestId("session-header").waitFor({ state: "visible" });
    await bob.page.getByTestId("card-picker").waitFor({ state: "visible" });
  });

  test("tickets dequeue into session when facilitator starts session", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Queue Dequeue Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.addTicket("Story A");
    await alice.waitForTicketInQueue("Story A");

    await alice.startSessionBtn.click();
    await alice.waitForSessionTicket("Story A");
  });

  test("second session starts after first completes", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Multi Session");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });
    await alice.selectCard("3");
    await alice.waitForVoteCheckmark("Alice");
    await alice.revealBtn.click();
    await alice.waitForVoteReveal();

    const startNewBtn = alice.page.getByTestId("start-new-btn");
    await expect(startNewBtn).toBeEnabled();
    await startNewBtn.click();

    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });
  });

  test("two users see ticket queue updates in real time", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Queue Sync Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();
    await alice.waitForParticipantByName("Bob");

    await alice.addTicket("Shared Ticket");
    await alice.waitForTicketInQueue("Shared Ticket");
    await bob.waitForTicketInQueue("Shared Ticket");
  });

  test("votes are hidden before reveal — shows voted checkmark not card value", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Vote Hidden Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.gotoRoom(roomId);
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();
    await alice.waitForParticipantByName("Bob");

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });

    await alice.selectCard("5");
    await bob.selectCard("8");

    await alice.waitForVoteCheckmark("Alice");
    await alice.waitForVoteCheckmark("Bob");

    // Bob sees Alice's checkmark but NOT her card value
    const aliceRow = bob.participantList.locator("li").filter({ hasText: "Alice" });
    await expect(aliceRow.getByText("voted ✓")).toBeVisible();
    await expect(aliceRow.getByText("5", { exact: true })).not.toBeVisible();
  });

  test("vote retraction removes voted checkmark", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Retract Test");
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

    // Alice votes
    await alice.selectCard("5");
    await alice.waitForVoteCheckmark("Alice");

    // Alice clicks same card again → retract
    await alice.selectCard("5");

    // Checkmark disappears, back to waiting
    const aliceRow = alice.participantList.locator("li").filter({ hasText: "Alice" });
    await expect(aliceRow.getByText("waiting…")).toBeVisible();

    // Bob's view also reflects retraction
    const aliceRowBob = bob.participantList.locator("li").filter({ hasText: "Alice" });
    await expect(aliceRowBob.getByText("waiting…")).toBeVisible();
  });

  test("countdown display appears when session started with timer", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();

    // Set countdown to 30s before creating room
    await alice.selectCountdown(30);
    const roomId = await alice.createRoom("Countdown Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();
    await alice.page.getByTestId("card-picker").waitFor({ state: "visible" });

    // Countdown display should appear and show a number ≤ 30
    await alice.countdownDisplay.waitFor({ state: "visible" });
    const text = await alice.countdownDisplay.textContent();
    expect(Number(text)).toBeGreaterThan(0);
    expect(Number(text)).toBeLessThanOrEqual(30);
  });

  test("auto-reveal fires after countdown_secs=1 via raw WebSocket", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Auto Reveal Test");
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    // Read Alice's persisted participantId from localStorage
    const alicePid = await alice.page.evaluate(
      (rid) => localStorage.getItem(`pp_pid_${rid}`),
      roomId,
    );
    expect(alicePid).toBeTruthy();

    // Start a 1-second countdown via raw WS using Alice's facilitator identity
    await new Promise<void>((resolve, reject) => {
      const ws = new NodeWS(`${WS_URL}?room=${roomId}`);
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "JoinRoom", room_id: roomId, participant_id: alicePid, display_name: "Alice" }));
        setTimeout(() => {
          ws.send(JSON.stringify({ type: "StartSession", room_id: roomId, countdown_secs: 1 }));
          ws.close();
          resolve();
        }, 300);
      });
      ws.on("error", reject);
      setTimeout(() => { ws.close(); reject(new Error("raw WS timeout")); }, 5000);
    });

    // Wait for alarm to fire and auto-reveal (alarm ticks every 1s, countdown=1 → reveals after 1 tick)
    await alice.page.getByTestId("vote-reveal").waitFor({ state: "visible", timeout: 10_000 });
  });

  test("concurrent votes from two users are both recorded correctly", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    const roomId = await alice.createRoom("Concurrent Votes");
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

    // Both users cast votes simultaneously
    await Promise.all([
      alice.selectCard("5"),
      bob.selectCard("8"),
    ]);

    // Both votes must be recorded — neither lost
    await alice.waitForVoteCheckmark("Alice");
    await alice.waitForVoteCheckmark("Bob");

    // Reveal and verify both card values are correct
    await alice.revealBtn.click();
    await alice.waitForRevealedCard("Alice", "5");
    await alice.waitForRevealedCard("Bob", "8");
    // Bob's view also shows both cards
    await bob.waitForRevealedCard("Alice", "5");
    await bob.waitForRevealedCard("Bob", "8");
  });
});
