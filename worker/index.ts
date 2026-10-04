import { Hono } from "hono";
import type { Context } from "hono";
import { migrate } from "./migrate";
import { countedAllocations, ideaForTicket, randomTicket, ticketRanges, validateAllocation } from "../shared/draw";
import { parseNominatim } from "../shared/geocode";
import { cleanDetails } from "../shared/ideaDetails";
import { estimateTravel } from "../shared/travelTime";
import { NO_FILTERS, cleanFilters, matchesFilters } from "../shared/roundFilters";
import { buildShortlist, parseShortlist, unswiped } from "../shared/shortlist";
import type { Swipe } from "../shared/shortlist";
import type { RoundFilters } from "../shared/roundFilters";
import type {
  Allocation,
  Home,
  Idea,
  IdeaDetails,
  IdeaInput,
  IdeaStatus,
  Person,
  Place,
  Round,
  Trip,
  TripInput,
} from "../shared/types";

interface Env {
  DB: D1Database;
}

type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

let schemaReady: Promise<void> | null = null;

// Bring the database up to date on first use, once per Worker instance, so the
// site works even if the deploy never ran `wrangler d1 migrations apply`.
app.use("*", async (c, next) => {
  if (!c.env.DB) {
    return c.json({ error: "The database isn't connected. Check the D1 binding named DB on the Worker." }, 500);
  }
  schemaReady ??= migrate(c.env.DB).catch((err) => {
    schemaReady = null;
    throw err;
  });
  await schemaReady;
  await next();
});

class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** There is no login yet, so the browser says who it is with this header. */
function viewerId(c: Ctx): number | null {
  const raw = c.req.header("X-Person-Id");
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) ? id : null;
}

function requireViewer(c: Ctx): number {
  const id = viewerId(c);
  if (id === null) throw new HttpError(400, "Pick who you are first");
  return id;
}

function idParam(c: Ctx): number {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw new HttpError(404, "Not found");
  return id;
}

function cleanText(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

function cleanPlaces(v: unknown): Place[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 50).flatMap((p): Place[] => {
    const name = cleanText(p?.name, 200);
    const country = cleanText(p?.country, 200);
    const code = cleanText(p?.country_code, 2)?.toUpperCase();
    if (!name || !country || !code || !/^[A-Z]{2}$/.test(code)) return [];
    const lat = typeof p.lat === "number" && Number.isFinite(p.lat) ? p.lat : null;
    const lon = typeof p.lon === "number" && Number.isFinite(p.lon) ? p.lon : null;
    return [{ name, country, country_code: code, lat, lon }];
  });
}

async function body(c: Ctx): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

// ---------- People ----------

app.get("/people", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, color FROM people ORDER BY id").all<Person>();
  return c.json(results);
});

