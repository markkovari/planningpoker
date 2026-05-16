import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
    disabled: { control: "boolean" },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: "Create Room" } };
export const Outline: Story = { args: { variant: "outline", children: "Copy invite link" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Secondary" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Delete" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Ghost" } };
export const Small: Story = { args: { size: "sm", children: "Small" } };
export const Large: Story = { args: { size: "lg", children: "Large" } };
export const Disabled: Story = { args: { disabled: true, children: "Disabled" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
