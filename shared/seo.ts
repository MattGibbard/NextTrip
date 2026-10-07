// What search engines and link previews see for each public page. scripts/prerender.mjs writes
// these into the built HTML, and the Worker serves the private pages with noindex.

export const SITE = "https://somewhere.party";

/** The Worker's old address, which now sends people to the site's own domain. */
export const OLD_HOST = "nexttrip.matt-gibbard.workers.dev";

export type PublicPage = "home" | "privacy" | "terms" | "notfound";

type Meta = { path: string; title: string; description: string; index: boolean };

export const PAGES: Record<PublicPage, Meta> = {
  home: {
    path: "/",
    title: "Decide where to go on holiday, together | somewhere🎉",
    description:
      "Can't decide where to go on holiday? somewhere🎉 lets the whole family add ideas, spread points in secret and let a fair draw pick your next trip. Free to use.",
    index: true,
  },
  privacy: {
    path: "/privacy",
    title: "Privacy policy | somewhere🎉",
    description: "What somewhere🎉 keeps about you and your family's holiday plans, why, and how to delete it.",
    index: true,
  },
  terms: {
    path: "/terms",
    title: "Terms of use | somewhere🎉",
    description: "The terms for using somewhere🎉, the free family holiday planner.",
    index: true,
  },
  notfound: {
    path: "/404",
    title: "Page not found | somewhere🎉",
    description: "There's nothing at this address.",
    index: false,
  },
};

/** Which prerendered page an address shows, if any. Family links and the app itself are never prerendered. */
export function publicPage(pathname: string): PublicPage | null {
  if (pathname === "/") return "home";
  const m = pathname.match(/^\/(privacy|terms)\/?$/);
  return m ? (m[1] as PublicPage) : null;
}

/** Family links, people's own links and sign-in links: real pages, but private, so kept out of search. */
export function isPrivatePath(pathname: string): boolean {
  return /^\/[fp]\/[\w-]+\/?$/.test(pathname) || /^\/signin\/?$/.test(pathname);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Travelpayouts' site-ownership check, as they gave it. Temporary and home page only: take it out
 * once they've approved the site for the Aviasales flight links.
 */
const TRAVELPAYOUTS_VERIFY = `<script data-cmp-ab="2">
      (function () {
        var script = document.createElement("script");
        script.async = 1;
        script.setAttribute("data-cmp-ab", "2");
        script.src = "https://tpembars.com/NTgyNzQ5.js?t=582749";
        document.head.appendChild(script);
      })();
    </script>`;

/** The title, description, canonical address and share-preview tags for a page's <head>. */
export function headTags(page: PublicPage): string {
  const m = PAGES[page];
  const url = SITE + m.path;
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
  ];
  if (!m.index) {
    tags.push(`<meta name="robots" content="noindex" />`);
    return tags.join("\n    ");
  }
  tags.push(
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="somewhere🎉" />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:image" content="${SITE}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="somewhere🎉: can't agree where to go next? Let the draw decide." />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  );
  if (page === "home") tags.push(TRAVELPAYOUTS_VERIFY);
  if (page === "home") tags.push(`<script type="application/ld+json">${JSON.stringify(structuredData()).replace(/</g, "\\u003c")}</script>`);
  return tags.join("\n    ");
}

function structuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "somewhere🎉",
    alternateName: "somewhere.party",
    url: `${SITE}/`,
    description: PAGES.home.description,
    applicationCategory: "TravelApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  };
}
