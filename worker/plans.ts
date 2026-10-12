// Trip plans for ideas that won a draw: days, costs, settling up, packing and jobs before you go.
// Anyone in the family can add, change and delete these. They're loaded one plan at a time,
// when someone opens it, rather than with everything else at sign-in.
import type { Hono } from "hono";
import { HttpError } from "./env";
import type { App, Ctx } from "./env";
import { body, cleanText, idParam, viewerId } from "./request";
import { isDate } from "../shared/tripDates";
import { COST_CATEGORIES, ITEM_STATUSES, MAX_AMOUNT, MAX_DAYS } from "../shared/plan";
import type { CostCategory, ItemStatus, PackingItem, PlanCost, PlanItem, PlanSettlement, PlanTodo, TripPlan } from "../shared/plan";

/** The idea's id, if it's this family's and has won a draw (or been and become a trip). */
async function planIdea(c: Ctx): Promise<number> {
  const id = idParam(c);
  const row = await c.env.DB.prepare("SELECT status FROM ideas WHERE id = ? AND family_id = ?").bind(id, c.get("family")).first<{ status: string }>();
  if (!row) throw new HttpError(404, "Not found");
  if (row.status !== "won" && row.status !== "done") throw new HttpError(400, "Only an idea that won a draw has a trip plan");
  return id;
}

/** The most a ready-made list adds at once: a starter list for a big family is about 150 things. */
const MAX_MANY = 300;

/** Every table holding part of a trip plan, children before `plans`. */
export const PLAN_TABLES = ["plan_days", "plan_items", "plan_costs", "plan_settlements", "plan_packing", "plan_todos", "plans"] as const;

/** A list of things to add in one go. */
function manyOf(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length > MAX_MANY || !v.every((x) => x && typeof x === "object")) throw new HttpError(400, "That list doesn't look right");
  return v as Record<string, unknown>[];
}

/**
 * Checks person ids against the family with one query, for adding many things at once
 * (D1 limits how many queries one request can make).
 */
async function familyPeople(c: Ctx): Promise<(v: unknown) => number | null> {
  const rows = await c.env.DB.prepare("SELECT id FROM people WHERE family_id = ?").bind(c.get("family")).all<{ id: number }>();
  const ids = new Set(rows.results.map((r) => r.id));
  return (v) => (typeof v === "number" && ids.has(v) ? v : null);
}

/** A person id if they're in this family, otherwise null. */
async function familyPersonOrNull(c: Ctx, v: unknown): Promise<number | null> {
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  const row = await c.env.DB.prepare("SELECT id FROM people WHERE id = ? AND family_id = ?").bind(v, c.get("family")).first<{ id: number }>();
  return row?.id ?? null;
}

function cleanDay(v: unknown, required: true): number;
function cleanDay(v: unknown, required: false): number | null;
function cleanDay(v: unknown, required: boolean): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_DAYS) return v;
  if (required) throw new HttpError(400, `Pick a day from 1 to ${MAX_DAYS}`);
  return null;
}

function cleanAmount(v: unknown): number {
  if (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= MAX_AMOUNT) return v;
  throw new HttpError(400, "Enter an amount");
}

function requiredText(v: unknown, max: number, message: string): string {
  const t = cleanText(v, max);
  if (!t) throw new HttpError(400, message);
  return t;
}

function cleanDate(v: unknown): string | null {
  const t = cleanText(v, 10);
  return isDate(t) ? t : null;
}

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

/** Fails with 404 when a write touched no row: wrong id, or another plan's. */
function changed(res: D1Result) {
  if (!res.meta.changes) throw new HttpError(404, "Not found");
}

