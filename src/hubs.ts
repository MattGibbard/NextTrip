// Hub pages: one page for a kind of holiday ("Beach holidays") or a country ("Holidays in Spain"),
// listing every guide that fits. Each is a JSON file in content/hubs, written in the editor at /admin.
// They live at /destinations/<slug>, next to the guides, so a hub's slug must not be a guide's.
// The guides on a hub come from the guides themselves, so a new beach guide joins the beach hub by itself.
import { HOLIDAY_TYPES } from "../shared/ideaDetails";
import type { HolidayType } from "../shared/ideaDetails";
import { SITE, destinationPath } from "../shared/seo";
import type { Meta } from "../shared/seo";
import { DESTINATIONS, destinationCountry, findDestination, imageUrl } from "./destinations";
import type { DestinationCard } from "./destinations";

export type HubKind = "type" | "country";

export interface Hub {
  slug: string;
  published: boolean;
  kind: HubKind;
  /** For a holiday type hub. */
  holiday_type: HolidayType | null;
  /** For a country hub, ISO 3166-1 alpha-2, upper case. */
  country_code: string;
  /** What links to the hub say: "Beach holidays", "Spain". */
  name: string;
  /** The page heading. */
  title: string;
  /** Also the description Google shows, unless seo_description is set. */
  intro: string;
  seo_title: string;
  seo_description: string;
  faqs: { question: string; answer: string }[];
}

/** What every page knows about each hub: enough to link to it. Its words load on its own page. */
export type HubCard = Omit<Hub, "intro" | "seo_description" | "faqs">;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Turns a file from the editor into a hub, filling gaps rather than breaking the build over a missing field. */
export function readHub(slug: string, raw: Record<string, unknown>): Hub {
  const holiday_type = HOLIDAY_TYPES.find((t) => t.key === raw.holiday_type)?.key ?? null;
  const code = /^[A-Za-z]{2}$/.test(str(raw.country)) ? str(raw.country).toUpperCase() : "";
  const kind: HubKind = raw.kind === "country" ? "country" : "type";
  const type = HOLIDAY_TYPES.find((t) => t.key === holiday_type);
  const name = str(raw.name) || (kind === "country" ? (code ? destinationCountry(code) : slug) : type ? `${type.label} holidays` : slug);
  return {
    slug,
    published: raw.published === true,
    kind,
    holiday_type: kind === "type" ? holiday_type : null,
    country_code: kind === "country" ? code : "",
    name,
    title: str(raw.title) || (kind === "country" ? `Holidays in ${name}` : name),
    intro: str(raw.intro),
    seo_title: str(raw.seo_title),
    seo_description: str(raw.seo_description),
    faqs: (Array.isArray(raw.faqs) ? raw.faqs : [])
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
      .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
      .filter((f) => f.question && f.answer),
  };
}

/** The guides a hub lists, A to Z. */
export function hubGuides(h: HubCard): DestinationCard[] {
  return DESTINATIONS.filter((d) => (h.kind === "country" ? d.country_code === h.country_code : !!h.holiday_type && d.holiday_types.includes(h.holiday_type)));
}

const slugOf = (path: string) => path.replace(/^.*\/|\.json(\?.*)?$/g, "");

// Only what links need (scripts/destination-cards.mjs); each hub's words are fetched on its page.
const cards = import.meta.glob<Record<string, unknown>>("/content/hubs/*.json", { eager: true, query: "?card", import: "default" });
const files = import.meta.glob<Record<string, unknown>>("/content/hubs/*.json", { import: "default" });

/**
 * Every published hub with at least one guide: holiday types in the usual order, then countries A to Z.
 * A slug that's also a guide's goes to the guide, so such a hub is left out.
 */
export const HUBS: HubCard[] = Object.entries(cards)
  .map(([path, raw]) => readHub(slugOf(path), raw))
  .filter((h) => h.published && (h.kind === "country" ? !!h.country_code : !!h.holiday_type) && !findDestination(h.slug) && hubGuides(h).length > 0)
  .sort((a, b) =>
    a.kind !== b.kind
      ? a.kind === "type"
        ? -1
        : 1
      : a.kind === "type"
        ? HOLIDAY_TYPES.findIndex((t) => t.key === a.holiday_type) - HOLIDAY_TYPES.findIndex((t) => t.key === b.holiday_type)
        : a.name.localeCompare(b.name, "en-GB"),
  );

export function findHub(slug: string): HubCard | undefined {
  return HUBS.find((h) => h.slug === slug);
}

/** The hub for a kind of holiday, if there is one. */
export function typeHub(key: string): HubCard | undefined {
  return HUBS.find((h) => h.kind === "type" && h.holiday_type === key);
}

/** The hub for a country, if there is one. */
export function countryHub(code: string): HubCard | undefined {
  return HUBS.find((h) => h.kind === "country" && h.country_code === code);
}

const loaded = new Map<string, Hub>();

/** A published hub in full, once loadHub() has fetched it. */
export function loadedHub(slug: string): Hub | undefined {
  return loaded.get(slug);
}

/** Fetches a published hub in full. Undefined when there's no such hub. */
export async function loadHub(slug: string): Promise<Hub | undefined> {
  const load = findHub(slug) && files[`/content/hubs/${slug}.json`];
  if (!load) return undefined;
  const h = loaded.get(slug) ?? readHub(slug, await load());
  loaded.set(slug, h);
  return h;
}

/** A hub's title in search results: the editor's own, or "Beach holidays: where to go and when". */
export function hubSearchTitle(h: HubCard): string {
  return `${h.seo_title || `${h.title}: where to go and when`} | somewhere🎉`;
}

/** Title, description and search-result data for a hub's page. `updated` is when its words last changed, as an ISO date, if known. */
export function hubMeta(h: Hub, updated?: string): Meta {
  const description = h.seo_description || h.intro;
  const url = SITE + destinationPath(h.slug);
  const guides = hubGuides(h);
  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: h.title,
      description,
      url,
      ...(updated ? { dateModified: updated } : {}),
      isPartOf: { "@type": "WebSite", name: "somewhere🎉", url: `${SITE}/` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: guides.length,
        itemListElement: guides.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: d.name, url: SITE + destinationPath(d.slug) })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inspire", item: `${SITE}/destinations` },
        { "@type": "ListItem", position: 2, name: h.name, item: url },
      ],
    },
  ];
  if (h.faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: h.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    });
  }
  // A guide's photo makes a better share image than the site's own.
  const pic = guides.find((d) => d.image);
  return {
    path: destinationPath(h.slug),
    title: hubSearchTitle(h),
    description,
    index: true,
    image: pic ? imageUrl(pic.image) : undefined,
    imageAlt: pic?.image_alt || undefined,
    jsonLd,
  };
}
