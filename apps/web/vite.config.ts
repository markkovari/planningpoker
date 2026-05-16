import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const gatewayPort = process.env.GATEWAY_PORT ?? "8081";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: `ws://localhost:${gatewayPort}`,
        ws: true,
      },
    },
  },
});
