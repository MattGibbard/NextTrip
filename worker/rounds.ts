import type { Hono } from "hono";
import { HttpError } from "./env";
import type { App, Ctx } from "./env";
import { requireOwner } from "./auth";
import { PLAN_TABLES } from "./plans";
import { activePeople, loadFamily, matchingIdeaIds, toSwipe } from "./data";
import type { SwipeRow } from "./data";
import { body, cleanText, idParam, requireViewer, viewerId } from "./request";
import { countedAllocations, ideaForTicket, randomTicket, ticketRanges, validateAllocation } from "../shared/draw";
import { NO_FILTERS, cleanFilters } from "../shared/roundFilters";
import { buildShortlist, parseShortlist, unswiped } from "../shared/shortlist";
import { cleanTripDates } from "../shared/tripDates";
import type { Allocation, Round } from "../shared/types";

async function loadRounds(db: D1Database, family: number, viewer: number | null, onlyId?: number): Promise<Round[]> {
  const rounds = (await loadFamily(db, family, viewer, ["rounds"])).rounds!;
  return onlyId === undefined ? rounds : rounds.filter((r) => r.id === onlyId);
}

async function openRound(c: Ctx) {
  const r = await c.env.DB.prepare("SELECT id, points_per_person, status, swipe, shortlist, filters FROM rounds WHERE id = ? AND family_id = ?")
    .bind(idParam(c), c.get("family"))
    .first<{ id: number; points_per_person: number; status: string; swipe: number; shortlist: string | null; filters: string }>();
  if (!r) throw new HttpError(404, "Not found");
  if (r.status !== "open") throw new HttpError(409, "This round has already been drawn");
  return r;
}

/**
 * Ideas a person can put points on in a round: in the pool, fit its filters,
 * and not vetoed by that person. Someone else's veto is secret, so it doesn't
 * stop you spending points on that idea; those points just don't count in the draw.
 */
async function eligibleIdeaIds(db: D1Database, family: number, roundId: number, personId: number) {
  const [round, veto] = await Promise.all([
    db.prepare("SELECT filters, swipe, shortlist FROM rounds WHERE id = ?").bind(roundId).first<{ filters: string; swipe: number; shortlist: string | null }>(),
    db.prepare("SELECT idea_id FROM round_vetoes WHERE round_id = ? AND person_id = ?").bind(roundId, personId).first<{ idea_id: number }>(),
  ]);
  // A swipe round takes no points until its shortlist is made, then only shortlisted ideas.
  if (round?.swipe) {
    const shortlist = parseShortlist(round.shortlist);
    if (!shortlist) return new Set<number>();
    const active = new Set(await matchingIdeaIds(db, family, NO_FILTERS));
    return new Set(shortlist.ids.filter((id) => active.has(id) && id !== veto?.idea_id));
  }
  const ids = await matchingIdeaIds(db, family, cleanFilters(round?.filters));
  return new Set(ids.filter((id) => id !== veto?.idea_id));
}

async function isLocked(db: D1Database, roundId: number, personId: number) {
  return !!(await db.prepare("SELECT 1 FROM round_locks WHERE round_id = ? AND person_id = ?").bind(roundId, personId).first());
}

/**
 * Fixes a swipe round's shortlist once everyone has swiped every idea in its
 * pool. Safe to call any time; it does nothing until then, or once it's set.
 */
async function finishShortlist(db: D1Database, family: number, roundId: number) {
  const r = await db.prepare("SELECT filters FROM rounds WHERE id = ? AND status = 'open' AND swipe = 1 AND shortlist IS NULL")
    .bind(roundId)
    .first<{ filters: string }>();
  if (!r) return;
  const [pool, ids, swipes] = await Promise.all([
    matchingIdeaIds(db, family, cleanFilters(r.filters)),
    activePeople(db, family),
    db.prepare("SELECT person_id, idea_id, liked FROM round_swipes WHERE round_id = ?").bind(roundId).all<Omit<SwipeRow, "round_id">>(),
  ]);
  const all = swipes.results.map(toSwipe);
  if (ids.some((id) => unswiped(id, pool, all).length > 0)) return;
  const shortlist = buildShortlist(pool, ids, all);
  await db.prepare("UPDATE rounds SET shortlist = ? WHERE id = ? AND shortlist IS NULL").bind(JSON.stringify(shortlist), roundId).run();
}

export async function finishOpenShortlist(db: D1Database, family: number) {
  const r = await db.prepare("SELECT id FROM rounds WHERE family_id = ? AND status = 'open'").bind(family).first<{ id: number }>();
  if (r) await finishShortlist(db, family, r.id);
}

