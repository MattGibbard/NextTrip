// What search engines and link previews see for each public page. scripts/prerender.mjs writes
// these into the built HTML, and the Worker serves the private pages with noindex.
import { escapeHtml } from "./html";

export const SITE = "https://somewhere.party";

/** The Worker's old address, which now sends people to the site's own domain. */
export const OLD_HOST = "nexttrip.matt-gibbard.workers.dev";

/** The fixed pages. */
export type FixedPage = "home" | "privacy" | "terms" | "notfound" | "destinations" | "creators" | "blog" | "how" | "picker" | "reveal" | InfoPage;
/** The plain content pages, whose words are edited at /admin (content/pages). */
export type InfoPage = "about" | "faq" | "contact" | "money" | "decide";

/** Each content page's address and the content file its words are in. */
export const INFO_PAGES: Record<InfoPage, { path: string; file: string }> = {
  about: { path: "/about", file: "about" },
  faq: { path: "/faq", file: "faq" },
  contact: { path: "/contact", file: "contact" },
  money: { path: "/how-we-make-money", file: "how-we-make-money" },
  decide: { path: "/how-to-decide-where-to-go-on-holiday", file: "how-to-decide" },
};

/** Which content page an address is, if any. */
export function infoPage(pathname: string): InfoPage | null {
  const clean = pathname.replace(/(.)\/$/, "$1");
  const hit = (Object.keys(INFO_PAGES) as InfoPage[]).find((k) => INFO_PAGES[k].path === clean);
  return hit ?? null;
}
/**
 * Every prerendered page: the fixed ones plus one per destination guide, as "destination:new-york", one
 * per blog post, as "post:my-post", and one per blog tag in use, as "tag:city-breaks". The blog's later
 * pages are "blog:2" and so on, and a tag's are "tag:city-breaks:2". Each guide also has a holiday
 * picker result page, as "pick:new-york", kept out of search.
 */
export type PublicPage = FixedPage | `destination:${string}` | `post:${string}` | `tag:${string}` | `blog:${number}` | `pick:${string}`;

/** The blog's RSS feed, written by scripts/prerender.mjs. */
export const FEED_PATH = "/blog/feed.xml";

export type Meta = {
  path: string;
  title: string;
  description: string;
  index: boolean;
  /** "article" for a guide; a website page otherwise. */
  type?: "website" | "article";
  /** Share image, an absolute address. The site's own share image without one. */
  image?: string;
  imageAlt?: string;
  /** The share image's width and height, if known. */
  imageSize?: [number, number];
  /** For an article: when it was first published and last changed, as ISO dates, if known. */
  published?: string;
  updated?: string;
  /** schema.org data for search results. */
  jsonLd?: unknown[];
  /** Kept out of search but shared by link, so it still gets share-preview tags. */
  preview?: boolean;
};

