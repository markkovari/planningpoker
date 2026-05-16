import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CardPicker } from "./CardPicker";

const FIBONACCI = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"];
const TSHIRT = ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"];

const meta: Meta<typeof CardPicker> = {
  title: "Components/CardPicker",
  component: CardPicker,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof CardPicker>;

function Interactive({ cards }: { cards: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <CardPicker cards={cards} selected={selected} onSelect={setSelected} />;
}

export const Fibonacci: Story = {
  render: () => <Interactive cards={FIBONACCI} />,
};

export const TShirt: Story = {
  render: () => <Interactive cards={TSHIRT} />,
};

export const Disabled: Story = {
  render: () => <CardPicker cards={FIBONACCI} selected="5" onSelect={() => {}} disabled />,
};

export const NoneSelected: Story = {
  render: () => <CardPicker cards={FIBONACCI} selected={null} onSelect={() => {}} />,
};
