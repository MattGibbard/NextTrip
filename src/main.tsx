import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./styles.css";
import "./styles/destination.css";
import { App, preloadPage } from "./App";
import { SiteBanner } from "./components/SiteBanner";
import "./install";
import "./theme";
import { publicPage } from "../shared/seo";
import { loadPost } from "./blog";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <SiteBanner />
    <App />
  </StrictMode>
);
// Public pages arrive already rendered (scripts/prerender.mjs), so pick up where the HTML left off.
// The page is marked on the root, so a page that doesn't match this address is drawn from scratch.
function start() {
  const page = root.dataset.page;
  if (page && root.firstElementChild && page === (publicPage(location.pathname) ?? "notfound")) {
    hydrateRoot(root, app);
  } else {
    root.replaceChildren();
    createRoot(root).render(app);
  }
}
// The code for most pages is its own file, and so is a guide's full text or a hub's words (preloadPage
// fetches those too). Fetch them before starting, so the page picks up from the HTML as it is rather
// than flashing empty while they arrive.
const opening = publicPage(location.pathname);
void Promise.all([
  preloadPage(location.pathname),
  // Likewise a blog post.
  ...(opening?.startsWith("post:") ? [loadPost(opening.slice("post:".length))] : []),
])
  .catch(() => {})
  .finally(start);

// Lets the site work as an installed app from the home screen. Skipped in dev so Vite's reloads aren't cached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
