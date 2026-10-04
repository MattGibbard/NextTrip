import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import type { Place } from "../shared/types";

countries.registerLocale(en);

export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
}

export function alpha2FromNumeric(numeric: string): string | undefined {
  return countries.numericToAlpha2(numeric);
}

export function countryName(alpha2: string): string {
  return countries.getName(alpha2, "en") ?? alpha2;
}

/** ISO numeric code as used by the world-atlas map ids ("040" for Austria). */
export function numericCode(alpha2: string): string | undefined {
  return countries.alpha2ToNumeric(alpha2);
}

export interface CountrySummary {
  code: string;
  name: string;
  cities: { name: string; count: number }[];
  visits: number;
}

/** Groups places into countries, counting how many entries mention each city. */
export function summarise(groups: Place[][]): CountrySummary[] {
  const byCountry = new Map<string, { name: string; cities: Map<string, number>; visits: number }>();
  for (const places of groups) {
    const countedHere = new Set<string>();
    for (const p of places) {
      const entry = byCountry.get(p.country_code) ?? { name: p.country, cities: new Map(), visits: 0 };
      if (!countedHere.has(p.country_code)) {
        entry.visits++;
        countedHere.add(p.country_code);
      }
      entry.cities.set(p.name, (entry.cities.get(p.name) ?? 0) + 1);
      byCountry.set(p.country_code, entry);
    }
  }
  return [...byCountry.entries()]
    .map(([code, e]) => ({
      code,
      name: e.name,
      visits: e.visits,
      cities: [...e.cities.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function countryOptions(): { code: string; name: string }[] {
  return Object.entries(countries.getNames("en", { select: "official" }))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
