// Airport guides: one page per UK or Irish airport at /airports/<slug>, about its terminals, getting
// there and where you can fly, written in the editor at /admin (content/airports). Every page knows
// enough to link to them (scripts/destination-cards.mjs); their words are in src/airportPages.ts,
// which only the airport pages load.
import { airportPath } from "../shared/seo";

/** What every page knows about each airport guide. */
export interface AirportCard {
  slug: string;
  published: boolean;
  /** Its IATA code, e.g. MAN, the same as a blog post's `airport`. */
  code: string;
  /** "Manchester Airport". */
  name: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const slugOf = (path: string) => path.replace(/^.*\/|\.json(\?.*)?$/g, "");

/** The card fields of a file from the editor. */
export function readAirportCard(slug: string, raw: Record<string, unknown>): AirportCard {
  const code = str(raw.code).toUpperCase();
  return { slug, published: raw.published === true, code: /^[A-Z]{3}$/.test(code) ? code : "", name: str(raw.name) || slug };
}

const cards = import.meta.glob<Record<string, unknown>>("/content/airports/*.json", { eager: true, query: "?card", import: "default" });

/** Every published airport guide with a code, A to Z. */
export const AIRPORT_CARDS: AirportCard[] = Object.entries(cards)
  .map(([path, raw]) => readAirportCard(slugOf(path), raw))
  .filter((a) => a.published && a.code)
  .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

/** The guide to an airport, by its code (MAN), if there is one. */
export function airportGuide(code: string): (AirportCard & { path: string }) | undefined {
  const a = AIRPORT_CARDS.find((x) => x.code === code.toUpperCase());
  return a ? { ...a, path: airportPath(a.slug) } : undefined;
}
