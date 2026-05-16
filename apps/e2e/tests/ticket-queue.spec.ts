import { expect, test } from "../fixtures";

test.describe("ticket queue", () => {
  test("alice adds tickets; queue shows them in insertion order", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.addTicket("PROJ-1: Login flow");
    await alice.waitForTicketInQueue("PROJ-1: Login flow");

    await alice.addTicket("PROJ-2: Dashboard", "Main dashboard redesign");
    await alice.waitForTicketInQueue("PROJ-2: Dashboard");

    await alice.addTicket("PROJ-3: Search");
    await alice.waitForTicketInQueue("PROJ-3: Search");

    const items = alice.ticketQueue.locator("ol li");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("PROJ-1");
    await expect(items.nth(1)).toContainText("PROJ-2");
    await expect(items.nth(2)).toContainText("PROJ-3");
    // First item is marked as next
    await expect(items.nth(0)).toContainText("next");
  });

  test("starting a session pops the first ticket from the queue", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.addTicket("First Ticket");
    await alice.addTicket("Second Ticket");
    await alice.addTicket("Third Ticket");
    await alice.waitForTicketInQueue("First Ticket");

    // Start session — pops First Ticket
    await alice.startSessionBtn.click();
    await alice.waitForSessionTicket("First Ticket");

    // Queue should now only have 2 items
    await alice.resetBtn.click();
    await alice.waitForTicketInQueue("Second Ticket");
    const items = alice.ticketQueue.locator("ol li");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Second Ticket");
    await expect(items.nth(1)).toContainText("Third Ticket");

    // Start again — pops Second Ticket
    await alice.startSessionBtn.click();
    await alice.waitForSessionTicket("Second Ticket");
    await alice.resetBtn.click();

    const itemsAfterTwo = alice.ticketQueue.locator("ol li");
    await expect(itemsAfterTwo).toHaveCount(1);
    await expect(itemsAfterTwo.nth(0)).toContainText("Third Ticket");
  });

  test("queue is empty after all tickets consumed", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.addTicket("Only Ticket");
    await alice.waitForTicketInQueue("Only Ticket");

    await alice.startSessionBtn.click();
    await alice.waitForSessionTicket("Only Ticket");
    await alice.resetBtn.click();

    // Queue is empty — no-tickets message shown
    await alice.ticketQueue.getByText("No tickets queued").waitFor({ state: "visible" });
    // Start session with no queue → session title falls back to "Estimation"
    await alice.startSessionBtn.click();
    await alice.page.getByTestId("session-ticket").getByText("Estimation").waitFor({ state: "visible" });
  });

  test("bob sees tickets added by alice via broadcast", async ({ alice, bob, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await alice.addTicket("Ticket from Alice");
    await alice.waitForTicketInQueue("Ticket from Alice");

    // Bob receives the RoomState broadcast and sees the same queue
    await bob.waitForTicketInQueue("Ticket from Alice");

    // Bob adds one too
    await bob.addTicket("Ticket from Bob");
    await bob.waitForTicketInQueue("Ticket from Bob");
    await alice.waitForTicketInQueue("Ticket from Bob");
  });

  test("session without queue uses fallback Estimation label", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    // No tickets added — start session directly
    await alice.startSessionBtn.click();
    await alice.page.getByTestId("session-ticket").getByText("Estimation").waitFor({ state: "visible" });
  });
});
