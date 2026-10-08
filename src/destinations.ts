// Destination guides. Each one is a JSON file in content/destinations, written in the editor at
// /admin (public/admin/config.yml says which fields it has). They're bundled at build time, so the
// guides are prerendered like the other public pages and need no database or API.
import { HOLIDAY_TYPES, TRIP_LENGTHS, BUDGETS } from "../shared/ideaDetails";
import { distanceKm, flightHours } from "../shared/travelTime";
import { countryName } from "./countries";
import geo from "../content/destinations-geo.json";
import type { HolidayType, TripLength } from "../shared/ideaDetails";
import { SITE, destinationPath } from "../shared/seo";
import type { Meta } from "../shared/seo";
import type { IdeaInput, Place } from "../shared/types";

export const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
export type MonthRating = "best" | "good" | "quiet";

export interface Destination {
  slug: string;
  name: string;
  published: boolean;
  country: string;
  /** ISO 3166-1 alpha-2, upper case. The editor stores this; the name comes from it. */
  country_code: string;
  /** Found from the name and country when the site builds (scripts/geocode-destinations.mjs). */
  lat: number | null;
  lon: number | null;
  title: string;
  /** Also the description Google shows. */
  intro: string;
  /** A path under /images/destinations, or empty. */
  image: string;
  image_alt: string;
  to_code: string;
  holiday_types: HolidayType[];
  nights: string;
  trip_length: TripLength | null;
  budget: number | null;
  facts: { label: string; value: string; highlight: boolean }[];
  facts_note: string;
  months: { code: string; rating: MonthRating; note: string }[];
  when_to_go: string;
  things: { tag: string; name: string; blurb: string; image: string; image_alt: string }[];
  faqs: { question: string; answer: string }[];
  similar: { name: string; code: string; label: string }[];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];

// Everyday names where the standard list uses the formal one ("Russian Federation"). The editor's
// country dropdown in public/admin/config.yml uses the same names; a test keeps the two in step.
const EVERYDAY_NAMES: Record<string, string> = {
  CN: "China",
  CD: "Democratic Republic of the Congo",
  CG: "Congo",
  CI: "Côte d'Ivoire",
  GM: "The Gambia",
  IR: "Iran",
  MK: "North Macedonia",
  PS: "Palestine",
  RU: "Russia",
  TW: "Taiwan",
  TZ: "Tanzania",
  TR: "Turkey",
  US: "United States",
};

export function destinationCountry(code: string): string {
  return EVERYDAY_NAMES[code] ?? countryName(code);
}

type Geo = Record<string, { query: string; lat: number; lon: number } | undefined>;

/** Turns a file from the editor into a guide, filling gaps rather than breaking the build over a missing field. */
export function readDestination(slug: string, raw: Record<string, unknown>, positions: Geo = geo): Destination {
  const name = str(raw.name) || slug;
  // The editor stores the country as its code. Older guides had the name and code separately.
  const code = (/^[A-Za-z]{2}$/.test(str(raw.country)) ? str(raw.country) : str(raw.country_code)).toUpperCase();
  const position = positions[slug]?.query === `${name}|${code}` ? positions[slug] : undefined;
  const months = (raw.months && typeof raw.months === "object" ? raw.months : {}) as Record<string, Record<string, unknown> | undefined>;
  return {
    slug,
    name,
    published: raw.published === true,
    country: code ? destinationCountry(code) : str(raw.country),
    country_code: code,
    lat: position?.lat ?? num(raw.lat),
    lon: position?.lon ?? num(raw.lon),
    title: str(raw.title) || `Family holidays in ${name}`,
    intro: str(raw.intro),
    image: str(raw.image),
    image_alt: str(raw.image_alt),
    to_code: str(raw.to_code).toUpperCase(),
    holiday_types: (Array.isArray(raw.holiday_types) ? raw.holiday_types : []).filter((t): t is HolidayType =>
      HOLIDAY_TYPES.some((x) => x.key === t),
    ),
    nights: str(raw.nights),
    trip_length: TRIP_LENGTHS.find((x) => x.key === raw.trip_length)?.key ?? null,
    budget: BUDGETS.find((x) => x.key === raw.budget)?.key ?? null,
    facts: list(raw.facts)
      .map((f) => ({ label: str(f.label), value: str(f.value), highlight: f.highlight === true }))
      .filter((f) => f.label && f.value),
    facts_note: str(raw.facts_note),
    months: MONTHS.map((code) => {
      const m = months[code] ?? {};
      const rating = m.rating === "best" || m.rating === "good" ? m.rating : "quiet";
      return { code: code.toUpperCase(), rating, note: str(m.note) };
    }),
    when_to_go: str(raw.when_to_go),
    things: list(raw.things)
      .map((t) => ({ tag: str(t.tag), name: str(t.name), blurb: str(t.blurb), image: str(t.image), image_alt: str(t.image_alt) }))
      .filter((t) => t.name),
    faqs: list(raw.faqs)
      .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
      .filter((f) => f.question && f.answer),
    similar: list(raw.similar)
      .map((s) => ({ name: str(s.name), code: str(s.code).toUpperCase(), label: str(s.label) }))
      .filter((s) => s.name),
  };
}

