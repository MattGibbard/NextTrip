// Airport guides in full: their words, the blog posts about each airport and the places those posts
// link to (scripts/destination-cards.mjs `?airport`). Only the airport pages load this.
import { PAGES, SITE, airportPath, postPath } from "../shared/seo";
import type { Meta } from "../shared/seo";
import { readPost } from "./blog";
import type { PostPlace } from "./blog";
import { readAirportCard, slugOf } from "./airports";
import type { AirportCard } from "./airports";

export interface Terminal {
  /** "Terminal 2", "North Terminal". */
  name: string;
  /** Who flies from it, as the editor wrote it: "Jet2, TUI, easyJet and most other airlines". */
  airlines: string;
  /** A few lines about it, in the same form as a section's text. */
  text: string;
}

export interface Airport extends AirportCard {
  /** The page heading. */
  title: string;
  /** Also the description Google shows, unless seo_description is set. */
  intro: string;
  seo_title: string;
  seo_description: string;
  terminals: Terminal[];
  /** Getting there, parking and the like, in the same form as a blog post's sections. */
  sections: { heading: string; text: string }[];
  faqs: { question: string; answer: string }[];
  /** The blog posts about this airport (their `airport` field), direct-flights posts first. */
  posts: { slug: string; title: string; intro: string }[];
  /** The places those posts link to, for the departures board. */
  places: PostPlace[];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** Turns a file from the editor into an airport guide, filling gaps rather than breaking the build over a missing field. */
export function readAirport(slug: string, raw: Record<string, unknown>): Airport {
  const card = readAirportCard(slug, raw);
  return {
    ...card,
    title: str(raw.title) || `${card.name} guide`,
    intro: str(raw.intro),
    seo_title: str(raw.seo_title),
    seo_description: str(raw.seo_description),
    terminals: list(raw.terminals)
      .map((t) => ({ name: str(t.name), airlines: str(t.airlines), text: str(t.text) }))
      .filter((t) => t.name),
    sections: list(raw.sections)
      .map((s) => ({ heading: str(s.heading), text: str(s.text) }))
      .filter((s) => s.text),
    faqs: list(raw.faqs)
      .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
      .filter((f) => f.question && f.answer),
    posts: list(raw.posts)
      .map((p) => ({ slug: str(p.slug), title: str(p.title), intro: str(p.intro) }))
      .filter((p) => p.slug),
    // The same shape as a post's places, so read them the same way.
    places: readPost("", { places: raw.places }).places,
  };
}

const files = import.meta.glob<Record<string, unknown>>("/content/airports/*.json", { eager: true, query: "?airport", import: "default" });

/** Every published airport guide in full, A to Z. */
export const AIRPORTS: Airport[] = Object.entries(files)
  .map(([path, raw]) => readAirport(slugOf(path), raw))
  .filter((a) => a.published && a.code)
  .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

export function findAirport(slug: string): Airport | undefined {
  return AIRPORTS.find((a) => a.slug === slug);
}

/** An airport guide's title in search results. */
export function airportSearchTitle(a: Airport): string {
  return `${a.seo_title || `${a.name}: terminals, airlines and getting there`} | somewhere🎉`;
}

/** Title, description and search-result data for an airport guide. `updated` is when its words last changed, as an ISO date, if known. */
export function airportMeta(a: Airport, updated?: string): Meta {
  const url = SITE + airportPath(a.slug);
  const description = a.seo_description || a.intro;
  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: a.title,
      description,
      url,
      ...(updated ? { dateModified: updated } : {}),
      isPartOf: { "@type": "WebSite", name: "somewhere🎉", url: `${SITE}/` },
      about: { "@type": "Airport", name: a.name, iataCode: a.code },
      ...(a.posts.length ? { relatedLink: a.posts.map((p) => SITE + postPath(p.slug)) } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Airports", item: `${SITE}/airports` },
        { "@type": "ListItem", position: 3, name: a.name, item: url },
      ],
    },
  ];
  if (a.faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    });
  }
  return { path: airportPath(a.slug), title: airportSearchTitle(a), description, index: true, jsonLd };
}

/** The airports index's search-result data: the fixed page's words plus the list of guides. */
export function airportsJsonLd(): unknown[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Airport guides",
      description: PAGES.airports.description,
      url: SITE + PAGES.airports.path,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: AIRPORTS.length,
        itemListElement: AIRPORTS.map((a, i) => ({ "@type": "ListItem", position: i + 1, name: a.name, url: SITE + airportPath(a.slug) })),
      },
    },
  ];
}
