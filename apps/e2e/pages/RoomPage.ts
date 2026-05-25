import type { Locator, Page } from "@playwright/test";

const CARD_ARIA_LABELS: Record<string, string> = {
  "?": "Unknown / unsure",
  "☕": "Coffee break needed",
};

export class RoomPage {
  readonly page: Page;

  // Join form
  readonly roomIdInput: Locator;
  readonly nameInput: Locator;
  readonly joinBtn: Locator;
  readonly connectionStatus: Locator;

  // Create room section
  readonly roomNameInput: Locator;
  readonly createRoomBtn: Locator;

  // Ticket queue
  readonly ticketQueue: Locator;
  readonly ticketTitleInput: Locator;
  readonly ticketDescriptionInput: Locator;
  readonly addTicketBtn: Locator;

  // Room view
  readonly roomHeading: Locator;
  readonly startSessionBtn: Locator;
  readonly revealBtn: Locator;
  readonly resetBtn: Locator;
  readonly startNewBtn: Locator;
  readonly reVoteBtn: Locator;
  readonly noSession: Locator;
  readonly cardPicker: Locator;
  readonly voteReveal: Locator;
  readonly participantList: Locator;
  readonly countdownDisplay: Locator;

  constructor(page: Page) {
    this.page = page;

    this.roomIdInput = page.getByTestId("room-id-input");
    this.nameInput = page.getByTestId("name-input");
    this.joinBtn = page.getByTestId("join-btn");
    this.connectionStatus = page.getByTestId("connection-status");

    this.roomNameInput = page.getByTestId("room-name-input");
    this.createRoomBtn = page.getByTestId("create-room-btn");

    this.ticketQueue = page.getByTestId("ticket-queue");
    this.ticketTitleInput = page.getByTestId("ticket-title-input");
    this.ticketDescriptionInput = page.getByTestId("ticket-description-input");
    this.addTicketBtn = page.getByTestId("add-ticket-btn");

    this.roomHeading = page.getByTestId("room-heading");
    this.startSessionBtn = page.getByTestId("start-session-btn");
    this.revealBtn = page.getByTestId("reveal-btn");
    this.resetBtn = page.getByTestId("reset-btn");
    this.startNewBtn = page.getByTestId("start-new-btn");
    this.reVoteBtn = page.getByTestId("reset-from-reveal-btn");
    this.noSession = page.getByTestId("no-session");
    this.cardPicker = page.getByTestId("card-picker");
    this.voteReveal = page.getByTestId("vote-reveal");
    this.participantList = page.getByTestId("participant-list");
    this.countdownDisplay = page.getByTestId("countdown-display");
  }

  async goto() {
    await this.page.goto("/");
  }

  async gotoRoom(roomId: string) {
    await this.page.goto(`/?room=${roomId}`);
  }

  async selectCountdown(secs: 0 | 30 | 60 | 90) {
    const label = secs === 0 ? "Off" : `${secs}s`;
    await this.page.getByRole("button", { name: label, exact: true }).click();
  }

  async createRoom(roomName: string): Promise<string> {
    await this.roomNameInput.waitFor({ state: "visible" });
    await this.roomNameInput.fill(roomName);
    await this.createRoomBtn.click();
    // Wait for confirmation text that the room was created
    await this.page.getByText("Room created! ID copied to field below.").waitFor({ state: "visible" });
    return await this.roomIdInput.inputValue();
  }

  async joinRoom(roomId: string, displayName: string) {
    await this.roomIdInput.fill(roomId);
    await this.nameInput.fill(displayName);
    // Submit via Enter to use the native form submit event, which React handles
    // reliably across all browsers (avoids Firefox click-event issues with React 19).
    await this.nameInput.press("Enter");
    await this.roomHeading.waitFor({ state: "visible" });
    // Wait for the server to confirm the join: participant list shows our own name.
    // Without this, tests proceed before the WS has connected and JoinRoom was processed,
    // causing alice.waitForParticipantByName("Bob") to race against Alice's own join.
    await this.participantList.getByText(displayName, { exact: false }).waitFor({ state: "visible" });
  }

  async waitForConnected() {
    await this.connectionStatus.getByText("Connected").waitFor({ state: "visible" });
  }

  async waitForRoomView() {
    await this.roomHeading.waitFor({ state: "visible" });
  }

  async waitForParticipantByName(displayName: string) {
    await this.participantList.getByText(displayName, { exact: false }).waitFor({ state: "visible" });
  }

  async selectCard(card: string) {
    const label = CARD_ARIA_LABELS[card] ?? `Vote ${card}`;
    await this.cardPicker.getByRole("radio", { name: label, exact: true }).click();
  }

  async waitForVoteCheckmark(participantDisplayName: string) {
    const row = this.participantList.locator("li").filter({ hasText: participantDisplayName });
    await row.getByText("voted ✓").waitFor({ state: "visible" });
  }

  async waitForRevealedCard(participantDisplayName: string, card: string) {
    const row = this.participantList.locator("li").filter({ hasText: participantDisplayName });
    await row.getByText(card, { exact: true }).waitFor({ state: "visible" });
  }

  async waitForVotesCleared() {
    await this.participantList.getByText("waiting…").first().waitFor({ state: "visible" });
  }

  async waitForVoteReveal() {
    await this.voteReveal.waitFor({ state: "visible" });
  }

  async addTicket(title: string, description?: string) {
    await this.ticketTitleInput.fill(title);
    if (description) await this.ticketDescriptionInput.fill(description);
    await this.addTicketBtn.click();
  }

  async waitForTicketInQueue(title: string) {
    await this.ticketQueue.getByText(title, { exact: false }).waitFor({ state: "visible" });
  }

  async waitForSessionTicket(title: string) {
    await this.page.getByTestId("session-ticket").getByText(title, { exact: false }).waitFor({ state: "visible" });
  }
}
