// Renders the public pages to HTML at build time (see scripts/prerender.mjs), so search engines and
// link previews see the words without running any JavaScript. In the browser, App draws the same
// page for the same address and picks up from this HTML. App itself isn't used here because the
// signed-in views pull in the map library, which needs a browser.
import { renderToString } from "react-dom/server";
import { HomePage, NotFound } from "./views/Welcome";
import { LegalView } from "./views/Legal";
import { DestinationPage, DestinationsIndex } from "./views/DestinationPage";
import { DESTINATIONS, destinationMeta, readDestination } from "./destinations";
import { HOME } from "./site";
import { SiteBanner } from "./components/SiteBanner";
import { PAGES, headTags as fixedTags, metaTags } from "../shared/seo";
import type { FixedPage, PublicPage } from "../shared/seo";

/**
 * Every page to write, with the file it goes in. Destination guides come from content/destinations.
 * `source` is the content file the page's words come from, so the build can tell when it last changed.
 */
export function pages(): { page: PublicPage; file: string; path: string; index: boolean; source?: string }[] {
  const fixed: { page: FixedPage; file: string; source?: string }[] = [
    { page: "home", file: "index.html", source: "content/site/home.json" },
    { page: "privacy", file: "privacy.html" },
    { page: "terms", file: "terms.html" },
    { page: "destinations", file: "destinations.html" },
    { page: "notfound", file: "404.html" },
  ];
  return [
    ...fixed.map((f) => ({ ...f, path: PAGES[f.page].path, index: PAGES[f.page].index })),
    ...DESTINATIONS.map((d) => ({ page: `destination:${d.slug}` as const, file: `destinations/${d.slug}.html`, path: `/destinations/${d.slug}`, index: true, source: `content/destinations/${d.slug}.json` })),
  ];
}

// Every guide in full. The browser loads them one at a time (loadDestination); this file never reaches it.
const guides = import.meta.glob<Record<string, unknown>>("/content/destinations/*.json", { eager: true, import: "default" });

function destination(page: PublicPage) {
  const slug = page.startsWith("destination:") ? page.slice("destination:".length) : "";
  const raw = DESTINATIONS.some((d) => d.slug === slug) ? guides[`/content/destinations/${slug}.json`] : undefined;
  return raw ? readDestination(slug, raw) : undefined;
}

/** The page's <head> tags. `updated` is when its words last changed, as an ISO date, if known. */
export function headTags(page: PublicPage, updated?: string): string {
  const d = destination(page);
  if (d) return metaTags(destinationMeta(d, updated));
  if (page === "home") return fixedTags("home", { title: HOME.seo_title, description: HOME.seo_description });
  return fixedTags(page as FixedPage);
}

/** The page's HTML, under the announcement banner when one is on, as main.tsx draws it. */
export function render(page: PublicPage): string {
  return renderToString(
    <>
      <SiteBanner />
      {pageBody(page)}
    </>,
  );
}

function pageBody(page: PublicPage) {
  const d = destination(page);
  if (d) return <DestinationPage destination={d} />;
  if (page === "home") return <HomePage />;
  if (page === "notfound") return <NotFound />;
  if (page === "destinations") return <DestinationsIndex />;
  return <LegalView page={page as "privacy" | "terms"} />;
}
