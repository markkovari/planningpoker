import type { Meta, StoryObj } from "@storybook/react";
import { VoteReveal } from "./VoteReveal";

const meta: Meta<typeof VoteReveal> = {
  title: "Components/VoteReveal",
  component: VoteReveal,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof VoteReveal>;

const actions = {
  onStartNew: () => console.log("start new"),
  onReset: () => console.log("re-vote"),
};

export const Consensus: Story = {
  args: {
    ...actions,
    votes: [
      { participant_id: "1", card: "5", has_voted: true },
      { participant_id: "2", card: "5", has_voted: true },
      { participant_id: "3", card: "5", has_voted: true },
    ],
  },
};

export const Spread: Story = {
  args: {
    ...actions,
    votes: [
      { participant_id: "1", card: "3", has_voted: true },
      { participant_id: "2", card: "5", has_voted: true },
      { participant_id: "3", card: "8", has_voted: true },
      { participant_id: "4", card: "5", has_voted: true },
      { participant_id: "5", card: "13", has_voted: true },
    ],
  },
};

export const WithAbstain: Story = {
  args: {
    ...actions,
    votes: [
      { participant_id: "1", card: "5", has_voted: true },
      { participant_id: "2", card: "?", has_voted: true },
      { participant_id: "3", card: "☕", has_voted: true },
    ],
  },
};

export const TShirt: Story = {
  args: {
    ...actions,
    votes: [
      { participant_id: "1", card: "M", has_voted: true },
      { participant_id: "2", card: "L", has_voted: true },
      { participant_id: "3", card: "M", has_voted: true },
    ],
  },
};
