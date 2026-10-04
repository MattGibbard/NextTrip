// Choices for the practical details on an idea. Keys are stored; labels are shown.

export const BUDGETS = [
  { key: 1, label: "£", hint: "Cheap" },
  { key: 2, label: "££", hint: "Mid-range" },
  { key: 3, label: "£££", hint: "Splurge" },
] as const;

export const TRIP_LENGTHS = [
  { key: "weekend", label: "Long weekend" },
  { key: "week", label: "About a week" },
  { key: "two-weeks", label: "Two weeks" },
  { key: "longer", label: "Three weeks+" },
] as const;

export const TRAVEL_TIMES = [
  { key: "short", label: "Under 3h" },
  { key: "medium", label: "3–6h" },
  { key: "long", label: "6–10h" },
  { key: "very-long", label: "10h+" },
] as const;

export const HOLIDAY_TYPES = [
  { key: "city", label: "City break", icon: "🏙️" },
  { key: "beach", label: "Beach", icon: "🏖️" },
  { key: "nature", label: "Nature & hiking", icon: "🥾" },
  { key: "adventure", label: "Adventure", icon: "🧗" },
  { key: "culture", label: "Culture & history", icon: "🏛️" },
  { key: "food", label: "Food & drink", icon: "🍷" },
  { key: "road-trip", label: "Road trip", icon: "🚗" },
  { key: "ski", label: "Skiing", icon: "⛷️" },
  { key: "relax", label: "Relax & spa", icon: "🧘" },
] as const;

export type TripLength = (typeof TRIP_LENGTHS)[number]["key"];
export type TravelTime = (typeof TRAVEL_TIMES)[number]["key"];
export type HolidayType = (typeof HOLIDAY_TYPES)[number]["key"];

export function budgetLabel(b: number | null) {
  return BUDGETS.find((x) => x.key === b)?.label ?? null;
}
export function tripLengthLabel(k: string | null) {
  return TRIP_LENGTHS.find((x) => x.key === k)?.label ?? null;
}
export function travelTimeLabel(k: string | null) {
  return TRAVEL_TIMES.find((x) => x.key === k)?.label ?? null;
}
export function holidayType(k: string) {
  return HOLIDAY_TYPES.find((x) => x.key === k);
}

/** Keeps only known values, so the API never stores junk. */
export function cleanDetails(b: Record<string, unknown>) {
  const budget = BUDGETS.some((x) => x.key === b.budget) ? (b.budget as number) : null;
  const trip_length = TRIP_LENGTHS.some((x) => x.key === b.trip_length) ? (b.trip_length as TripLength) : null;
  const travel_time = TRAVEL_TIMES.some((x) => x.key === b.travel_time) ? (b.travel_time as TravelTime) : null;
  const holiday_types = Array.isArray(b.holiday_types)
    ? [...new Set(b.holiday_types.filter((t): t is HolidayType => HOLIDAY_TYPES.some((x) => x.key === t)))]
    : [];
  return { budget, trip_length, travel_time, holiday_types };
}
