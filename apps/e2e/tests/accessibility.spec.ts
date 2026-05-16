import { expect, test } from "../fixtures";

test.describe("card picker accessibility", () => {
  test("vote buttons have aria-checked and aria-label", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();
    await alice.cardPicker.waitFor({ state: "visible" });

    // Card picker group has accessible label
    const group = alice.cardPicker.locator('[role="group"]');
    await expect(group).toHaveAttribute("aria-label", "Vote card picker");

    // Each card button has role=radio and an aria-label
    const cardBtns = alice.cardPicker.getByRole("radio");
    const count = await cardBtns.count();
    expect(count).toBeGreaterThan(0);

    // Initially none are checked
    for (let i = 0; i < count; i++) {
      await expect(cardBtns.nth(i)).toHaveAttribute("aria-checked", "false");
    }

    // Select a card — that button becomes checked, rest remain unchecked
    const fiveBtn = alice.cardPicker.getByRole("radio", { name: "Vote 5", exact: true });
    await fiveBtn.click();
    await expect(fiveBtn).toHaveAttribute("aria-checked", "true");

    // Change selection — old one unchecked
    const eightBtn = alice.cardPicker.getByRole("radio", { name: "Vote 8", exact: true });
    await eightBtn.click();
    await expect(eightBtn).toHaveAttribute("aria-checked", "true");
    await expect(fiveBtn).toHaveAttribute("aria-checked", "false");
  });

  test("? and coffee cards have descriptive aria-labels", async ({ alice, roomId }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.joinRoom(roomId, "Alice");
    await alice.waitForRoomView();

    await alice.startSessionBtn.click();
    await alice.cardPicker.waitFor({ state: "visible" });

    // Special cards have meaningful labels (not just the glyph)
    await expect(
      alice.cardPicker.getByRole("radio", { name: "Unknown / unsure" })
    ).toBeVisible();
    await expect(
      alice.cardPicker.getByRole("radio", { name: "Coffee break needed" })
    ).toBeVisible();
  });

  test("selected card is hidden after votes revealed", async ({ alice, bob }) => {
    await alice.goto();
    await alice.waitForConnected();
    await alice.roomNameInput.waitFor({ state: "visible" });
    await alice.roomNameInput.fill("Reveal Hide Test");
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

    await alice.selectCard("8");
    await alice.waitForVoteCheckmark("Alice");

    await bob.selectCard("5");
    await bob.waitForVoteCheckmark("Bob");

    await alice.revealBtn.click();
    await alice.waitForVoteReveal();

    // Card picker disappears after reveal
    await expect(alice.cardPicker).not.toBeVisible();
  });
});
