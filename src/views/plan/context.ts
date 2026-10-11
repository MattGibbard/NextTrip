// What every part of a trip plan page needs: the idea, its plan, the draw's dates and how to save.
import type { Idea, Person, Round } from "../../../shared/types";
import type { TripDates } from "../../../shared/tripDates";
import type { TripPlan } from "../../../shared/plan";

export type PlanTab = "overview" | "itinerary" | "costs" | "packing";
export const PLAN_TABS: { id: PlanTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
  { id: "costs", label: "Costs" },
  { id: "packing", label: "Packing" },
];

export interface PlanCtx {
  idea: Idea;
  plan: TripPlan;
  /** The draw it won, if it's still there. */
  round: Round | null;
  dates: TripDates | null;
  /** How many days the itinerary shows. */
  days: number;
  people: Person[];
  me: Person | null;
  /** Money in the family's currency, from minor units. */
  money: (minor: number) => string;
  currency: string;
  /** Saves something, then loads the plan again. Errors go to onError, else the top of the page. */
  run: (save: () => Promise<unknown>, onError?: (message: string) => void) => Promise<boolean>;
  /** Changes the plan on screen straight away, for ticks that shouldn't wait for the server. */
  patch: (f: (p: TripPlan) => TripPlan) => void;
}

export const planHref = (id: number, tab: PlanTab = "overview") => `#/next/${id}/plan${tab === "overview" ? "" : `/${tab}`}`;

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Sat 14 Aug" for a YYYY-MM-DD date. */
export const dayLabel = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));
/** "14 Aug" for a YYYY-MM-DD date. */
export const shortDate = (iso: string) => SHORT.format(new Date(`${iso}T00:00:00Z`));

export const pad2 = (n: number) => String(n).padStart(2, "0");
