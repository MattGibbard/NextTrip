// Where a trip or idea sets off from and arrives at: an airport, a station or a cruise port.
// These sit apart from the trip's places, which are the cities you visit.
import type { Mode } from "./travelMode";

export type TerminalKind = "airport" | "station" | "port";

export interface Terminal {
  kind: TerminalKind;
  /** The official code: IATA for airports, CRS in the UK or Benerail in Europe for stations. Ports have none. */
  code: string | null;
  name: string;
  /** ISO 3166-1 alpha-2, upper case. */
  country_code: string;
  lat: number | null;
  lon: number | null;
}

/** A row of the bundled lists: code, name, city, country, lat, lon. */
export type TerminalRow = [string, string, string, string, number, number];

export interface TerminalSearchResult {
  label: string;
  terminal: Terminal;
}

/** What each mode leaves from and arrives at. Cruises come back to where they set off, so there's no arrival. */
export const ENDS: Record<Mode, { kind: TerminalKind; depart: string; arrive: string | null }> = {
  flight: { kind: "airport", depart: "Departure airport", arrive: "Arrival airport" },
  train: { kind: "station", depart: "Departure station", arrive: "Arrival station" },
  cruise: { kind: "port", depart: "Embarking port", arrive: null },
  road: { kind: "airport", depart: "Flying out from", arrive: "Landing at" },
};

export const CODE_PATTERN: Record<TerminalKind, RegExp | null> = {
  airport: /^[A-Z]{3}$/,
  station: /^[A-Z]{3,5}$/,
  port: null,
};

export function rowToTerminal(kind: TerminalKind, [code, name, , country_code, lat, lon]: TerminalRow): Terminal {
  return { kind, code, name, country_code, lat, lon };
}

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Finds airports or stations by code or name. An exact code comes first, then
 * codes starting with the search, then names or cities with a word starting with it.
 */
export function searchTerminals(kind: TerminalKind, rows: readonly TerminalRow[], query: string, limit = 8): TerminalSearchResult[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const upper = q.toUpperCase();
  const scored: [number, number, TerminalRow][] = [];
  rows.forEach((r, i) => {
    let score: number | null = null;
    if (r[0] === upper) score = 0;
    else if (r[0].startsWith(upper)) score = 1;
    else {
      const words = fold(`${r[1]} ${r[2]}`);
      if (words.startsWith(q)) score = 2;
      else if (words.includes(` ${q}`) || words.includes(`-${q}`)) score = 3;
    }
    // Rows are stored biggest first, so the index breaks ties.
    if (score !== null) scored.push([score, i, r]);
  });
  return scored
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .slice(0, limit)
    .map(([, , r]) => ({ label: `${r[0]} · ${r[1]}${r[2] && !r[1].includes(r[2]) ? `, ${r[2]}` : ""}`, terminal: rowToTerminal(kind, r) }));
}

type LatLon = [number, number];

function at(p: { lat: number | null; lon: number | null } | null | undefined): LatLon | null {
  return p && p.lat !== null && p.lon !== null ? [p.lat, p.lon] : null;
}

/**
 * The dotted legs to and from a trip's places. Flights and trains go departure to
 * arrival. A cruise sails from its port to the first place. A road trip flies
 * airport to airport, then flies home from the last place to where it set off.
 */
export function journeyLegs(
  mode: Mode,
  depart: Terminal | null,
  arrive: Terminal | null,
  places: { lat: number | null; lon: number | null }[],
): [LatLon, LatLon][] {
  const from = at(depart);
  if (!from) return [];
  const located = places.map(at).filter((p): p is LatLon => p !== null);
  const legs: [LatLon, LatLon][] = [];
  if (mode === "cruise") {
    if (located[0]) legs.push([from, located[0]]);
    return legs;
  }
  const to = at(arrive);
  if (to) legs.push([from, to]);
  if (mode === "road" && located.length > 0) legs.push([located[located.length - 1], from]);
  return legs;
}

/** Drops a departure or arrival that doesn't fit the mode, such as an airport on a cruise. */
export function endsForMode(mode: Mode, depart: Terminal | null, arrive: Terminal | null) {
  const { kind, arrive: hasArrival } = ENDS[mode];
  return {
    depart: depart?.kind === kind ? depart : null,
    arrive: hasArrival && arrive?.kind === kind ? arrive : null,
  };
}
