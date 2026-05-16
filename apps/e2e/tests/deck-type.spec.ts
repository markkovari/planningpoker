import { expect, test } from "../fixtures";

test.describe("deck type selection", () => {
  test("fibonacci deck shows fibonacci cards in session", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();

    // Create with Fibonacci (default)
    await alice.roomNameInput.waitFor({ state: "visible" });
    await alice.roomNameInput.fill("Fib Room");
    // Fibonacci button is selected by default — just create
    await alice.createRoomBtn.click();
    await alice.page.getByText("Room created! ID copied to field below.").waitFor({ state: "visible" });
    const roomId = await alice.roomIdInput.inputValue();

    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();
    await alice.startSessionBtn.click();

    // Fibonacci cards visible
    await alice.cardPicker.waitFor({ state: "visible" });
    await expect(alice.cardPicker.getByRole("radio", { name: "Vote 13", exact: true })).toBeVisible();
    await expect(alice.cardPicker.getByRole("radio", { name: "Vote 5", exact: true })).toBeVisible();
    // T-Shirt cards not present
    await expect(alice.cardPicker.getByRole("radio", { name: "Vote XL", exact: true })).not.toBeVisible();
  });

  test("tshirt deck shows tshirt cards in session", async ({ alice }) => {
    await alice.goto();
    await alice.waitForConnected();

    await alice.roomNameInput.waitFor({ state: "visible" });
    await alice.roomNameInput.fill("TShirt Room");
    // Select T-Shirt deck
    await alice.page.getByRole("button", { name: /T-Shirt/i }).click();
    await alice.createRoomBtn.click();
    await alice.page.getByText("Room created! ID copied to field below.").waitFor({ state: "visible" });
    const roomId = await alice.roomIdInput.inputValue();

    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    // Deck badge shows in header
    await expect(alice.page.getByTestId("room-heading")).toBeVisible();

    await alice.startSessionBtn.click();
    await alice.cardPicker.waitFor({ state: "visible" });

    // T-Shirt cards visible
    await expect(alice.cardPicker.getByRole("radio", { name: "Vote XS", exact: true })).toBeVisible();
    await expect(alice.cardPicker.getByRole("radio", { name: "Vote XL", exact: true })).toBeVisible();
    // Fibonacci numbers not present
    await expect(alice.cardPicker.getByRole("radio", { name: "Vote 13", exact: true })).not.toBeVisible();
  });

  test("tshirt vote cast and revealed correctly", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();

    await alice.roomNameInput.waitFor({ state: "visible" });
    await alice.roomNameInput.fill("TShirt Vote Room");
    await alice.page.getByRole("button", { name: /T-Shirt/i }).click();
    await alice.createRoomBtn.click();
    await alice.page.getByText("Room created! ID copied to field below.").waitFor({ state: "visible" });
    const roomId = await alice.roomIdInput.inputValue();

    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await bob.goto();
    await bob.waitForConnected();
    await bob.joinRoom(roomId, "Bob");
    await bob.waitForRoomView();

    await alice.startSessionBtn.click();

    await alice.cardPicker.waitFor({ state: "visible" });
    await alice.selectCard("M");
    await alice.waitForVoteCheckmark("Alice");

    await bob.cardPicker.waitFor({ state: "visible" });
    await bob.selectCard("L");
    await bob.waitForVoteCheckmark("Bob");

    await alice.revealBtn.click();

    await alice.waitForRevealedCard("Alice", "M");
    await alice.waitForRevealedCard("Bob", "L");
    await bob.waitForRevealedCard("Alice", "M");
    await bob.waitForRevealedCard("Bob", "L");
  });
});
