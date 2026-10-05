// How a trip or idea gets you there. Each mode is drawn as its own kind of ticket.
import type { Terminal } from "./terminals";

export const MODES = {
  flight: { icon: "✈️", kind: "BOARDING PASS", label: "Flights", short: "Fly" },
  train: { icon: "🚆", kind: "RAIL TICKET", label: "Trains", short: "Train" },
  cruise: { icon: "🛳️", kind: "CRUISE PASS", label: "Cruises", short: "Cruise" },
  road: { icon: "🚗", kind: "ROAD TRIP", label: "Road trips", short: "Road trip" },
} as const;

export type Mode = keyof typeof MODES;
export const MODE_KEYS = Object.keys(MODES) as Mode[];

interface TripFlags {
  road_trip: boolean;
  cruise: boolean;
  rail: boolean;
}

/** A cruise wins over a road trip, which wins over a train; anything else is a flight. */
export function tripMode(t: TripFlags): Mode {
  if (t.cruise) return "cruise";
  if (t.road_trip) return "road";
  if (t.rail) return "train";
  return "flight";
}

/** The flags a trip stores for a mode. */
export function modeFlags(mode: Mode): TripFlags {
  return { cruise: mode === "cruise", road_trip: mode === "road", rail: mode === "train" };
}

export function ideaMode(holidayTypes: readonly string[]): Mode {
  return tripMode({ cruise: holidayTypes.includes("cruise"), road_trip: holidayTypes.includes("road-trip"), rail: holidayTypes.includes("rail") });
}

/**
 * A three-letter code for a place, like an airport code on a ticket: the first
 * three letters of its name ("Naples" → "NAP", "Ålesund" → "ALE").
 */
export function placeCode(name: string): string {
  const letters = name
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return letters.slice(0, 3) || "···";
}

interface Named {
  name: string;
}

/** One end of a ticket: the big code and the name under it. */
export interface TicketEnd {
  code: string;
  name: string;
}

interface Journey<P extends Named> {
  depart: Terminal | null;
  arrive: Terminal | null;
  places: P[];
}

const endOf = (p: Named | Terminal): TicketEnd => ({ code: ("code" in p && p.code) || placeCode(p.name), name: p.name });

/**
 * Where the ticket goes from and to. A departure or arrival that's been set wins:
 * flights, trains and road trips run departure to arrival, and a cruise sails from
 * its port to the first place. Without them, cruises, road trips and trains run
 * first stop to last stop, and a flight leaves from home (when it's set) for the first place.
 */
export function ticketEnds<P extends Named>(mode: Mode, { depart, arrive, places }: Journey<P>, home: Named | null): { from: TicketEnd; to: TicketEnd } | null {
  const first = places[0];
  const last = places[places.length - 1];
  if (depart || arrive) {
    const from = depart ?? home ?? first;
    const to = mode === "cruise" ? first : (arrive ?? (mode === "train" ? last : first));
    return from && to ? { from: endOf(from), to: endOf(to) } : null;
  }
  if (places.length === 0) return null;
  if (mode === "flight" && home) return { from: endOf(home), to: endOf(first) };
  if (places.length === 1) return home ? { from: endOf(home), to: endOf(first) } : null;
  return { from: endOf(first), to: endOf(last) };
}
