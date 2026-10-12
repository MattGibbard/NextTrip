import type { TripLength } from "./ideaDetails";

/**
 * When a draw's trip will be: exact dates, or just a month ("July 2027").
 * Dates are YYYY-MM-DD and the month is YYYY-MM.
 */
export type TripDates = { kind: "exact"; start: string; end: string } | { kind: "month"; month: string };

/** A check-in and check-out pair for the booking sites, as YYYY-MM-DD. */
export interface StayDates {
  start: string;
  end: string;
}

/** Nights to search for when only a month is known, from the winning idea's trip length. */
const NIGHTS: Record<TripLength, number> = { weekend: 3, week: 7, "two-weeks": 14, longer: 21 };
const DEFAULT_NIGHTS = 7;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** A real calendar date written YYYY-MM-DD. */
export function isDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isMonth(s: unknown): s is string {
  if (typeof s !== "string" || !MONTH.test(s)) return false;
  const m = Number(s.slice(5));
  return m >= 1 && m <= 12;
}

/** Keeps only valid dates, from user input or a stored JSON column. Anything else means "no dates". */
export function cleanTripDates(raw: unknown): TripDates | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind === "exact" && isDate(o.start) && isDate(o.end) && o.end > o.start) {
    return { kind: "exact", start: o.start, end: o.end };
  }
  if (o.kind === "month" && isMonth(o.month)) return { kind: "month", month: o.month };
  return null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The dates to search with: exact dates as they are, or for a month the 1st of it,
 * staying as long as the idea's trip length (a week if it has none).
 */
export function stayDates(dates: TripDates | null, length: TripLength | null): StayDates | null {
  if (!dates) return null;
  if (dates.kind === "exact") return { start: dates.start, end: dates.end };
  const start = `${dates.month}-01`;
  return { start, end: addDays(start, length ? NIGHTS[length] : DEFAULT_NIGHTS) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "12–19 Jul 2027", "28 Jul – 4 Aug 2027", "30 Dec 2027 – 6 Jan 2028" or "July 2027". */
export function tripDatesLabel(dates: TripDates): string {
  if (dates.kind === "month") return `${LONG_MONTHS[Number(dates.month.slice(5)) - 1]} ${dates.month.slice(0, 4)}`;
  const [sy, sm, sd] = dates.start.split("-").map(Number);
  const [ey, em, ed] = dates.end.split("-").map(Number);
  if (sy !== ey) return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  if (sm !== em) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd}–${ed} ${MONTHS[em - 1]} ${ey}`;
}
