// Hub pages: one page for a kind of holiday ("Beach holidays"), a country ("Holidays in Spain"), a
// month ("Where to go on holiday in February") or a hand-picked collection ("Christmas holidays"), listing every guide that fits. Each is a JSON file in content/hubs, written in the editor at /admin.
// They live at /destinations/<slug>, next to the guides, so a hub's slug must not be a guide's.
// The guides on a hub come from the guides themselves, so a new beach guide joins the beach hub by itself,
// and a new guide rated "best" for February joins the February page. A collection lists the guides the editor picked.
import { HOLIDAY_TYPES } from "../shared/ideaDetails";
import type { HolidayType } from "../shared/ideaDetails";
import { SITE, destinationPath } from "../shared/seo";
import type { Meta } from "../shared/seo";
import { DESTINATIONS, MONTHS, countryFlag, destinationCountry, findDestination, flightHoursTo, imageUrl } from "./destinations";
import type { DestinationCard } from "./destinations";

export type HubKind = "type" | "country" | "month" | "collection";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface Hub {
  slug: string;
  published: boolean;
  kind: HubKind;
  /** For a holiday type hub. */
  holiday_type: HolidayType | null;
  /** For a country hub, ISO 3166-1 alpha-2, upper case. */
  country_code: string;
  /** For a month hub, its number (0 is January). A collection can have one too, when it's about a time of year. */
  month: number | null;
  /** For a collection, the slugs of the guides it lists. */
  guides: string[];
  /** For a collection, the emoji on its links. */
  icon: string;
  /** What links to the hub say: "Beach holidays", "Spain". */
  name: string;
  /** The page heading. */
  title: string;
  /** Also the description Google shows, unless seo_description is set. */
  intro: string;
  seo_title: string;
  seo_description: string;
  /** Longer writing under the guides, in the same form as a blog post's sections. */
  sections: { heading: string; text: string }[];
  faqs: { question: string; answer: string }[];
}

/** What every page knows about each hub: enough to link to it. Its words load on its own page. */
export type HubCard = Omit<Hub, "intro" | "seo_description" | "sections" | "faqs">;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Turns a file from the editor into a hub, filling gaps rather than breaking the build over a missing field. */
export function readHub(slug: string, raw: Record<string, unknown>): Hub {
  const holiday_type = HOLIDAY_TYPES.find((t) => t.key === raw.holiday_type)?.key ?? null;
  const code = /^[A-Za-z]{2}$/.test(str(raw.country)) ? str(raw.country).toUpperCase() : "";
  const kind: HubKind = raw.kind === "country" || raw.kind === "month" || raw.kind === "collection" ? raw.kind : "type";
  const type = HOLIDAY_TYPES.find((t) => t.key === holiday_type);
  const m = MONTHS.indexOf(str(raw.month).toLowerCase() as (typeof MONTHS)[number]);
  const month = (kind === "month" || kind === "collection") && m >= 0 ? m : null;
  const name =
    str(raw.name) ||
    (kind === "country" ? (code ? destinationCountry(code) : slug) : kind === "month" ? (month !== null ? MONTH_NAMES[month] : slug) : type ? `${type.label} holidays` : slug);
  return {
    slug,
    published: raw.published === true,
    kind,
    holiday_type: kind === "type" ? holiday_type : null,
    country_code: kind === "country" ? code : "",
    month,
    guides: kind === "collection" && Array.isArray(raw.guides) ? [...new Set(raw.guides.map(str).filter(Boolean))] : [],
    icon: kind === "collection" ? str(raw.icon) : "",
    name,
    title: str(raw.title) || (kind === "country" ? `Holidays in ${name}` : kind === "month" ? `Where to go on holiday in ${name}` : name),
    intro: str(raw.intro),
    seo_title: str(raw.seo_title),
    seo_description: str(raw.seo_description),
    sections: (Array.isArray(raw.sections) ? raw.sections : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({ heading: str(x.heading), text: str(x.text) }))
      .filter((x) => x.text),
    faqs: (Array.isArray(raw.faqs) ? raw.faqs : [])
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
      .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
      .filter((f) => f.question && f.answer),
  };
}

/** The guides a hub lists, A to Z. A month lists the guides at their best that month, a collection the ones picked for it. */
export function hubGuides(h: HubCard): DestinationCard[] {
  if (h.kind === "collection") return DESTINATIONS.filter((d) => h.guides.includes(d.slug));
  if (h.kind === "month") return h.month === null ? [] : DESTINATIONS.filter((d) => d.months[h.month!]?.rating === "best");
  return DESTINATIONS.filter((d) => (h.kind === "country" ? d.country_code === h.country_code : !!h.holiday_type && d.holiday_types.includes(h.holiday_type)));
}

