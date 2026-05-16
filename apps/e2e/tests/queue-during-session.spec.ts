import { expect, test } from "../fixtures";

test.describe("ticket queue visibility during session", () => {
  test("queue stays visible during active session with 'voting now' marker", async ({
    alice,
    roomId,
  }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.addTicket("PROJ-1: Auth");
    await alice.addTicket("PROJ-2: Dashboard");
    await alice.waitForTicketInQueue("PROJ-1: Auth");

    // Start session — pops PROJ-1
    await alice.startSessionBtn.click();
    await alice.waitForSessionTicket("PROJ-1: Auth");

    // Queue still visible in sidebar during session
    await alice.ticketQueue.waitFor({ state: "visible" });

    // "voting now" badge visible
    await expect(alice.ticketQueue).toContainText("voting now");

    // PROJ-2 still shows in queue with position number
    await expect(alice.ticketQueue).toContainText("PROJ-2: Dashboard");
  });

  test("queue shows position numbers", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.addTicket("First");
    await alice.addTicket("Second");
    await alice.addTicket("Third");
    await alice.waitForTicketInQueue("Third");

    const items = alice.ticketQueue.locator("ol li");
    await expect(items).toHaveCount(3);

    // Position numbers shown
    await expect(items.nth(0)).toContainText("1.");
    await expect(items.nth(1)).toContainText("2.");
    await expect(items.nth(2)).toContainText("3.");
  });

  test("queue updates after 'Vote on new ticket'", async ({ alice, bob, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await alice.addTicket("Ticket A");
    await alice.addTicket("Ticket B");
    await alice.waitForTicketInQueue("Ticket A");

    await alice.startSessionBtn.click();
    await alice.waitForSessionTicket("Ticket A");

    await alice.selectCard("5");
    await bob.selectCard("5");
    await alice.revealBtn.waitFor({ state: "visible" });
    await alice.revealBtn.click();
    await alice.waitForVoteReveal();

    // Click "Vote on new ticket"
    await alice.page.getByTestId("start-new-btn").click();

    // Session now on Ticket B
    await alice.waitForSessionTicket("Ticket B");

    // Queue shows "voting now" for Ticket B
    await expect(alice.ticketQueue).toContainText("voting now");
    await expect(alice.ticketQueue).toContainText("Ticket B");
  });
});
