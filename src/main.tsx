import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./styles.css";
import "./destination.css";
import { App } from "./App";
import { SiteBanner } from "./components/SiteBanner";
import "./install";
import "./theme";
import { publicPage } from "../shared/seo";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <SiteBanner />
    <App />
  </StrictMode>
);
// Public pages arrive already rendered (scripts/prerender.mjs), so pick up where the HTML left off.
// The page is marked on the root, so a page that doesn't match this address is drawn from scratch.
const page = root.dataset.page;
if (page && root.firstElementChild && page === (publicPage(location.pathname) ?? "notfound")) {
  hydrateRoot(root, app);
} else {
  root.replaceChildren();
  createRoot(root).render(app);
}

// Lets the site work as an installed app from the home screen. Skipped in dev so Vite's reloads aren't cached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
