// Where a visitor flies from, so the public pages can give flight times, "From" codes and budget
// symbols for them rather than for London. The Worker works it out from Cloudflare's location for
// the request (or the visitor's own "Flying from" choice) and writes it into the prerendered page
// as it goes out (worker/visitor.ts). The page's code then draws the same words from the same hint,
// so React picks the page up without redrawing it.
import { currencyFor } from "./currency";
import { distanceKm, flightHours } from "./travelTime";

/** An airport to fly from, with the currency prices show in for whoever flies from it. */
export interface From {
  code: string;
  name: string;
  lat: number;
  lon: number;
  currency: string;
}

/** Where visitors fly from when we don't know: anyone the Worker can't place, search engines, and the prerendered pages. */
export const LONDON: From = { code: "LON", name: "London", lat: 51.47, lon: -0.4543, currency: "GBP" };

/** The cookie that keeps a visitor's own "Flying from" choice: an airport code from MAIN_AIRPORTS. */
export const FROM_COOKIE = "from";

/** Rough flying hours between two points, rounded up as timetables tend to be longer than the straight line. */
export function flightHoursBetween(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  return Math.max(1, Math.ceil(flightHours(distanceKm(from, to))));
}

/** "About 8 hrs". */
export function aboutHours(hours: number): string {
  return `About ${hours} hr${hours === 1 ? "" : "s"}`;
}

/** The budget symbol for a currency: £, €, $ and so on. Currencies without a well-known one use $. */
export function budgetSymbol(currency: string): string {
  return SYMBOLS[currency] ?? "$";
}
const SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", JPY: "¥", CNY: "¥", INR: "₹", KRW: "₩", ILS: "₪", TRY: "₺", PHP: "₱", VND: "₫", THB: "฿", UAH: "₴", NGN: "₦" };

/** £ to £££ (or $ to $$$) for a budget of 1 to 3. */
export function budgetText(level: number, currency: string): string {
  return budgetSymbol(currency).repeat(level);
}

/** The board heading: "FROM THE UK" for London, as the guides have always said, otherwise the airport code. */
export function fromLabel(from: From): string {
  return from.code === LONDON.code ? "FROM THE UK" : `FROM ${from.code}`;
}

/** The ways a flight time is written: on a card ("✈️ 3h"), a board row ("✈️ 3H"), a guide's ticket ("ABOUT 3 HRS ✈️") and its facts ("ABOUT 3 HRS"). */
export type HoursFormat = "pill" | "board" | "route" | "fact";

/**
 * One piece of a page that depends on where the visitor flies from, as it reads for `from`. Pages mark
 * these with data-geo (src/components/Geo.tsx) and the Worker rewrites them with this same function.
 * Null when there's nothing to write (a place without a map position).
 */
export function geoText(
  part: { geo: string; to?: { lat: number; lon: number } | null; fmt?: string | null; level?: number | null },
  from: From,
): string | null {
  switch (part.geo) {
    case "code":
      return from.code;
    case "name":
      return from.name;
    case "label":
      return fromLabel(from);
    case "fact-label":
      return `FLIGHT FROM ${from.name.toUpperCase()}`;
    case "budget":
      return part.level && part.level >= 1 && part.level <= 3 ? budgetText(part.level, from.currency) : null;
    case "hours": {
      if (!part.to) return null;
      const h = flightHoursBetween(from, part.to);
      if (part.fmt === "board") return `✈️ ${h}H`;
      if (part.fmt === "route") return `${aboutHours(h).toUpperCase()} ✈️`;
      if (part.fmt === "fact") return aboutHours(h).toUpperCase();
      return `✈️ ${h}h`;
    }
    default:
      return null;
  }
}

/**
 * The hint as the Worker writes it on the page's root (data-visitor): "MAN|Manchester|53.35|-2.28|GBP".
 * Names never hold a "|", and the short form keeps the attribute free of anything that needs escaping.
 */
export function writeHint(from: From): string {
  return [from.code, from.name, from.lat, from.lon, from.currency].join("|");
}

export function readHint(hint: string | null | undefined): From | null {
  const [code, name, lat, lon, currency] = (hint ?? "").split("|");
  const la = Number(lat);
  const lo = Number(lon);
  if (!/^[A-Z]{3}$/.test(code ?? "") || !name || !/^[A-Z]{3}$/.test(currency ?? "") || !lat || !lon || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return { code, name, lat: la, lon: lo, currency };
}

/** A family's home airport as a From, with prices in its country's currency. */
export function fromTerminal(t: { code: string | null; name: string; lat: number | null; lon: number | null; country_code: string } | null | undefined): From | null {
  if (!t?.code || t.lat === null || t.lon === null) return null;
  return { code: t.code, name: t.name, lat: t.lat, lon: t.lon, currency: currencyFor(t.country_code) };
}
