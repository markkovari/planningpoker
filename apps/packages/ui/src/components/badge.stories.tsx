import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "success", "muted"],
    },
  },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: "Facilitator" } };
export const Secondary: Story = { args: { variant: "secondary", children: "3" } };
export const Success: Story = { args: { variant: "success", children: "Connected" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Error" } };
export const Outline: Story = { args: { variant: "outline", children: "TShirt" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="muted">Muted</Badge>
    </div>
  ),
};