export const PAGES: Record<FixedPage, Meta> = {
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
  destinations: {
    path: "/destinations",
    title: "Holiday ideas and destination guides: where to go next | somewhere🎉",
    description:
      "Holiday destination guides with when to go, how long to stay and what to do there. Find somewhere new and add it to your ideas.",
    index: true,
  },
  creators: {
    path: "/creators",
    title: "Work with us: creators | somewhere🎉",
    description: "Do you make travel or family content and love somewhere🎉? Message us on Instagram to be featured on our home page.",
    index: true,
  },
  how: {
    path: "/how-it-works",
    title: "How somewhere🎉 works: a fair holiday draw in five steps",
    description: "See how somewhere🎉 works: put holiday ideas on standby, spread points in secret, let a fair draw pick the winner, then plan the trip together.",
    index: true,
  },
  picker: {
    path: "/holiday-picker",
    title: "Random holiday picker: let the board decide where to go | somewhere🎉",
    description:
      "Can't pick a holiday? Answer five quick questions and our random holiday picker draws a destination from our guides. Free, and no account needed.",
    index: true,
  },
  // A holiday picker result sent to someone, which plays the draw before showing it. The winner stays
  // out of the address's path and the share preview, so the link doesn't spoil it.
  reveal: {
    path: "/holiday-picker/reveal",
    title: "We've picked a holiday! Watch the board to see where | somewhere🎉",
    description: "The somewhere🎉 holiday picker has drawn our next holiday. Tap to watch the departures board reveal where we're going.",
    index: false,
    preview: true,
  },
  blog: {
    path: "/blog",
    title: "Holiday ideas and advice: the somewhere🎉 blog",
    description: "Holiday ideas, comparisons and travel advice: where to go, when to go, and how to agree on it as a family or group.",
    index: true,
  },
  about: {
    path: INFO_PAGES.about.path,
    title: "About us | somewhere🎉",
    description: "Why we built somewhere🎉, the free family holiday planner, and how we run it.",
    index: true,
  },
  faq: {
    path: INFO_PAGES.faq.path,
    title: "FAQ | somewhere🎉",
    description: "Answers to common questions about somewhere🎉, the free family holiday planner.",
    index: true,
  },
  contact: {
    path: INFO_PAGES.contact.path,
    title: "Contact us | somewhere🎉",
    description: "Get in touch with somewhere🎉 by message on Instagram.",
    index: true,
  },
  money: {
    path: INFO_PAGES.money.path,
    title: "How we make money | somewhere🎉",
    description: "somewhere🎉 is free. Here's how it pays its way.",
    index: true,
  },
  decide: {
    path: INFO_PAGES.decide.path,
    title: "How to decide where to go on holiday | somewhere🎉",
    description: "A simple, fair way to decide where to go on holiday as a family or group.",
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
  const m = pathname.match(/^\/(privacy|terms|destinations|creators|blog)\/?$/);
  if (m) return m[1] as FixedPage;
  if (/^\/how-it-works\/?$/.test(pathname)) return "how";
  if (/^\/holiday-picker\/?$/.test(pathname)) return "picker";
  if (/^\/holiday-picker\/reveal\/?$/.test(pathname)) return "reveal";
  const pick = pathname.match(/^\/holiday-picker\/([a-z0-9-]+)\/?$/);
  if (pick) return `pick:${pick[1]}`;
  const info = infoPage(pathname);
  if (info) return info;
  const d = pathname.match(/^\/destinations\/([a-z0-9-]+)\/?$/);
  if (d) return `destination:${d[1]}`;
  const bp = pathname.match(/^\/blog\/page\/([1-9]\d*)\/?$/);
  if (bp) return `blog:${Number(bp[1])}`;
  const p = pathname.match(/^\/blog\/([a-z0-9-]+)\/?$/);
  if (p) return `post:${p[1]}`;
  const t = pathname.match(/^\/blog\/tag\/([a-z0-9-]+)(?:\/page\/([1-9]\d*))?\/?$/);
  return t ? (t[2] ? `tag:${t[1]}:${Number(t[2])}` : `tag:${t[1]}`) : null;
}

/** The address of a blog post. */
export function postPath(slug: string): string {
  return `/blog/${slug}`;
}

/** The address of a destination guide. */
export function destinationPath(slug: string): string {
  return `/destinations/${slug}`;
}

/** The holiday picker's result page for a guide. Its answers ride along in the query string. */
export function pickPath(slug: string): string {
  return `/holiday-picker/${slug}`;
}

/** Family links, people's own links and sign-in links: real pages, but private, so kept out of search. */
export function isPrivatePath(pathname: string): boolean {
  return /^\/[fp]\/[\w-]+\/?$/.test(pathname) || /^\/signin\/?$/.test(pathname);
}

/** The title, description, canonical address and share-preview tags for a fixed page's <head>. */
export function headTags(page: FixedPage, words?: { title?: string; description?: string; jsonLd?: unknown[] }): string {
  // The home, creators and How it works pages' titles and descriptions can be changed in the editor at /admin.
  const m = {
    ...PAGES[page],
    ...(words?.title ? { title: words.title } : {}),
    ...(words?.description ? { description: words.description } : {}),
    ...(words?.jsonLd ? { jsonLd: words.jsonLd } : {}),
  };
  return metaTags(page === "home" ? { ...m, jsonLd: structuredData(m.description) } : m);
}

/** The <head> tags for any page, from its details. */
export function metaTags(m: Meta): string {
  const url = SITE + m.path;
  const tags = [
    `<title>${escapeHtml(m.title)}</title>`,
    `<meta name="description" content="${escapeHtml(m.description)}" />`,
  ];
  if (!m.index) {
    tags.push(`<meta name="robots" content="noindex" />`);
    if (!m.preview) return tags.join("\n    ");
  } else {
    tags.push(`<link rel="canonical" href="${url}" />`);
  }
  tags.push(
    `<meta property="og:type" content="${m.type ?? "website"}" />`,
    `<meta property="og:site_name" content="somewhere🎉" />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escapeHtml(m.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(m.description)}" />`,
  );
  if (m.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(m.image)}" />`);
    if (m.imageSize) tags.push(`<meta property="og:image:width" content="${m.imageSize[0]}" />`, `<meta property="og:image:height" content="${m.imageSize[1]}" />`);
    if (m.imageAlt) tags.push(`<meta property="og:image:alt" content="${escapeHtml(m.imageAlt)}" />`);
  } else {
    tags.push(
      `<meta property="og:image" content="${SITE}/og.png" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="somewhere🎉: can't agree where to go next? Let the draw decide." />`,
    );
  }
  if (m.type === "article") {
    if (m.published) tags.push(`<meta property="article:published_time" content="${m.published}" />`);
    if (m.updated) tags.push(`<meta property="article:modified_time" content="${m.updated}" />`);
  }
  tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  // Blog pages point feed readers to the blog's feed.
  if (m.path === "/blog" || m.path.startsWith("/blog/")) tags.push(`<link rel="alternate" type="application/rss+xml" title="somewhere🎉 blog" href="${SITE}${FEED_PATH}" />`);
  for (const data of m.jsonLd ?? []) tags.push(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`);
  return tags.join("\n    ");
}

/** The homepage's schema.org data: the site itself, who runs it, and the app. */
function structuredData(description: string): unknown[] {
  const name = "somewhere🎉";
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      // Search results may drop the emoji, so give them the plain name too.
      alternateName: ["somewhere.party", "somewhere"],
      url: `${SITE}/`,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      alternateName: "somewhere.party",
      url: `${SITE}/`,
      logo: `${SITE}/icon-512.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      alternateName: "somewhere.party",
      url: `${SITE}/`,
      description,
      applicationCategory: "TravelApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    },
  ];
}