app.put("/people/:id", async (c) => {
  const id = idParam(c);
  const b = await body(c);
  const name = cleanText(b.name, 40);
  const color = typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : null;
  if (!name) throw new HttpError(400, "Name is required");
  const res = await c.env.DB.prepare("UPDATE people SET name = ?, color = COALESCE(?, color) WHERE id = ?")
    .bind(name, color, id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  return c.json({ ok: true });
});

// ---------- Places helpers ----------

async function loadPlaces(db: D1Database, table: "trip_places" | "idea_places", key: "trip_id" | "idea_id") {
  const { results } = await db
    .prepare(`SELECT ${key} AS owner, name, country, country_code, lat, lon FROM ${table} ORDER BY ${key}, position`)
    .all<Place & { owner: number }>();
  const byOwner = new Map<number, Place[]>();
  for (const { owner, ...place } of results) {
    const list = byOwner.get(owner) ?? [];
    list.push(place);
    byOwner.set(owner, list);
  }
  return byOwner;
}

function placeInserts(db: D1Database, table: "trip_places" | "idea_places", key: string, ownerId: number, places: Place[]) {
  return [
    db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).bind(ownerId),
    ...places.map((p, i) =>
      db
        .prepare(`INSERT INTO ${table} (${key}, position, name, country, country_code, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(ownerId, i, p.name, p.country, p.country_code, p.lat, p.lon),
    ),
  ];
}

// ---------- Trips ----------

function tripInput(b: Record<string, unknown>): TripInput {
  const title = cleanText(b.title, 200);
  if (!title) throw new HttpError(400, "Give the trip a name");
  const date = (v: unknown) => {
    const t = cleanText(v, 10);
    return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
  };
  const rating = typeof b.rating === "number" && b.rating >= 1 && b.rating <= 5 ? Math.round(b.rating) : null;
  const cover = cleanUrl(b.cover_url);
  return {
    title,
    start_date: date(b.start_date),
    end_date: date(b.end_date),
    notes: cleanText(b.notes, 5000),
    rating,
    cover_url: cover,
    road_trip: b.road_trip === true,
    cruise: b.cruise === true,
    idea_id: typeof b.idea_id === "number" ? b.idea_id : null,
    created_by: typeof b.created_by === "number" ? b.created_by : null,
    places: cleanPlaces(b.places),
  };
}

app.get("/trips", async (c) => {
  const [{ results }, places] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM trips ORDER BY COALESCE(start_date, created_at) DESC").all<Omit<Trip, "places" | "road_trip" | "cruise"> & { road_trip: number; cruise: number }>(),
    loadPlaces(c.env.DB, "trip_places", "trip_id"),
  ]);
  return c.json(results.map((t) => ({ ...t, road_trip: !!t.road_trip, cruise: !!t.cruise, places: places.get(t.id) ?? [] })));
});

app.post("/trips", async (c) => {
  const t = tripInput(await body(c));
  const row = await c.env.DB.prepare(
    `INSERT INTO trips (title, start_date, end_date, notes, rating, cover_url, road_trip, cruise, idea_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(t.title, t.start_date, t.end_date, t.notes, t.rating, t.cover_url, t.road_trip ? 1 : 0, t.cruise ? 1 : 0, t.idea_id, t.created_by ?? viewerId(c))
    .first<{ id: number }>();
  const id = row!.id;
  const stmts = placeInserts(c.env.DB, "trip_places", "trip_id", id, t.places);
  // Turning a drawn idea into a real trip marks the idea as done.
  if (t.idea_id !== null) stmts.push(c.env.DB.prepare("UPDATE ideas SET status = 'done' WHERE id = ?").bind(t.idea_id));
  await c.env.DB.batch(stmts);
  return c.json({ id }, 201);
});

app.put("/trips/:id", async (c) => {
  const id = idParam(c);
  const t = tripInput(await body(c));
  const res = await c.env.DB.prepare(
    `UPDATE trips SET title = ?, start_date = ?, end_date = ?, notes = ?, rating = ?, cover_url = ?, road_trip = ?, cruise = ? WHERE id = ?`,
  )
    .bind(t.title, t.start_date, t.end_date, t.notes, t.rating, t.cover_url, t.road_trip ? 1 : 0, t.cruise ? 1 : 0, id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  await c.env.DB.batch(placeInserts(c.env.DB, "trip_places", "trip_id", id, t.places));
  return c.json({ ok: true });
});

app.delete("/trips/:id", async (c) => {
  const id = idParam(c);
  const trip = await c.env.DB.prepare("SELECT idea_id FROM trips WHERE id = ?").bind(id).first<{ idea_id: number | null }>();
  if (!trip) throw new HttpError(404, "Not found");
  const stmts = [c.env.DB.prepare("DELETE FROM trips WHERE id = ?").bind(id)];
  if (trip.idea_id !== null) {
    stmts.push(c.env.DB.prepare("UPDATE ideas SET status = 'won' WHERE id = ? AND status = 'done'").bind(trip.idea_id));
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ---------- Ideas ----------

/** An http(s) link, or null. */
function cleanUrl(v: unknown) {
  const url = cleanText(v, 1000);
  return url && /^https?:\/\//.test(url) ? url : null;
}

function ideaInput(b: Record<string, unknown>): IdeaInput {
  const title = cleanText(b.title, 200);
  if (!title) throw new HttpError(400, "Give the idea a name");
  return {
    title,
    description: cleanText(b.description, 5000),
    cover_url: cleanUrl(b.cover_url),
    created_by: typeof b.created_by === "number" ? b.created_by : null,
    places: cleanPlaces(b.places),
    ...cleanDetails(b),
  };
}

type IdeaRow = Omit<Idea, "places" | "holiday_types"> & { holiday_types: string | null };

function parseTypes(raw: string | null): Idea["holiday_types"] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return cleanDetails({ holiday_types: v }).holiday_types;
  } catch {
    return [];
  }
}

app.get("/ideas", async (c) => {
  const [{ results }, places] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM ideas WHERE status != 'archived' ORDER BY created_at DESC").all<IdeaRow>(),
    loadPlaces(c.env.DB, "idea_places", "idea_id"),
  ]);
  return c.json(results.map((i) => ({ ...i, holiday_types: parseTypes(i.holiday_types), places: places.get(i.id) ?? [] })));
});

app.post("/ideas", async (c) => {
  const i = ideaInput(await body(c));
  // Travel time is always worked out from home, never typed in.
  const travel = estimateTravel(await loadHome(c.env.DB), i.places)?.travel_time ?? null;
  const row = await c.env.DB.prepare(
    `INSERT INTO ideas (title, description, cover_url, created_by, budget, trip_length, travel_time, holiday_types)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(i.title, i.description, i.cover_url, i.created_by ?? viewerId(c), i.budget, i.trip_length, travel, JSON.stringify(i.holiday_types))
    .first<{ id: number }>();
  await c.env.DB.batch(placeInserts(c.env.DB, "idea_places", "idea_id", row!.id, i.places));
  return c.json({ id: row!.id }, 201);
});

app.put("/ideas/:id", async (c) => {
  const id = idParam(c);
  const i = ideaInput(await body(c));
  // Without an estimate (no home, or no located places) the old travel time stays.
  const travel = estimateTravel(await loadHome(c.env.DB), i.places)?.travel_time ?? null;
  const res = await c.env.DB.prepare(
    `UPDATE ideas SET title = ?, description = ?, cover_url = ?, budget = ?, trip_length = ?, travel_time = COALESCE(?, travel_time), holiday_types = ?
     WHERE id = ? AND status != 'archived'`,
  )
    .bind(i.title, i.description, i.cover_url, i.budget, i.trip_length, travel, JSON.stringify(i.holiday_types), id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  await c.env.DB.batch(placeInserts(c.env.DB, "idea_places", "idea_id", id, i.places));
  // An edit can move an idea out of a filtered round's pool.
  await finishOpenShortlist(c.env.DB);
  return c.json({ ok: true });
});

app.delete("/ideas/:id", async (c) => {
  const id = idParam(c);
  const db = c.env.DB;
  const used = await db.prepare("SELECT 1 FROM allocations a JOIN rounds r ON r.id = a.round_id WHERE a.idea_id = ? AND r.status = 'drawn' LIMIT 1")
    .bind(id)
    .first();
  const open = await db.prepare("SELECT DISTINCT a.round_id, a.person_id FROM allocations a JOIN rounds r ON r.id = a.round_id WHERE a.idea_id = ? AND r.status = 'open'")
    .bind(id)
    .all<{ round_id: number; person_id: number }>();
  const stmts: D1PreparedStatement[] = [];
  // Anyone who had points on it in the open round gets those points back and is unlocked.
  for (const { round_id, person_id } of open.results) {
    stmts.push(db.prepare("DELETE FROM allocations WHERE round_id = ? AND person_id = ? AND idea_id = ?").bind(round_id, person_id, id));
    stmts.push(db.prepare("DELETE FROM round_locks WHERE round_id = ? AND person_id = ?").bind(round_id, person_id));
  }
  // Ideas that took part in a past draw are archived so the history still reads correctly.
  stmts.push(used ? db.prepare("UPDATE ideas SET status = 'archived' WHERE id = ?").bind(id) : db.prepare("DELETE FROM ideas WHERE id = ?").bind(id));
  await db.batch(stmts);
  // Removing the last idea someone had left to swipe can complete the shortlist.
  await finishOpenShortlist(db);
  return c.json({ ok: true });
});

// ---------- Rounds and the draw ----------

type RoundRow = Omit<Round, "locked" | "vetoes" | "allocations" | "ideas" | "filters" | "swipe" | "shortlist" | "my_swipes" | "swiping"> & {
  filters: string;
  swipe: number;
  shortlist: string | null;
};
type SwipeRow = { round_id: number; person_id: number; idea_id: number; liked: number };
const toSwipe = (s: Omit<SwipeRow, "round_id">): Swipe => ({ person_id: s.person_id, idea_id: s.idea_id, liked: !!s.liked });

async function loadRounds(db: D1Database, viewer: number | null, onlyId?: number): Promise<Round[]> {
  const where = onlyId === undefined ? "" : "WHERE id = ?";
  const roundsQ = db.prepare(`SELECT * FROM rounds ${where} ORDER BY id DESC`);
  const { results: rounds } = await (onlyId === undefined ? roundsQ : roundsQ.bind(onlyId)).all<RoundRow>();
  if (rounds.length === 0) return [];
  const [allocs, locks, vetoes, ideas, swipes, people] = await Promise.all([
    db.prepare("SELECT round_id, person_id, idea_id, points FROM allocations").all<Allocation & { round_id: number }>(),
    db.prepare("SELECT round_id, person_id FROM round_locks").all<{ round_id: number; person_id: number }>(),
    db.prepare("SELECT round_id, person_id, idea_id FROM round_vetoes").all<{ round_id: number; person_id: number; idea_id: number }>(),
    db.prepare("SELECT id, title, status FROM ideas").all<{ id: number; title: string; status: IdeaStatus }>(),
    db.prepare("SELECT round_id, person_id, idea_id, liked FROM round_swipes").all<SwipeRow>(),
    db.prepare("SELECT id FROM people").all<{ id: number }>(),
  ]);
  const ideaById = new Map(ideas.results.map((i) => [i.id, i]));
  // Who is still swiping only matters for an open round that's still building its shortlist.
  const building = rounds.find((r) => r.status === "open" && r.swipe && !r.shortlist);
  const pool = building ? await matchingIdeaIds(db, cleanFilters(building.filters)) : [];
  return rounds.map((r) => {
    const roundSwipes = swipes.results.filter((s) => s.round_id === r.id).map(toSwipe);
    const all = allocs.results.filter((a) => a.round_id === r.id);
    // Points stay secret until the draw: before it you only see your own.
    const visible = r.status === "drawn" ? all : all.filter((a) => a.person_id === viewer);
    const ideaIds = new Set(visible.map((a) => a.idea_id));
    if (r.winner_idea_id !== null) ideaIds.add(r.winner_idea_id);
    // Vetoes are secret too: before the draw you only see your own.
    const roundVetoes = vetoes.results
      .filter((v) => v.round_id === r.id && (r.status === "drawn" || v.person_id === viewer))
      .map(({ person_id, idea_id }) => ({ person_id, idea_id }));
    for (const v of roundVetoes) ideaIds.add(v.idea_id);
    return {
      ...r,
      filters: cleanFilters(r.filters),
      swipe: !!r.swipe,
      shortlist: parseShortlist(r.shortlist),
      my_swipes: roundSwipes.filter((x) => x.person_id === viewer).map(({ idea_id, liked }) => ({ idea_id, liked })),
      swiping: r === building ? people.results.map((p) => p.id).filter((id) => unswiped(id, pool, roundSwipes).length > 0) : [],
      locked: locks.results.filter((l) => l.round_id === r.id).map((l) => l.person_id),
      vetoes: roundVetoes,
      allocations: visible.map(({ person_id, idea_id, points }) => ({ person_id, idea_id, points })),
      ideas: [...ideaIds].flatMap((id) => {
        const i = ideaById.get(id);
        return i ? [i] : [];
      }),
    };
  });
}

async function openRound(db: D1Database, id: number) {
  const r = await db.prepare("SELECT id, points_per_person, status, swipe, shortlist, filters FROM rounds WHERE id = ?")
    .bind(id)
    .first<{ id: number; points_per_person: number; status: string; swipe: number; shortlist: string | null; filters: string }>();
  if (!r) throw new HttpError(404, "Not found");
  if (r.status !== "open") throw new HttpError(409, "This round has already been drawn");
  return r;
}

/** Active ideas that fit a round's filters. */
async function matchingIdeaIds(db: D1Database, filters: RoundFilters) {
  const { results } = await db
    .prepare("SELECT id, budget, trip_length, travel_time, holiday_types FROM ideas WHERE status = 'active'")
    .all<Omit<IdeaDetails, "holiday_types"> & { id: number; holiday_types: string | null }>();
  return results.filter((i) => matchesFilters({ ...i, holiday_types: parseTypes(i.holiday_types) }, filters)).map((i) => i.id);
}

/**
 * Ideas a person can put points on in a round: in the pool, fit its filters,
 * and not vetoed by that person. Someone else's veto is secret, so it doesn't
 * stop you spending points on that idea; those points just don't count in the draw.
 */
async function eligibleIdeaIds(db: D1Database, roundId: number, personId: number) {
  const [round, veto] = await Promise.all([
    db.prepare("SELECT filters, swipe, shortlist FROM rounds WHERE id = ?").bind(roundId).first<{ filters: string; swipe: number; shortlist: string | null }>(),
    db.prepare("SELECT idea_id FROM round_vetoes WHERE round_id = ? AND person_id = ?").bind(roundId, personId).first<{ idea_id: number }>(),
  ]);
  // A swipe round takes no points until its shortlist is made, then only shortlisted ideas.
  if (round?.swipe) {
    const shortlist = parseShortlist(round.shortlist);
    if (!shortlist) return new Set<number>();
    const active = new Set(await matchingIdeaIds(db, NO_FILTERS));
    return new Set(shortlist.ids.filter((id) => active.has(id) && id !== veto?.idea_id));
  }
  const ids = await matchingIdeaIds(db, cleanFilters(round?.filters));
  return new Set(ids.filter((id) => id !== veto?.idea_id));
}

async function isLocked(db: D1Database, roundId: number, personId: number) {
  return !!(await db.prepare("SELECT 1 FROM round_locks WHERE round_id = ? AND person_id = ?").bind(roundId, personId).first());
}

app.get("/rounds", async (c) => c.json(await loadRounds(c.env.DB, viewerId(c))));

app.post("/rounds", async (c) => {
  const b = await body(c);
  const points = typeof b.points_per_person === "number" ? Math.round(b.points_per_person) : 10;
  if (points < 1 || points > 100) throw new HttpError(400, "Points must be between 1 and 100");
  const existing = await c.env.DB.prepare("SELECT 1 FROM rounds WHERE status = 'open'").first();
  if (existing) throw new HttpError(409, "There is already an open round");
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM rounds").first<{ n: number }>();
  const name = cleanText(b.name, 100) ?? `Round ${(count?.n ?? 0) + 1}`;
  const filters = cleanFilters(b.filters);
  if ((await matchingIdeaIds(c.env.DB, filters)).length < 2) {
    throw new HttpError(400, "At least 2 ideas need to match the filters");
  }
  const row = await c.env.DB.prepare("INSERT INTO rounds (name, points_per_person, filters, swipe) VALUES (?, ?, ?, ?) RETURNING id")
    .bind(name, points, JSON.stringify(filters), b.swipe === true ? 1 : 0)
    .first<{ id: number }>();
  return c.json({ id: row!.id }, 201);
});

app.delete("/rounds/:id", async (c) => {
  const db = c.env.DB;
  const r = await db.prepare("SELECT id, winner_idea_id FROM rounds WHERE id = ?")
    .bind(idParam(c))
    .first<{ id: number; winner_idea_id: number | null }>();
  if (!r) throw new HttpError(404, "Not found");
  const stmts = [db.prepare("DELETE FROM rounds WHERE id = ?").bind(r.id)];
  // Deleting a draw puts its winner back in the pool, unless you've already turned it into a trip.
  if (r.winner_idea_id !== null) {
    stmts.push(db.prepare("UPDATE ideas SET status = 'active' WHERE id = ? AND status = 'won'").bind(r.winner_idea_id));
  }
  await db.batch(stmts);
  return c.json({ ok: true });
});

app.put("/rounds/:id/allocations", async (c) => {
  const viewer = requireViewer(c);
  const r = await openRound(c.env.DB, idParam(c));
  if (await isLocked(c.env.DB, r.id, viewer)) throw new HttpError(409, "Unlock your points before changing them");
  const b = await body(c);
  const entries = Array.isArray(b.allocations)
    ? b.allocations.map((a: { idea_id?: unknown; points?: unknown }) => ({ idea_id: Number(a?.idea_id), points: Number(a?.points) }))
    : [];
  const error = validateAllocation(entries, r.points_per_person, await eligibleIdeaIds(c.env.DB, r.id, viewer), false);
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
  const r = await openRound(c.env.DB, idParam(c));
  const { results } = await c.env.DB.prepare("SELECT idea_id, points FROM allocations WHERE round_id = ? AND person_id = ?")
    .bind(r.id, viewer)
    .all<{ idea_id: number; points: number }>();
  const error = validateAllocation(results, r.points_per_person, await eligibleIdeaIds(c.env.DB, r.id, viewer), true);
  if (error) throw new HttpError(400, error);
  await c.env.DB.prepare("INSERT OR IGNORE INTO round_locks (round_id, person_id) VALUES (?, ?)").bind(r.id, viewer).run();
  return c.json({ ok: true });
});

app.delete("/rounds/:id/lock", async (c) => {
  const viewer = requireViewer(c);
  const r = await openRound(c.env.DB, idParam(c));
  await c.env.DB.prepare("DELETE FROM round_locks WHERE round_id = ? AND person_id = ?").bind(r.id, viewer).run();
  return c.json({ ok: true });
});

/**
 * Fixes a swipe round's shortlist once everyone has swiped every idea in its
 * pool. Safe to call any time; it does nothing until then, or once it's set.
 */
async function finishShortlist(db: D1Database, roundId: number) {
  const r = await db.prepare("SELECT filters FROM rounds WHERE id = ? AND status = 'open' AND swipe = 1 AND shortlist IS NULL")
    .bind(roundId)
    .first<{ filters: string }>();
  if (!r) return;
  const [pool, people, swipes] = await Promise.all([
    matchingIdeaIds(db, cleanFilters(r.filters)),
    db.prepare("SELECT id FROM people").all<{ id: number }>(),
    db.prepare("SELECT person_id, idea_id, liked FROM round_swipes WHERE round_id = ?").bind(roundId).all<Omit<SwipeRow, "round_id">>(),
  ]);
  const all = swipes.results.map(toSwipe);
  const ids = people.results.map((p) => p.id);
  if (ids.some((id) => unswiped(id, pool, all).length > 0)) return;
  const shortlist = buildShortlist(pool, ids, all);
  await db.prepare("UPDATE rounds SET shortlist = ? WHERE id = ? AND shortlist IS NULL").bind(JSON.stringify(shortlist), roundId).run();
}

async function finishOpenShortlist(db: D1Database) {
  const r = await db.prepare("SELECT id FROM rounds WHERE status = 'open'").first<{ id: number }>();
  if (r) await finishShortlist(db, r.id);
}

app.put("/rounds/:id/swipes", async (c) => {
  const viewer = requireViewer(c);
  const db = c.env.DB;
  const r = await openRound(db, idParam(c));
  if (!r.swipe) throw new HttpError(400, "This round doesn't use swiping");
  if (r.shortlist) throw new HttpError(409, "The shortlist is already made");
  const b = await body(c);
  const ideaId = Number(b.idea_id);
  if (typeof b.liked !== "boolean") throw new HttpError(400, "Say yes or no");
  if (!(await matchingIdeaIds(db, cleanFilters(r.filters))).includes(ideaId)) throw new HttpError(400, "That idea isn't in this round");
  await db.prepare("INSERT OR REPLACE INTO round_swipes (round_id, person_id, idea_id, liked) VALUES (?, ?, ?, ?)")
    .bind(r.id, viewer, ideaId, b.liked ? 1 : 0)
    .run();
  await finishShortlist(db, r.id);
  return c.json({ ok: true });
});

app.post("/rounds/:id/veto", async (c) => {
  const viewer = requireViewer(c);
  const db = c.env.DB;
  const r = await openRound(db, idParam(c));
  if (await isLocked(db, r.id, viewer)) throw new HttpError(409, "Unlock your points before using your veto");
  const b = await body(c);
  const ideaId = Number(b.idea_id);
  const existing = await db.prepare("SELECT 1 FROM round_vetoes WHERE round_id = ? AND person_id = ?").bind(r.id, viewer).first();
  if (existing) throw new HttpError(409, "You've already used your veto this round");
  const eligible = await eligibleIdeaIds(db, r.id, viewer);
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
  const r = await openRound(c.env.DB, idParam(c));
  if (await isLocked(c.env.DB, r.id, viewer)) throw new HttpError(409, "Unlock your points before changing your veto");
  await c.env.DB.prepare("DELETE FROM round_vetoes WHERE round_id = ? AND person_id = ?").bind(r.id, viewer).run();
  return c.json({ ok: true });
});

app.post("/rounds/:id/draw", async (c) => {
  const db = c.env.DB;
  const r = await openRound(db, idParam(c));
  const [people, locks, allocs, vetoes] = await Promise.all([
    db.prepare("SELECT id FROM people").all<{ id: number }>(),
    db.prepare("SELECT person_id FROM round_locks WHERE round_id = ?").bind(r.id).all<{ person_id: number }>(),
    db.prepare("SELECT person_id, idea_id, points FROM allocations WHERE round_id = ?").bind(r.id).all<Allocation>(),
    db.prepare("SELECT idea_id FROM round_vetoes WHERE round_id = ?").bind(r.id).all<{ idea_id: number }>(),
  ]);
  const lockedIds = new Set(locks.results.map((l) => l.person_id));
  if (!people.results.every((p) => lockedIds.has(p.id))) throw new HttpError(409, "Everyone needs to lock in their points first");

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
  const [round] = await loadRounds(db, viewerId(c), r.id);
  return c.json(round);
});

// ---------- Settings ----------

async function loadHome(db: D1Database): Promise<Home> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'home'").first<{ value: string }>();
  try {
    return row ? (cleanPlaces([JSON.parse(row.value)])[0] ?? null) : null;
  } catch {
    return null;
  }
}

app.get("/home", async (c) => c.json(await loadHome(c.env.DB)));

app.put("/home", async (c) => {
  const b = await body(c);
  const [home] = cleanPlaces([b.home]);
  if (b.home !== null && (!home || home.lat === null || home.lon === null)) throw new HttpError(400, "Pick home from the search so it has a location");
  await c.env.DB.prepare(home ? "INSERT OR REPLACE INTO settings (key, value) VALUES ('home', ?)" : "DELETE FROM settings WHERE key = 'home'")
    .bind(...(home ? [JSON.stringify(home)] : []))
    .run();
  return c.json({ ok: true });
});

// ---------- Place search ----------

app.get("/geocode", async (c) => {
  const q = cleanText(c.req.query("q"), 200);
  if (!q || q.length < 2) return c.json([]);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
    "accept-language": "en",
    featureType: "settlement",
  }).toString();
  const res = await fetch(url, {
    headers: { "User-Agent": "NextTrip holiday planner (https://github.com/MattGibbard/NextTrip)" },
    cf: { cacheTtl: 86400, cacheEverything: true },
  }).catch(() => null);
  if (!res?.ok) throw new HttpError(409, "Place search is unavailable right now");
  return c.json(parseNominatim(await res.json()));
});

app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default app;
