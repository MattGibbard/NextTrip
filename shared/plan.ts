// A trip plan: what a family works out after an idea wins a draw. Days and the things on them,
// costs and who paid, packing, and the jobs to do before you go. Money is in the family's own
// currency, as whole minor units (pence), so sums never pick up rounding errors.
import type { TripDates } from "./tripDates";
import type { TripLength } from "./ideaDetails";

export type ItemStatus = "plan" | "to_book" | "booked";
export const ITEM_STATUSES: ItemStatus[] = ["plan", "to_book", "booked"];
export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = { plan: "Plan", to_book: "To book", booked: "Booked" };

export type CostCategory = "travel" | "stays" | "activities" | "food" | "other";
export const COST_CATEGORIES: CostCategory[] = ["travel", "stays", "activities", "food", "other"];
export const COST_CATEGORY_LABEL: Record<CostCategory, string> = { travel: "Travel", stays: "Stays", activities: "Activities", food: "Food", other: "Other" };

export type CostStatus = "booked" | "estimate";

/** The most days a plan can have, and the most pounds (or other units) one cost can be. */
export const MAX_DAYS = 60;
export const MAX_AMOUNT = 100_000_000;

export interface PlanItem {
  id: number;
  day: number;
  /** Free text, like "13:35" or "AM". */
  time: string | null;
  title: string;
  notes: string | null;
  status: ItemStatus;
}

export interface PlanCost {
  id: number;
  title: string;
  /** Minor units: pence for pounds. */
  amount: number;
  category: CostCategory;
  status: CostStatus;
  day: number | null;
  /** Who paid. Null while it's an estimate or nobody has paid yet. */
  paid_by: number | null;
}

/** Money one person gave another to even things up. */
export interface PlanSettlement {
  id: number;
  from_person: number;
  to_person: number;
  amount: number;
  created_at: string;
}

export interface PackingItem {
  id: number;
  label: string;
  /** Null for things the whole family shares. */
  person_id: number | null;
  packed: boolean;
}

export interface PlanTodo {
  id: number;
  label: string;
  person_id: number | null;
  /** YYYY-MM-DD, or null. */
  due: string | null;
  done: boolean;
}

export interface TripPlan {
  idea_id: number;
  /** Minor units, or null until someone sets one. */
  budget: number | null;
  /** How many days the itinerary has. Null until someone changes it; see planDays. */
  days: number | null;
  /** Names given to days, by day number. */
  day_titles: Record<number, string>;
  items: PlanItem[];
  costs: PlanCost[];
  settlements: PlanSettlement[];
  packing: PackingItem[];
  todos: PlanTodo[];
}

const LENGTH_DAYS: Record<TripLength, number> = { weekend: 3, week: 8, "two-weeks": 15, longer: 22 };

/** Days between two YYYY-MM-DD dates, counting both ends. */
function spanDays(start: string, end: string) {
  const n = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  return Number.isFinite(n) ? n : null;
}

/**
 * How many days the itinerary shows: one for each of the draw's exact dates, else what the family
 * set, else the idea's trip length, else a week. Never fewer than the last day with something on it.
 */
export function planDays(plan: Pick<TripPlan, "days" | "items">, dates: TripDates | null, length: TripLength | null): number {
  let n = dates?.kind === "exact" ? spanDays(dates.start, dates.end) : null;
  if (n === null) n = plan.days;
  if (n === null) n = length ? LENGTH_DAYS[length] : 8;
  const used = plan.items.reduce((m, i) => Math.max(m, i.day), 0);
  return Math.min(MAX_DAYS, Math.max(1, n, used));
}