const files = import.meta.glob<Record<string, unknown>>("/content/destinations/*.json", { eager: true, import: "default" });

/** Every published guide, A to Z. Unpublished ones stay in the editor and off the site. */
export const DESTINATIONS: Destination[] = Object.entries(files)
  .map(([path, raw]) => readDestination(path.replace(/^.*\/|\.json$/g, ""), raw))
  .filter((d) => d.published)
  .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

export function findDestination(slug: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.slug === slug);
}

/** The guide for a place name, so "If you like…" can link to guides that exist. */
export function destinationNamed(name: string): Destination | undefined {
  const key = name.toLowerCase();
  return DESTINATIONS.find((d) => d.name.toLowerCase() === key);
}

export function imageUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : SITE + (path.startsWith("/") ? path : `/${path}`);
}

/** Where visitors who aren't signed in are flying from. Signed-in families see their own home airport. */
export const LONDON = { code: "LON", name: "London", lat: 51.47, lon: -0.4543 };

/** Rough flying hours to a guide's place, rounded up as timetables tend to be longer than the straight line. Null without a map position. */
export function flightHoursTo(from: { lat: number | null; lon: number | null }, d: Destination): number | null {
  if (from.lat === null || from.lon === null || d.lat === null || d.lon === null) return null;
  return Math.max(1, Math.ceil(flightHours(distanceKm({ lat: from.lat, lon: from.lon }, { lat: d.lat, lon: d.lon }))));
}

/** The flight time as the guide says it: "About 8 hrs". */
export function flightTime(from: { lat: number | null; lon: number | null }, d: Destination): string | null {
  const hours = flightHoursTo(from, d);
  return hours === null ? null : `About ${hours} hr${hours === 1 ? "" : "s"}`;
}

/** A country's flag, from its two-letter code. */
export function countryFlag(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";
}

/** The first sentence of a guide's introduction, for its card in the list of guides. */
export function shortIntro(d: Destination): string {
  return d.intro.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? d.intro;
}

/** The best months to go, from the month-by-month ratings: "Apr–Jun, Sep–Oct". Runs can wrap past December. */
export function bestMonths(d: Destination): string {
  const best = d.months.map((m) => m.rating === "best");
  if (!best.some(Boolean)) return "";
  if (best.every(Boolean)) return "All year";
  const label = (i: number) => d.months[i].code.charAt(0) + d.months[i].code.slice(1).toLowerCase();
  // Start just after a month that isn't "best", so a run like Nov–Feb stays in one piece.
  const start = (best.indexOf(false) + 1) % 12;
  const runs: [number, number][] = [];
  for (let k = 0; k < 12; k++) {
    const i = (start + k) % 12;
    if (!best[i]) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === (i + 11) % 12) last[1] = i;
    else runs.push([i, i]);
  }
  runs.sort((a, b) => a[0] - b[0]);
  return runs.map(([a, b]) => (a === b ? label(a) : `${label(a)}–${label(b)}`)).join(", ");
}

/** The place a guide is about, as the idea and trip forms want it. */
export function destinationPlace(d: Destination): Place {
  return { name: d.name, country: d.country, country_code: d.country_code, lat: d.lat, lon: d.lon };
}

/** What "Add to ideas" fills the new idea form with. Everything stays editable there. */
export function ideaFromDestination(d: Destination): Partial<IdeaInput> {
  return {
    title: d.name,
    places: [destinationPlace(d)],
    cover_url: d.image ? imageUrl(d.image) : null,
    budget: d.budget,
    trip_length: d.trip_length,
    holiday_types: d.holiday_types,
  };
}

/** Title, description, share image and search-result data for a guide's page. */
export function destinationMeta(d: Destination): Meta {
  const url = SITE + destinationPath(d.slug);
  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      name: d.name,
      description: d.intro,
      url,
      ...(d.image ? { image: imageUrl(d.image) } : {}),
      ...(d.lat !== null && d.lon !== null ? { geo: { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lon } } : {}),
      ...(d.country ? { containedInPlace: { "@type": "Country", name: d.country } } : {}),
      ...(d.things.length ? { includesAttraction: d.things.map((t) => ({ "@type": "TouristAttraction", name: t.name, description: t.blurb })) } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Guides", item: `${SITE}/destinations` },
        { "@type": "ListItem", position: 2, name: d.name, item: url },
      ],
    },
  ];
  if (d.faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: d.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    });
  }
  return {
    path: destinationPath(d.slug),
    title: `${d.title} | somewhere🎉`,
    description: d.intro,
    index: true,
    image: d.image ? imageUrl(d.image) : undefined,
    imageAlt: d.image_alt || undefined,
    jsonLd,
  };
}
