import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerBackgroundSync } from "./utils/backgroundSync";

// Register service worker for offline support (production only)
// Dev uses self-signed SSL which blocks SW registration
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('SW registered:', registration.scope);
    }).catch((err) => {
      console.error('SW registration failed:', err);
    });
  });
}

// Register background sync for offline orders
registerBackgroundSync();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
