import airportRows from "../shared/data/airports.json";
import stationRows from "../shared/data/stations.json";
import { CODE_PATTERN, nearestTerminal, rowToTerminal, searchTerminals } from "../shared/terminals";
import type { Terminal, TerminalKind, TerminalRow } from "../shared/terminals";

const ROWS: Record<"airport" | "station", readonly TerminalRow[]> = {
  airport: airportRows as TerminalRow[],
  station: stationRows as TerminalRow[],
};

let byCode: Record<"airport" | "station", Map<string, TerminalRow>> | null = null;

function lookup(kind: "airport" | "station", code: string) {
  byCode ??= {
    airport: new Map(ROWS.airport.map((r) => [r[0], r])),
    station: new Map(ROWS.station.map((r) => [r[0], r])),
  };
  return byCode[kind].get(code);
}

export function findTerminals(kind: "airport" | "station", q: string) {
  return searchTerminals(kind, ROWS[kind], q);
}

/** The airport closest to a place, for flight searches to ideas without an arrival airport. */
export function nearestAirport(lat: number, lon: number) {
  return nearestTerminal("airport", ROWS.airport, lat, lon);
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

/**
 * A departure or arrival from user input or a stored column. Airports and stations
 * must carry an official code from the bundled lists and take their name and
 * location from there; a port is any named place.
 */
export function cleanTerminal(v: unknown): Terminal | null {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  const kind = t.kind as TerminalKind;
  if (kind === "airport" || kind === "station") {
    const code = text(t.code, 5)?.toUpperCase();
    const row = code && CODE_PATTERN[kind]!.test(code) ? lookup(kind, code) : undefined;
    return row ? rowToTerminal(kind, row) : null;
  }
  if (kind !== "port") return null;
  const name = text(t.name, 200);
  const country = text(t.country_code, 2)?.toUpperCase();
  if (!name || !country || !/^[A-Z]{2}$/.test(country)) return null;
  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  return { kind, code: null, name, country_code: country, lat: num(t.lat), lon: num(t.lon) };
}