export async function loadPlan(db: D1Database, ideaId: number): Promise<TripPlan> {
  const [plan, days, items, costs, settlements, packing, todos] = await db.batch([
    db.prepare("SELECT budget, days FROM plans WHERE idea_id = ?").bind(ideaId),
    db.prepare("SELECT day, title FROM plan_days WHERE idea_id = ?").bind(ideaId),
    db.prepare("SELECT id, day, time, title, notes, status FROM plan_items WHERE idea_id = ? ORDER BY day, time IS NULL, time, id").bind(ideaId),
    db.prepare("SELECT id, title, amount, category, status, day, paid_by FROM plan_costs WHERE idea_id = ? ORDER BY status, day IS NULL, day, id").bind(ideaId),
    db.prepare("SELECT id, from_person, to_person, amount, created_at FROM plan_settlements WHERE idea_id = ? ORDER BY id").bind(ideaId),
    db.prepare("SELECT id, label, person_id, packed FROM plan_packing WHERE idea_id = ? ORDER BY id").bind(ideaId),
    db.prepare("SELECT id, label, person_id, due, done FROM plan_todos WHERE idea_id = ? ORDER BY done, due IS NULL, due, id").bind(ideaId),
  ]);
  const p = (plan.results[0] as { budget: number | null; days: number | null } | undefined) ?? { budget: null, days: null };
  return {
    idea_id: ideaId,
    budget: p.budget,
    days: p.days,
    day_titles: Object.fromEntries((days.results as { day: number; title: string }[]).map((d) => [d.day, d.title])),
    items: items.results as PlanItem[],
    costs: costs.results as PlanCost[],
    settlements: settlements.results as PlanSettlement[],
    packing: (packing.results as (Omit<PackingItem, "packed"> & { packed: number })[]).map((i) => ({ ...i, packed: !!i.packed })),
    todos: (todos.results as (Omit<PlanTodo, "done"> & { done: number })[]).map((t) => ({ ...t, done: !!t.done })),
  };
}

