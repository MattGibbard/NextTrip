// Lays out the Places passport: one stamp per country per trip, in the order you went,
// each with its own look picked from a seed so it stays put between visits.
import type { Trip } from "../shared/types";
import { placeCode, tripMode } from "../shared/travelMode";
import type { Mode } from "../shared/travelMode";

export const STAMPS_PER_PAGE = 6;

export const SHAPES = ["circle", "oval", "rect", "octagon", "arrow"] as const;
export type Shape = (typeof SHAPES)[number];

export const INKS = ["red", "blue", "purple", "green", "black"] as const;
export type Ink = (typeof INKS)[number];

const LABELS = ["ADMITTED", "ARRIVED", "ENTRY", "IMMIGRATION", "ARRIVAL"];

/** How a stamp looks and where it landed on its page. Positions are % of the page. */
export interface StampLook {
  shape: Shape;
  ink: Ink;
  label: string;
  serial: string;
  x: number;
  y: number;
  /** Width as % of the page. */
  width: number;
  tilt: number;
  /** 0 (pressed hard) to 1 (barely inked): how much of the stamp has faded. */
  fade: number;
  /** Direction the ink thins out across the stamp, in degrees. */
  pressure: number;
  seed: number;
}

export interface VisitStamp {
  key: string;
  code: string;
  name: string;
  mode: Mode;
  /** Where you came in: an airport-style code, a port or a place. */
  entry: string;
  date: string | null;
  look: StampLook;
}

export interface PendingStamp {
  key: string;
  code: string;
  name: string;
  idea: string;
  look: StampLook;
}

/** A small seeded random number generator (mulberry32), so a stamp always lands the same way. */
export function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const between = (rand: () => number, lo: number, hi: number) => lo + rand() * (hi - lo);

// Two columns by three rows, nudged about so the page looks hand-stamped.
const SLOT_X = [28, 72];
const SLOT_Y = [25, 51, 77];

/** The look of a stamp in a given slot (0–5) on its page. */
export function lookFor(key: string, slot: number, fixedWidth?: number): StampLook {
  const rand = seeded(key);
  const shape = pick(rand, SHAPES);
  const round = shape === "circle";
  const width = fixedWidth ?? (round ? between(rand, 35, 39) : between(rand, 43, 48));
  // Nudged about the slot, but never hanging off the edge of the page.
  const x = Math.min(97 - width / 2, Math.max(3 + width / 2, SLOT_X[slot % 2] + between(rand, -5, 5)));
  return {
    shape,
    ink: pick(rand, INKS),
    label: pick(rand, LABELS),
    serial: String(Math.floor(rand() * 9000) + 1000),
    x,
    y: SLOT_Y[Math.floor(slot / 2) % 3] + between(rand, -3.5, 3.5),
    width,
    tilt: between(rand, round ? -20 : -11, round ? 20 : 11),
    fade: rand() < 0.25 ? between(rand, 0.45, 0.7) : between(rand, 0.05, 0.35),
    pressure: between(rand, 0, 360),
    seed: Math.floor(rand() * 1000),
  };
}

/** Oldest trip first, like a real passport filling up. */
function byDate(a: Trip, b: Trip) {
  return (a.start_date ?? a.created_at).localeCompare(b.start_date ?? b.created_at) || a.id - b.id;
}

/** One stamp for each country on each trip, in the order you went. */
export function visitStamps(trips: Trip[]): VisitStamp[] {
  const out: VisitStamp[] = [];
  for (const trip of [...trips].sort(byDate)) {
    const mode = tripMode(trip);
    const seen = new Set<string>();
    for (const place of trip.places) {
      if (seen.has(place.country_code)) continue;
      seen.add(place.country_code);
      const key = `${trip.id}-${place.country_code}`;
      out.push({
        key,
        code: place.country_code,
        name: place.country,
        mode,
        entry: mode === "flight" ? placeCode(place.name) : mode === "cruise" ? `PORT OF ${place.name.toUpperCase()}` : place.name.toUpperCase(),
        date: trip.start_date,
        look: lookFor(key, out.length % STAMPS_PER_PAGE),
      });
    }
  }
  return out;
}

/** Faint "visa pending" stamps for countries you only have ideas for, on their own pages. */
export function pendingStamps(list: { code: string; name: string; idea: string }[]): PendingStamp[] {
  return list.map((p, i) => {
    // Pencilled notes are all the same size, whatever shape they'd have been stamped in.
    return { ...p, key: `idea-${p.code}`, look: lookFor(`idea-${p.code}`, i % STAMPS_PER_PAGE, 44) };
  });
}

export function chunk<T>(items: T[], size = STAMPS_PER_PAGE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2024-03-07" → "07 MAR 2024", the way entry stamps print it. */
export function stampDate(date: string | null): string {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "UNDATED";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
