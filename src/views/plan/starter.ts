// Adding the ready-made family packing and to-do lists to a plan, skipping anything already there.
import { api } from "../../api";
import { ideaMode } from "../../../shared/travelMode";
import { notAlready, starterPacking, starterTodos } from "../../../shared/starterLists";
import type { TripDates } from "../../../shared/tripDates";
import type { PlanCtx } from "./context";
import { todayIso } from "./context";

/** The day you leave, or the 1st of the month when only the month is set. */
export function leaveDate(dates: TripDates | null): string | null {
  if (!dates) return null;
  return dates.kind === "exact" ? dates.start : `${dates.month}-01`;
}

/** Everyone's own basics plus the shared things, for this kind of holiday. */
export function starterPackingItems(ctx: PlanCtx): { label: string; person_id: number | null }[] {
  const list = starterPacking(ctx.idea.holiday_types, ideaMode(ctx.idea.holiday_types));
  const have = (person: number | null) => ctx.plan.packing.filter((i) => i.person_id === person).map((i) => i.label);
  return [
    ...ctx.people.flatMap((p) => notAlready(list.personal, have(p.id), (l) => l).map((label) => ({ label, person_id: p.id }))),
    ...notAlready(list.shared, have(null), (l) => l).map((label) => ({ label, person_id: null })),
  ];
}

export function addStarterPacking(ctx: PlanCtx) {
  const items = starterPackingItems(ctx);
  return ctx.run(() => api.addManyPacking(ctx.idea.id, items));
}

export function addStarterTodos(ctx: PlanCtx) {
  const jobs = starterTodos(ctx.idea.holiday_types, ideaMode(ctx.idea.holiday_types), leaveDate(ctx.dates), todayIso());
  const items = notAlready(jobs, ctx.plan.todos.map((t) => t.label), (j) => j.label).map((j) => ({ label: j.label, due: j.due, person_id: null, done: false }));
  return ctx.run(() => api.addManyTodos(ctx.idea.id, items));
}
