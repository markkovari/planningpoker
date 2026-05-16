import type { Meta, StoryObj } from "@storybook/react";
import { Monitor, Moon, Sun } from "lucide-react";
import React, { useState } from "react";
import { cn } from "./utils";

// Standalone controlled ThemeToggle (no next-themes dependency)
type Theme = "system" | "light" | "dark";

const CYCLE: Theme[] = ["system", "light", "dark"];
const ICONS: Record<Theme, React.ReactNode> = {
  system: <Monitor className="h-4 w-4" />,
  light:  <Sun className="h-4 w-4" />,
  dark:   <Moon className="h-4 w-4" />,
};
const LABELS: Record<Theme, string> = {
  system: "System",
  light:  "Light",
  dark:   "Dark",
};

function ThemeToggleDemo({ initial = "system" }: { initial?: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
  return (
    <div className="flex flex-col items-start gap-4 p-4">
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`Theme: ${LABELS[theme]}`}
        className={cn(
          "inline-flex items-center justify-center h-9 w-9 rounded-md",
          "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
        )}
      >
        {ICONS[theme]}
      </button>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Cycles: system → light → dark
      </p>
    </div>
  );
}

const meta: Meta = {
  title: "Components/ThemeToggle",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const SystemTheme: Story = {
  render: () => <ThemeToggleDemo initial="system" />,
};

export const LightTheme: Story = {
  render: () => <ThemeToggleDemo initial="light" />,
};

export const DarkTheme: Story = {
  render: () => <ThemeToggleDemo initial="dark" />,
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      {CYCLE.map((t) => (
        <button
          key={t}
          type="button"
          title={LABELS[t]}
          className={cn(
            "inline-flex items-center justify-center h-9 w-9 rounded-md",
            "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          )}
        >
          {ICONS[t]}
        </button>
      ))}
    </div>
  ),
};
