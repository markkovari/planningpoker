import type { Meta, StoryObj } from "@storybook/react";
import { TicketQueue } from "./TicketQueue";

const meta: Meta<typeof TicketQueue> = {
  title: "Components/TicketQueue",
  component: TicketQueue,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: { onAdd: { action: "ticket added" } },
};
export default meta;
type Story = StoryObj<typeof TicketQueue>;

export const Empty: Story = {
  args: { tickets: [], onAdd: () => {} },
};

export const WithTickets: Story = {
  args: {
    onAdd: () => {},
    tickets: [
      { id: "1", title: "Login page redesign", description: "Update to match new design system" },
      { id: "2", title: "Fix cart bug", description: null },
      { id: "3", title: "Add dark mode support", description: "Implement system preference detection" },
    ],
  },
};

export const SingleTicket: Story = {
  args: {
    onAdd: () => {},
    tickets: [{ id: "1", title: "Only Ticket", description: null }],
  },
};
