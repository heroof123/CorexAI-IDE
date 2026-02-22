import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { validateEnv } from "./config/env";
import "./index.css";

// Validate environment variables before starting the app
try {
  validateEnv();
} catch (error) {
  console.error(error);
  // Show error in UI instead of crashing
  if (error instanceof Error) {
    document.getElementById("root")!.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #1a1a1a;
        color: #fff;
        font-family: system-ui, -apple-system, sans-serif;
        padding: 2rem;
      ">
        <div style="
          max-width: 600px;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          padding: 2rem;
        ">
          <h1 style="color: #ef4444; margin-bottom: 1rem;">⚠️ Configuration Error</h1>
          <pre style="
            background: #1a1a1a;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.875rem;
            line-height: 1.5;
          ">${error.message}</pre>
          <button 
            onclick="window.location.reload()"
            style="
              margin-top: 1rem;
              padding: 0.5rem 1rem;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            "
          >
            Reload
          </button>
        </div>
      </div>
    `;
  }
  throw error;
}

import { migrateFromLocalStorage } from "./services/storage";

// Start migration early
migrateFromLocalStorage().catch(err => console.error("Migration error:", err));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);