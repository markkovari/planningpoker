import type { Preview } from "@storybook/react";
import React from "react";
// @ts-expect-error — CSS loaded by Vite
import "../src/tokens.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "light", value: "hsl(0 0% 100%)" },
        { name: "dark", value: "hsl(222.2 84% 4.9%)" },
      ],
    },
    layout: "padded",
  },
  globalTypes: {
    theme: {
      description: "Color theme",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals["theme"] as string) ?? "dark";
      document.documentElement.className = theme;
      return <Story />;
    },
  ],
};

export default preview;
