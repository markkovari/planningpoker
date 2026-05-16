import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { App } from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("no #root element");
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
