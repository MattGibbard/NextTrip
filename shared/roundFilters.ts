import { BUDGETS, HOLIDAY_TYPES, TRAVEL_TIMES, TRIP_LENGTHS } from "./ideaDetails";
import type { HolidayType, TravelTime, TripLength } from "./ideaDetails";
import type { IdeaDetails } from "./types";

/** Which ideas a round is about. Each empty list means "any". */
export interface RoundFilters {
  budgets: number[];
  trip_lengths: TripLength[];
  travel_times: TravelTime[];
  holiday_types: HolidayType[];
}

export const NO_FILTERS: RoundFilters = { budgets: [], trip_lengths: [], travel_times: [], holiday_types: [] };

function pick<T>(v: unknown, allowed: readonly { key: T }[]): T[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is T => allowed.some((a) => a.key === x)))];
}

/** Keeps only known values, from user input or a stored JSON column. */
export function cleanFilters(raw: unknown): RoundFilters {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      v = {};
    }
  }
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    budgets: pick(o.budgets, BUDGETS),
    trip_lengths: pick(o.trip_lengths, TRIP_LENGTHS),
    travel_times: pick(o.travel_times, TRAVEL_TIMES),
    holiday_types: pick(o.holiday_types, HOLIDAY_TYPES),
  };
}

export function hasFilters(f: RoundFilters) {
  return f.budgets.length + f.trip_lengths.length + f.travel_times.length + f.holiday_types.length > 0;
}

/**
 * An idea matches when it fits every filter that's set. Within a filter any
 * choice matches (e.g. £ or ££). An idea without that detail filled in doesn't
 * match a filter on it.
 */
export function matchesFilters(idea: IdeaDetails, f: RoundFilters): boolean {
  if (f.budgets.length && (idea.budget === null || !f.budgets.includes(idea.budget))) return false;
  if (f.trip_lengths.length && (idea.trip_length === null || !f.trip_lengths.includes(idea.trip_length))) return false;
  if (f.travel_times.length && (idea.travel_time === null || !f.travel_times.includes(idea.travel_time))) return false;
  if (f.holiday_types.length && !idea.holiday_types.some((t) => f.holiday_types.includes(t))) return false;
  return true;
}
