// Renders the public pages to HTML at build time (see scripts/prerender.mjs), so search engines and
// link previews see the words without running any JavaScript. In the browser, App draws the same
// page for the same address and picks up from this HTML. App itself isn't used here because the
// signed-in views pull in the map library, which needs a browser.
import { renderToString } from "react-dom/server";
import { HomePage, NotFound } from "./views/Welcome";
import { LegalView } from "./views/Legal";
import { DestinationPage, DestinationsIndex } from "./views/DestinationPage";
import { DESTINATIONS, destinationMeta } from "./destinations";
import { PAGES, headTags as fixedTags, metaTags } from "../shared/seo";
import type { FixedPage, PublicPage } from "../shared/seo";

/** Every page to write, with the file it goes in. Destination guides come from content/destinations. */
export function pages(): { page: PublicPage; file: string; path: string; index: boolean }[] {
  const fixed: { page: FixedPage; file: string }[] = [
    { page: "home", file: "index.html" },
    { page: "privacy", file: "privacy.html" },
    { page: "terms", file: "terms.html" },
    { page: "destinations", file: "destinations.html" },
    { page: "notfound", file: "404.html" },
  ];
  return [
    ...fixed.map((f) => ({ ...f, path: PAGES[f.page].path, index: PAGES[f.page].index })),
    ...DESTINATIONS.map((d) => ({ page: `destination:${d.slug}` as const, file: `destinations/${d.slug}.html`, path: `/destinations/${d.slug}`, index: true })),
  ];
}

function destination(page: PublicPage) {
  return page.startsWith("destination:") ? DESTINATIONS.find((d) => `destination:${d.slug}` === page) : undefined;
}

export function headTags(page: PublicPage): string {
  const d = destination(page);
  if (d) return metaTags(destinationMeta(d));
  return fixedTags(page as FixedPage);
}

export function render(page: PublicPage): string {
  const d = destination(page);
  if (d) return renderToString(<DestinationPage destination={d} />);
  if (page === "home") return renderToString(<HomePage />);
  if (page === "notfound") return renderToString(<NotFound />);
  if (page === "destinations") return renderToString(<DestinationsIndex />);
  return renderToString(<LegalView page={page as "privacy" | "terms"} />);
}
