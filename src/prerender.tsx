// Renders the public pages to HTML at build time (see scripts/prerender.mjs), so search engines and
// link previews see the words without running any JavaScript. In the browser, App draws the same
// page for the same address and picks up from this HTML. App itself isn't used here because the
// signed-in views pull in the map library, which needs a browser.
import { renderToString } from "react-dom/server";
import { HomePage } from "./views/HomePage";
import { NotFound } from "./views/NotFound";
import { LegalView } from "./views/Legal";
import { DestinationPage, DestinationsIndex } from "./views/DestinationPage";
import { HubPage } from "./views/HubPage";
import { DESTINATIONS, destinationMeta, readDestination } from "./destinations";
import { HUBS, countryHub, hubMeta, readHub } from "./hubs";
import { CREATORS, HOME, HOW } from "./site";
import { CreatorsPage } from "./views/Creators";
import { HowItWorksPage } from "./views/HowItWorks";
import { HolidayPicker } from "./views/HolidayPicker";
import { pickMeta } from "./picker";
import { InfoPage } from "./views/InfoPage";
import { BlogList, BlogPost } from "./views/Blog";
import { POSTS, listing, listingMeta, listingPath, listings, postMeta, readPost, withCard } from "./blog";
import { feedXml } from "./feed";
import { INFO, infoJsonLd, infoSource } from "./infoPages";
import { SiteBanner } from "./components/SiteBanner";
import { INFO_PAGES, PAGES, headTags as fixedTags, metaTags } from "../shared/seo";
import type { FixedPage, InfoPage as Info, PublicPage } from "../shared/seo";

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
    { page: "creators", file: "creators.html", source: "content/site/creators.json" },
    { page: "how", file: "how-it-works.html", source: "content/site/how-it-works.json" },
    { page: "picker", file: "holiday-picker.html" },
    ...(Object.keys(INFO_PAGES) as Info[]).map((page) => ({ page, file: `${INFO_PAGES[page].path.slice(1)}.html`, source: infoSource(page) })),
    { page: "notfound", file: "404.html" },
  ];
  return [
    ...fixed.map((f) => ({ ...f, path: PAGES[f.page].path, index: PAGES[f.page].index })),
    ...DESTINATIONS.map((d) => ({ page: `destination:${d.slug}` as const, file: `destinations/${d.slug}.html`, path: `/destinations/${d.slug}`, index: true, source: `content/destinations/${d.slug}.json` })),
    // Hubs share the guides' addresses, and their page names.
    ...HUBS.map((h) => ({ page: `destination:${h.slug}` as const, file: `destinations/${h.slug}.html`, path: `/destinations/${h.slug}`, index: true, source: `content/hubs/${h.slug}.json` })),
    // Each guide's holiday picker result, kept out of search.
    ...DESTINATIONS.map((d) => ({ page: `pick:${d.slug}` as const, file: `holiday-picker/${d.slug}.html`, path: `/holiday-picker/${d.slug}`, index: false })),
    ...POSTS.map((p) => ({ page: `post:${p.slug}` as const, file: `blog/${p.slug}.html`, path: `/blog/${p.slug}`, index: true, source: `content/blog/${p.slug}.json` })),
    // The blog's pages of posts, and each tag's. Nearly empty tags are kept out of search results until they fill up.
    ...listings().map((l) => {
      const path = listingPath(l.tag, l.page);
      return { page: l.id as PublicPage, file: `${path.slice(1)}.html`, path, index: listingMeta(l).index, source: "content/blog" };
    }),
  ];
}

// Every guide in full. The browser loads them one at a time (loadDestination); this file never reaches it.
const guides = import.meta.glob<Record<string, unknown>>("/content/destinations/*.json", { eager: true, import: "default" });

function destination(page: PublicPage) {
  const slug = page.startsWith("destination:") ? page.slice("destination:".length) : "";
  const raw = DESTINATIONS.some((d) => d.slug === slug) ? guides[`/content/destinations/${slug}.json`] : undefined;
  return raw ? readDestination(slug, raw) : undefined;
}

// Every hub in full, likewise.
const hubFiles = import.meta.glob<Record<string, unknown>>("/content/hubs/*.json", { eager: true, import: "default" });

function hub(page: PublicPage) {
  const slug = page.startsWith("destination:") ? page.slice("destination:".length) : "";
  const raw = HUBS.some((h) => h.slug === slug) ? hubFiles[`/content/hubs/${slug}.json`] : undefined;
  return raw ? readHub(slug, raw) : undefined;
}

// Every blog post in full, likewise.
const postFiles = import.meta.glob<Record<string, unknown>>("/content/blog/*.json", { eager: true, import: "default" });

function post(page: PublicPage) {
  const slug = page.startsWith("post:") ? page.slice("post:".length) : "";
  const raw = POSTS.some((p) => p.slug === slug) ? postFiles[`/content/blog/${slug}.json`] : undefined;
  return raw ? withCard(readPost(slug, raw)) : undefined;
}

/** The guide a holiday picker result page is for. */
function pick(page: PublicPage) {
  return page.startsWith("pick:") ? DESTINATIONS.find((d) => d.slug === page.slice("pick:".length)) : undefined;
}

/** The blog's RSS feed. */
export function feed(): string {
  return feedXml();
}

/** The page's <head> tags. `updated` and `published` are when its words last changed and were first added, as ISO dates, if known. */
export function headTags(page: PublicPage, updated?: string, published?: string): string {
  const d = destination(page);
  if (d) return metaTags(destinationMeta(d, { updated, published, country: countryHub(d.country_code) }));
  const h = hub(page);
  if (h) return metaTags(hubMeta(h, updated));
  const p = post(page);
  if (p) return metaTags(postMeta(p, updated));
  const picked = pick(page);
  if (picked) return metaTags(pickMeta(picked));
  const l = listing(page);
  if (l) return metaTags(listingMeta(l));
  if (page === "home") return fixedTags("home", { title: HOME.seo_title, description: HOME.seo_description });
  if (page === "creators") return fixedTags("creators", { title: CREATORS.seo_title, description: CREATORS.seo_description });
  if (page === "how") return fixedTags("how", { title: HOW.seo_title, description: HOW.seo_description });
  const info = page in INFO_PAGES ? (page as Info) : null;
  if (info) return fixedTags(info, { title: INFO[info].seo_title, description: INFO[info].seo_description, jsonLd: infoJsonLd(info, updated) });
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
  const h = hub(page);
  if (h) return <HubPage hub={h} />;
  const p = post(page);
  if (p) return <BlogPost post={p} />;
  const picked = pick(page);
  if (picked) return <HolidayPicker slug={picked.slug} />;
  if (page === "picker") return <HolidayPicker />;
  const l = listing(page);
  if (l) return <BlogList listing={l} />;
  if (page === "home") return <HomePage />;
  if (page === "notfound") return <NotFound />;
  if (page === "destinations") return <DestinationsIndex />;
  if (page === "creators") return <CreatorsPage />;
  if (page === "how") return <HowItWorksPage />;
  const info = page in INFO_PAGES ? (page as Info) : null;
  if (info) return <InfoPage page={info} />;
  return <LegalView page={page as "privacy" | "terms"} />;
}