/** For a month: the guides rated "good" that month, the next best thing, A to Z. */
export function alsoGood(h: HubCard): DestinationCard[] {
  return h.kind === "month" && h.month !== null ? DESTINATIONS.filter((d) => d.months[h.month!]?.rating === "good") : [];
}

/** How long a flight counts as near, for a month's "Where's hot" list. */
export const NEAR_HOURS = 5;

/**
 * For a month: the warmest places that are at their best or good that month, by average daytime high,
 * split into those within NEAR_HOURS of `from` and those further away. Warmest first, `per` of each.
 */
export function hotList(h: HubCard, from: { lat: number | null; lon: number | null }, per = 6) {
  if (h.kind !== "month" || h.month === null) return { near: [], far: [] };
  const m = h.month;
  const rows = DESTINATIONS.filter((d) => d.months[m]?.rating !== "quiet" && d.months[m]?.temp != null)
    .map((d) => ({ d, temp: d.months[m].temp!, hours: flightHoursTo(from, d) }))
    .sort((a, b) => b.temp - a.temp || a.d.name.localeCompare(b.d.name, "en-GB"));
  const near = rows.filter((r) => r.hours !== null && r.hours <= NEAR_HOURS).slice(0, per);
  const far = rows.filter((r) => r.hours === null || r.hours > NEAR_HOURS).slice(0, per);
  return { near, far };
}

/** What a hub is about, for its links: a holiday type's icon, a country's flag, the month's season or a collection's own emoji. */
export function hubIcon(h: HubCard): string {
  if (h.kind === "collection") return h.icon;
  if (h.kind === "type") return HOLIDAY_TYPES.find((t) => t.key === h.holiday_type)?.icon ?? "";
  if (h.kind === "month") return h.month === null ? "" : ["❄️", "❄️", "🌷", "🌷", "🌷", "☀️", "☀️", "☀️", "🍂", "🍂", "🍂", "❄️"][h.month];
  return countryFlag(h.country_code);
}

const slugOf = (path: string) => path.replace(/^.*\/|\.json(\?.*)?$/g, "");

// Only what links need (scripts/destination-cards.mjs); each hub's words are fetched on its page.
const cards = import.meta.glob<Record<string, unknown>>("/content/hubs/*.json", { eager: true, query: "?card", import: "default" });
const files = import.meta.glob<Record<string, unknown>>("/content/hubs/*.json", { import: "default" });

const KIND_ORDER: HubKind[] = ["type", "month", "collection", "country"];
const fits = (h: Hub) =>
  h.kind === "country" ? !!h.country_code : h.kind === "month" ? h.month !== null : h.kind === "collection" ? h.guides.length > 0 : !!h.holiday_type;

/**
 * Every published hub with at least one guide: holiday types in the usual order, then months, then collections
 * (in order through the year, those without a month last) and countries A to Z.
 * A slug that's also a guide's goes to the guide, so such a hub is left out.
 */
export const HUBS: HubCard[] = Object.entries(cards)
  .map(([path, raw]) => readHub(slugOf(path), raw))
  .filter((h) => h.published && fits(h) && !findDestination(h.slug) && hubGuides(h).length > 0)
  .sort((a, b) =>
    a.kind !== b.kind
      ? KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
      : a.kind === "type"
        ? HOLIDAY_TYPES.findIndex((t) => t.key === a.holiday_type) - HOLIDAY_TYPES.findIndex((t) => t.key === b.holiday_type)
        : a.kind === "month"
          ? a.month! - b.month!
          : a.kind === "collection" && a.month !== b.month
            ? (a.month ?? 12) - (b.month ?? 12)
            : a.name.localeCompare(b.name, "en-GB"),
  );

export function findHub(slug: string): HubCard | undefined {
  return HUBS.find((h) => h.slug === slug);
}

/** The hub for a kind of holiday, if there is one. */
export function typeHub(key: string): HubCard | undefined {
  return HUBS.find((h) => h.kind === "type" && h.holiday_type === key);
}

/** The page for a month (0 is January), if there is one. */
export function monthHub(month: number): HubCard | undefined {
  return HUBS.find((h) => h.kind === "month" && h.month === month);
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

/** A hub's title in search results: the editor's own, or "Beach holidays: where to go and when" (just the heading for a month or a collection). */
export function hubSearchTitle(h: HubCard): string {
  return `${h.seo_title || (h.kind === "month" || h.kind === "collection" ? h.title : `${h.title}: where to go and when`)} | somewhere🎉`;
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
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Destinations", item: `${SITE}/destinations` },
        { "@type": "ListItem", position: 3, name: h.name, item: url },
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
    imageSize: pic?.image_size ?? undefined,
    jsonLd,
  };
}