export function roundRoutes(app: Hono<App>) {
  app.get("/rounds", async (c) => c.json(await loadRounds(c.env.DB, c.get("family"), viewerId(c))));

  app.post("/rounds", async (c) => {
    const b = await body(c);
    const points = typeof b.points_per_person === "number" ? Math.round(b.points_per_person) : 10;
    if (points < 1 || points > 100) throw new HttpError(400, "Points must be between 1 and 100");
    const family = c.get("family");
    const existing = await c.env.DB.prepare("SELECT 1 FROM rounds WHERE family_id = ? AND status = 'open'").bind(family).first();
    if (existing) throw new HttpError(409, "There is already an open round");
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM rounds WHERE family_id = ?").bind(family).first<{ n: number }>();
    const name = cleanText(b.name, 100) ?? `Round ${(count?.n ?? 0) + 1}`;
    const filters = cleanFilters(b.filters);
    if ((await matchingIdeaIds(c.env.DB, family, filters)).length < 2) {
      throw new HttpError(400, "At least 2 ideas need to match the filters");
    }
    const dates = cleanTripDates(b.trip_dates);
    const row = await c.env.DB.prepare("INSERT INTO rounds (name, points_per_person, filters, swipe, trip_dates, family_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(name, points, JSON.stringify(filters), b.swipe === true ? 1 : 0, dates && JSON.stringify(dates), family)
      .first<{ id: number }>();
    return c.json({ id: row!.id }, 201);
  });

  app.delete("/rounds/:id", async (c) => {
    requireOwner(c);
    const db = c.env.DB;
    const r = await db.prepare("SELECT id, winner_idea_id FROM rounds WHERE id = ? AND family_id = ?")
      .bind(idParam(c), c.get("family"))
      .first<{ id: number; winner_idea_id: number | null }>();
    if (!r) throw new HttpError(404, "Not found");
    const stmts = [db.prepare("DELETE FROM rounds WHERE id = ?").bind(r.id)];
    // Cancelling a draw puts its winner back in the pool with its trip plan cleared, unless you've already turned it into a trip.
    if (r.winner_idea_id !== null) {
      const won = "EXISTS (SELECT 1 FROM ideas WHERE id = ?1 AND status = 'won')";
      for (const t of PLAN_TABLES) stmts.push(db.prepare(`DELETE FROM ${t} WHERE idea_id = ?1 AND ${won}`).bind(r.winner_idea_id));
      stmts.push(db.prepare("UPDATE ideas SET status = 'active' WHERE id = ? AND status = 'won'").bind(r.winner_idea_id));
    }
    await db.batch(stmts);
    return c.json({ ok: true });
  });

  // When the trip will be. Anyone in the family can set or clear it, before or after the draw.
  app.put("/rounds/:id/dates", async (c) => {
    const b = await body(c);
    const dates = cleanTripDates(b.trip_dates);
    if (b.trip_dates != null && !dates) throw new HttpError(400, "Those dates don't look right");
    const res = await c.env.DB.prepare("UPDATE rounds SET trip_dates = ? WHERE id = ? AND family_id = ?")
      .bind(dates && JSON.stringify(dates), idParam(c), c.get("family"))
      .run();
    if (!res.meta.changes) throw new HttpError(404, "Not found");
    return c.json({ trip_dates: dates });
  });

  app.put("/rounds/:id/allocations", async (c) => {
    const viewer = requireViewer(c);
    const r = await openRound(c);
    if (await isLocked(c.env.DB, r.id, viewer)) throw new HttpError(409, "Unlock your points before changing them");
    const b = await body(c);
    const entries = Array.isArray(b.allocations)
      ? b.allocations.map((a: { idea_id?: unknown; points?: unknown }) => ({ idea_id: Number(a?.idea_id), points: Number(a?.points) }))
      : [];
    const error = validateAllocation(entries, r.points_per_person, await eligibleIdeaIds(c.env.DB, c.get("family"), r.id, viewer), false);
    if (error) throw new HttpError(400, error);
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM allocations WHERE round_id = ? AND person_id = ?").bind(r.id, viewer),
      ...entries
        .filter((e: { points: number }) => e.points > 0)
        .map((e: { idea_id: number; points: number }) =>
          c.env.DB.prepare("INSERT INTO allocations (round_id, person_id, idea_id, points) VALUES (?, ?, ?, ?)").bind(r.id, viewer, e.idea_id, e.points),
        ),
    ]);
    return c.json({ ok: true });
  });

  app.post("/rounds/:id/lock", async (c) => {
    const viewer = requireViewer(c);
    const r = await openRound(c);
    const { results } = await c.env.DB.prepare("SELECT idea_id, points FROM allocations WHERE round_id = ? AND person_id = ?")
      .bind(r.id, viewer)
      .all<{ idea_id: number; points: number }>();
    const error = validateAllocation(results, r.points_per_person, await eligibleIdeaIds(c.env.DB, c.get("family"), r.id, viewer), true);
    if (error) throw new HttpError(400, error);
    await c.env.DB.prepare("INSERT OR IGNORE INTO round_locks (round_id, person_id) VALUES (?, ?)").bind(r.id, viewer).run();
    return c.json({ ok: true });
  });

  app.delete("/rounds/:id/lock", async (c) => {
    const viewer = requireViewer(c);
    const r = await openRound(c);
    await c.env.DB.prepare("DELETE FROM round_locks WHERE round_id = ? AND person_id = ?").bind(r.id, viewer).run();
    return c.json({ ok: true });
  });

  app.put("/rounds/:id/swipes", async (c) => {
    const viewer = requireViewer(c);
    const db = c.env.DB;
    const r = await openRound(c);
    if (!r.swipe) throw new HttpError(400, "This round doesn't use swiping");
    if (r.shortlist) throw new HttpError(409, "The shortlist is already made");
    const b = await body(c);
    const ideaId = Number(b.idea_id);
    if (typeof b.liked !== "boolean") throw new HttpError(400, "Say yes or no");
    if (!(await matchingIdeaIds(db, c.get("family"), cleanFilters(r.filters))).includes(ideaId)) throw new HttpError(400, "That idea isn't in this round");
    await db.prepare("INSERT OR REPLACE INTO round_swipes (round_id, person_id, idea_id, liked) VALUES (?, ?, ?, ?)")
      .bind(r.id, viewer, ideaId, b.liked ? 1 : 0)
      .run();
    await finishShortlist(db, c.get("family"), r.id);
    return c.json({ ok: true });
  });

  app.post("/rounds/:id/veto", async (c) => {
    const viewer = requireViewer(c);
    const db = c.env.DB;
    const r = await openRound(c);
    if (await isLocked(db, r.id, viewer)) throw new HttpError(409, "Unlock your points before using your veto");
    const b = await body(c);
    const ideaId = Number(b.idea_id);
    const existing = await db.prepare("SELECT 1 FROM round_vetoes WHERE round_id = ? AND person_id = ?").bind(r.id, viewer).first();
    if (existing) throw new HttpError(409, "You've already used your veto this round");
    const eligible = await eligibleIdeaIds(db, c.get("family"), r.id, viewer);
    if (!eligible.has(ideaId)) throw new HttpError(400, "That idea can't be vetoed");
    if (eligible.size <= 1) throw new HttpError(409, "That's the last idea left in this round");
    // Only your own points on it come back. Nobody else is told, so their points stay put.
    await db.batch([
      db.prepare("INSERT INTO round_vetoes (round_id, person_id, idea_id) VALUES (?, ?, ?)").bind(r.id, viewer, ideaId),
      db.prepare("DELETE FROM allocations WHERE round_id = ? AND person_id = ? AND idea_id = ?").bind(r.id, viewer, ideaId),
    ]);
    return c.json({ ok: true });
  });

  app.delete("/rounds/:id/veto", async (c) => {
    const viewer = requireViewer(c);
    const r = await openRound(c);
    if (await isLocked(c.env.DB, r.id, viewer)) throw new HttpError(409, "Unlock your points before changing your veto");
    await c.env.DB.prepare("DELETE FROM round_vetoes WHERE round_id = ? AND person_id = ?").bind(r.id, viewer).run();
    return c.json({ ok: true });
  });

  app.post("/rounds/:id/draw", async (c) => {
    const db = c.env.DB;
    const r = await openRound(c);
    const [people, locks, allocs, vetoes] = await Promise.all([
      activePeople(db, c.get("family")),
      db.prepare("SELECT person_id FROM round_locks WHERE round_id = ?").bind(r.id).all<{ person_id: number }>(),
      db.prepare("SELECT person_id, idea_id, points FROM allocations WHERE round_id = ?").bind(r.id).all<Allocation>(),
      db.prepare("SELECT idea_id FROM round_vetoes WHERE round_id = ?").bind(r.id).all<{ idea_id: number }>(),
    ]);
    const lockedIds = new Set(locks.results.map((l) => l.person_id));
    if (people.length === 0 || !people.every((id) => lockedIds.has(id))) throw new HttpError(409, "Everyone needs to lock in their points first");

    // Points on vetoed ideas don't become tickets.
    const ranges = ticketRanges(countedAllocations(allocs.results, vetoes.results.map((v) => v.idea_id)));
    const total = ranges.reduce((n, r) => n + r.tickets, 0);
    const ticket = randomTicket(total, (buf) => crypto.getRandomValues(buf));
    const winner = ideaForTicket(ranges, ticket);

    // The status guard makes a second, simultaneous draw a no-op, so there are no re-rolls.
    const res = await db.prepare(
      "UPDATE rounds SET status = 'drawn', winner_idea_id = ?, winning_ticket = ?, total_tickets = ?, drawn_at = datetime('now') WHERE id = ? AND status = 'open'",
    )
      .bind(winner, ticket, total, r.id)
      .run();
    if (!res.meta.changes) throw new HttpError(409, "This round has already been drawn");
    await db.prepare("UPDATE ideas SET status = 'won' WHERE id = ? AND status = 'active'").bind(winner).run();
    const [round] = await loadRounds(db, c.get("family"), viewerId(c), r.id);
    return c.json(round);
  });
}
