// Renders the public pages to HTML at build time (see scripts/prerender.mjs), so search engines and
// link previews see the words without running any JavaScript. In the browser, App draws the same
// page for the same address and picks up from this HTML. App itself isn't used here because the
// signed-in views pull in the map library, which needs a browser.
import { renderToString } from "react-dom/server";
import { HomePage, NotFound } from "./views/Welcome";
import { LegalView } from "./views/Legal";
import { headTags } from "../shared/seo";
import type { PublicPage } from "../shared/seo";

export { headTags };

export function render(page: PublicPage): string {
  if (page === "home") return renderToString(<HomePage />);
  if (page === "notfound") return renderToString(<NotFound />);
  return renderToString(<LegalView page={page} />);
}