export function planRoutes(app: Hono<App>) {
  app.get("/plans/:id", async (c) => c.json(await loadPlan(c.env.DB, await planIdea(c))));

  // The budget and how many days the itinerary has. Either can be left out to keep it as it is.
  app.put("/plans/:id", async (c) => {
    const id = await planIdea(c);
    const b = await body(c);
    const db = c.env.DB;
    const current = await db.prepare("SELECT budget, days FROM plans WHERE idea_id = ?").bind(id).first<{ budget: number | null; days: number | null }>();
    let budget = current?.budget ?? null;
    let days = current?.days ?? null;
    if ("budget" in b) budget = b.budget === null ? null : cleanAmount(b.budget);
    if ("days" in b) {
      days = cleanDay(b.days, true);
      const last = await db.prepare("SELECT MAX(day) AS day FROM plan_items WHERE idea_id = ?").bind(id).first<{ day: number | null }>();
      if (last?.day && last.day > days) throw new HttpError(409, `Day ${last.day} still has things on it. Move or delete them first.`);
    }
    await db
      .prepare("INSERT INTO plans (idea_id, family_id, budget, days) VALUES (?, ?, ?, ?) ON CONFLICT(idea_id) DO UPDATE SET budget = excluded.budget, days = excluded.days")
      .bind(id, c.get("family"), budget, days)
      .run();
    return c.json({ ok: true });
  });

  // A day's name. An empty one clears it.
  app.put("/plans/:id/days/:day", async (c) => {
    const id = await planIdea(c);
    const day = cleanDay(Number(c.req.param("day")), true);
    const title = cleanText((await body(c)).title, 120);
    const db = c.env.DB;
    await (title
      ? db.prepare("INSERT INTO plan_days (idea_id, family_id, day, title) VALUES (?, ?, ?, ?) ON CONFLICT(idea_id, day) DO UPDATE SET title = excluded.title").bind(id, c.get("family"), day, title)
      : db.prepare("DELETE FROM plan_days WHERE idea_id = ? AND day = ?").bind(id, day)
    ).run();
    return c.json({ ok: true });
  });

  // Things on a day.
  const item = (b: Record<string, unknown>) => ({
    day: cleanDay(b.day, true),
    time: cleanText(b.time, 20),
    title: requiredText(b.title, 200, "Say what it is"),
    notes: cleanText(b.notes, 2000),
    status: oneOf<ItemStatus>(b.status, ITEM_STATUSES, "plan"),
  });

  app.post("/plans/:id/items", async (c) => {
    const id = await planIdea(c);
    const i = item(await body(c));
    const row = await c.env.DB.prepare("INSERT INTO plan_items (idea_id, family_id, day, time, title, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(id, c.get("family"), i.day, i.time, i.title, i.notes, i.status, viewerId(c))
      .first<{ id: number }>();
    return c.json({ id: row!.id }, 201);
  });

  app.put("/plans/:id/items/:item", async (c) => {
    const id = await planIdea(c);
    const i = item(await body(c));
    changed(
      await c.env.DB.prepare("UPDATE plan_items SET day = ?, time = ?, title = ?, notes = ?, status = ? WHERE id = ? AND idea_id = ?")
        .bind(i.day, i.time, i.title, i.notes, i.status, idParam(c, "item"), id)
        .run(),
    );
    return c.json({ ok: true });
  });

  app.delete("/plans/:id/items/:item", async (c) => {
    const id = await planIdea(c);
    changed(await c.env.DB.prepare("DELETE FROM plan_items WHERE id = ? AND idea_id = ?").bind(idParam(c, "item"), id).run());
    return c.json({ ok: true });
  });

  // Costs.
  const cost = async (c: Ctx, b: Record<string, unknown>) => {
    const status = b.status === "estimate" ? "estimate" : "booked";
    return {
      title: requiredText(b.title, 200, "Say what it's for"),
      amount: cleanAmount(b.amount),
      category: oneOf<CostCategory>(b.category, COST_CATEGORIES, "other"),
      status,
      day: cleanDay(b.day, false),
      // An estimate hasn't been paid by anyone yet.
      paid_by: status === "booked" ? await familyPersonOrNull(c, b.paid_by) : null,
    };
  };

  app.post("/plans/:id/costs", async (c) => {
    const id = await planIdea(c);
    const k = await cost(c, await body(c));
    const row = await c.env.DB.prepare("INSERT INTO plan_costs (idea_id, family_id, title, amount, category, status, day, paid_by, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(id, c.get("family"), k.title, k.amount, k.category, k.status, k.day, k.paid_by, viewerId(c))
      .first<{ id: number }>();
    return c.json({ id: row!.id }, 201);
  });

  app.put("/plans/:id/costs/:cost", async (c) => {
    const id = await planIdea(c);
    const k = await cost(c, await body(c));
    changed(
      await c.env.DB.prepare("UPDATE plan_costs SET title = ?, amount = ?, category = ?, status = ?, day = ?, paid_by = ? WHERE id = ? AND idea_id = ?")
        .bind(k.title, k.amount, k.category, k.status, k.day, k.paid_by, idParam(c, "cost"), id)
        .run(),
    );
    return c.json({ ok: true });
  });

  app.delete("/plans/:id/costs/:cost", async (c) => {
    const id = await planIdea(c);
    changed(await c.env.DB.prepare("DELETE FROM plan_costs WHERE id = ? AND idea_id = ?").bind(idParam(c, "cost"), id).run());
    return c.json({ ok: true });
  });

  // Paying someone back.
  app.post("/plans/:id/settlements", async (c) => {
    const id = await planIdea(c);
    const b = await body(c);
    const from = await familyPersonOrNull(c, b.from_person);
    const to = await familyPersonOrNull(c, b.to_person);
    if (from === null || to === null || from === to) throw new HttpError(400, "Pick who paid whom");
    const row = await c.env.DB.prepare("INSERT INTO plan_settlements (idea_id, family_id, from_person, to_person, amount) VALUES (?, ?, ?, ?, ?) RETURNING id")
      .bind(id, c.get("family"), from, to, cleanAmount(b.amount))
      .first<{ id: number }>();
    return c.json({ id: row!.id }, 201);
  });

  app.delete("/plans/:id/settlements/:settlement", async (c) => {
    const id = await planIdea(c);
    changed(await c.env.DB.prepare("DELETE FROM plan_settlements WHERE id = ? AND idea_id = ?").bind(idParam(c, "settlement"), id).run());
    return c.json({ ok: true });
  });

  // Packing.
  app.post("/plans/:id/packing", async (c) => {
    const id = await planIdea(c);
    const b = await body(c);
    const row = await c.env.DB.prepare("INSERT INTO plan_packing (idea_id, family_id, label, person_id) VALUES (?, ?, ?, ?) RETURNING id")
      .bind(id, c.get("family"), requiredText(b.label, 200, "Say what to pack"), await familyPersonOrNull(c, b.person_id))
      .first<{ id: number }>();
    return c.json({ id: row!.id }, 201);
  });

  // A ready-made list, added in one go.
  app.post("/plans/:id/packing/many", async (c) => {
    const id = await planIdea(c);
    const person = await familyPeople(c);
    const rows = manyOf((await body(c)).items).map((b) => ({ label: requiredText(b.label, 200, "Say what to pack"), person_id: person(b.person_id) }));
    if (rows.length) {
      await c.env.DB.batch(
        rows.map((r) => c.env.DB.prepare("INSERT INTO plan_packing (idea_id, family_id, label, person_id) VALUES (?, ?, ?, ?)").bind(id, c.get("family"), r.label, r.person_id)),
      );
    }
    return c.json({ added: rows.length }, 201);
  });

  app.put("/plans/:id/packing/:item", async (c) => {
    const id = await planIdea(c);
    const b = await body(c);
    changed(
      await c.env.DB.prepare("UPDATE plan_packing SET label = ?, person_id = ?, packed = ? WHERE id = ? AND idea_id = ?")
        .bind(requiredText(b.label, 200, "Say what to pack"), await familyPersonOrNull(c, b.person_id), b.packed === true ? 1 : 0, idParam(c, "item"), id)
        .run(),
    );
    return c.json({ ok: true });
  });

  app.delete("/plans/:id/packing/:item", async (c) => {
    const id = await planIdea(c);
    changed(await c.env.DB.prepare("DELETE FROM plan_packing WHERE id = ? AND idea_id = ?").bind(idParam(c, "item"), id).run());
    return c.json({ ok: true });
  });

  // Jobs before you go.
  const todo = async (c: Ctx, b: Record<string, unknown>) => ({
    label: requiredText(b.label, 200, "Say what needs doing"),
    person_id: await familyPersonOrNull(c, b.person_id),
    due: cleanDate(b.due),
    done: b.done === true ? 1 : 0,
  });

  app.post("/plans/:id/todos", async (c) => {
    const id = await planIdea(c);
    const t = await todo(c, await body(c));
    const row = await c.env.DB.prepare("INSERT INTO plan_todos (idea_id, family_id, label, person_id, due, done) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(id, c.get("family"), t.label, t.person_id, t.due, t.done)
      .first<{ id: number }>();
    return c.json({ id: row!.id }, 201);
  });

  app.post("/plans/:id/todos/many", async (c) => {
    const id = await planIdea(c);
    const person = await familyPeople(c);
    const rows = manyOf((await body(c)).items).map((b) => ({
      label: requiredText(b.label, 200, "Say what needs doing"),
      person_id: person(b.person_id),
      due: cleanDate(b.due),
      done: b.done === true ? 1 : 0,
    }));
    if (rows.length) {
      await c.env.DB.batch(
        rows.map((t) =>
          c.env.DB.prepare("INSERT INTO plan_todos (idea_id, family_id, label, person_id, due, done) VALUES (?, ?, ?, ?, ?, ?)").bind(id, c.get("family"), t.label, t.person_id, t.due, t.done),
        ),
      );
    }
    return c.json({ added: rows.length }, 201);
  });

  app.put("/plans/:id/todos/:todo", async (c) => {
    const id = await planIdea(c);
    const t = await todo(c, await body(c));
    changed(
      await c.env.DB.prepare("UPDATE plan_todos SET label = ?, person_id = ?, due = ?, done = ? WHERE id = ? AND idea_id = ?")
        .bind(t.label, t.person_id, t.due, t.done, idParam(c, "todo"), id)
        .run(),
    );
    return c.json({ ok: true });
  });

  app.delete("/plans/:id/todos/:todo", async (c) => {
    const id = await planIdea(c);
    changed(await c.env.DB.prepare("DELETE FROM plan_todos WHERE id = ? AND idea_id = ?").bind(idParam(c, "todo"), id).run());
    return c.json({ ok: true });
  });
}
