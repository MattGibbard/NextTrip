// Just enough about every guide to link to it, for the footer on every public page. The guides' cards
// (src/destinations.ts) are much bigger, so pages that only link to a few guides don't carry them.

export interface GuideLink {
  slug: string;
  name: string;
  country_code: string;
}

const links = import.meta.glob<Record<string, unknown>>("/content/destinations/*.json", { eager: true, query: "?link", import: "default" });

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Every published guide, A to Z. Read the same way as the guides' cards (readDestination). */
export const GUIDE_LINKS: GuideLink[] = Object.entries(links)
  .filter(([, raw]) => raw.published === true)
  .map(([path, raw]) => {
    const slug = path.replace(/^.*\/|\.json(\?.*)?$/g, "");
    const code = /^[A-Za-z]{2}$/.test(str(raw.country)) ? str(raw.country) : str(raw.country_code);
    return { slug, name: str(raw.name) || slug, country_code: code.toUpperCase() };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

/** A country's flag, from its two-letter code. */
export function countryFlag(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";
}