/** The date of a day (1 is the first), when the draw has exact dates. */
export function dayDate(dates: TripDates | null, day: number): string | null {
  if (dates?.kind !== "exact") return null;
  const t = Date.parse(`${dates.start}T00:00:00Z`) + (day - 1) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days from today until the trip starts, or null without exact dates. Negative once it's begun. */
export function daysUntil(dates: TripDates | null, today: string): number | null {
  if (dates?.kind !== "exact") return null;
  return Math.round((Date.parse(`${dates.start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

/** Booked and estimated totals, and what's booked or estimated in each category. */
export function costTotals(costs: PlanCost[]) {
  const byCategory = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>;
  let booked = 0;
  let estimate = 0;
  for (const c of costs) {
    if (c.status === "booked") booked += c.amount;
    else estimate += c.amount;
    byCategory[c.category] += c.amount;
  }
  return { booked, estimate, total: booked + estimate, byCategory };
}

/**
 * Where everyone stands. Each booked cost someone paid is split evenly between the people
 * sharing the trip; whatever doesn't divide goes a penny at a time to the first few. Positive
 * means they're owed money, negative means they owe it. Paying someone back moves both.
 */
export function balances(costs: PlanCost[], settlements: PlanSettlement[], sharers: number[]): Map<number, number> {
  const out = new Map<number, number>(sharers.map((id) => [id, 0]));
  const add = (id: number, v: number) => out.set(id, (out.get(id) ?? 0) + v);
  const split = [...sharers].sort((a, b) => a - b);
  for (const c of costs) {
    if (c.status !== "booked" || c.paid_by === null || split.length === 0) continue;
    add(c.paid_by, c.amount);
    const share = Math.floor(c.amount / split.length);
    const extra = c.amount - share * split.length;
    split.forEach((id, i) => add(id, -(share + (i < extra ? 1 : 0))));
  }
  for (const s of settlements) {
    add(s.from_person, s.amount);
    add(s.to_person, -s.amount);
  }
  return out;
}

/** The fewest payments that would even everyone up, biggest first. */
export function settleUp(owed: Map<number, number>): { from: number; to: number; amount: number }[] {
  const debtors = [...owed].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = [...owed].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const byAmount = (a: { id: number; v: number }, b: { id: number; v: number }) => b.v - a.v || a.id - b.id;
  debtors.sort(byAmount);
  creditors.sort(byAmount);
  const out: { from: number; to: number; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].v -= amount;
    creditors[j].v -= amount;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return out;
}

/** "960", "960.5" or "£1,250.00" as minor units, or null if it isn't a sensible amount. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[^\d.]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const v = Math.round(Number(t) * 100);
  return v > 0 && v <= MAX_AMOUNT ? v : null;
}

/** Minor units as money: whole amounts without pence, like £1,250 or £12.50. */
export function formatMoney(minor: number, currency: string): string {
  const whole = minor % 100 === 0;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(whole ? 0 : 2)} ${currency}`;
  }
}

/** How a day reads on the board: booked when everything on it is, to book while anything is. */
export function dayStatus(items: PlanItem[]): "free" | ItemStatus {
  if (items.length === 0) return "free";
  if (items.some((i) => i.status === "to_book")) return "to_book";
  return items.every((i) => i.status === "booked") ? "booked" : "plan";
}

const CATEGORY_WORDS: [CostCategory, RegExp][] = [
  ["travel", /\b(flights?|fly|flying|plane|airport|trains?|rail|ferry|ferries|car hire|hire car|rental car|transfers?|taxi|uber|bus|coach|parking|cruise|eurostar)\b/i],
  ["stays", /\b(hotels?|hostel|apartment|airbnb|villa|cabin|lodge|resort|campsite|camping|b&b|guesthouse|chalet|room)\b/i],
  ["food", /\b(dinner|lunch|breakfast|brunch|restaurant|meal|cafe|café|food|picnic)\b/i],
];

/** A guess at what kind of cost a booked thing is, from its name: flights are travel, a hotel is a stay. */
export function guessCategory(title: string): CostCategory {
  return CATEGORY_WORDS.find(([, words]) => words.test(title))?.[0] ?? "activities";
}
