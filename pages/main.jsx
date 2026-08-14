import React from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import "./static-pages.css";
import App from "./App";

if (typeof document !== "undefined") {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
}
