import type { Meta, StoryObj } from "@storybook/react";
import { ParticipantList } from "./ParticipantList";

const meta: Meta<typeof ParticipantList> = {
  title: "Components/ParticipantList",
  component: ParticipantList,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof ParticipantList>;

const participants = [
  { id: "1", display_name: "Alice", role: "Facilitator" as const },
  { id: "2", display_name: "Bob", role: "Voter" as const },
  { id: "3", display_name: "Carol", role: "Voter" as const },
];

const votes = [
  { participant_id: "1", card: "5", has_voted: true },
  { participant_id: "2", card: null, has_voted: false },
  { participant_id: "3", card: "8", has_voted: true },
];

export const Voting: Story = {
  args: { participants, votes, revealed: false },
};

export const Revealed: Story = {
  args: { participants, votes, revealed: true },
};

export const NoVotes: Story = {
  args: { participants, votes: [], revealed: false },
};

export const SingleParticipant: Story = {
  args: {
    participants: [{ id: "1", display_name: "Alice", role: "Facilitator" as const }],
    votes: [],
    revealed: false,
  },
};
