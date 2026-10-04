import { Hono } from "hono";
import type { Context } from "hono";
import schemaSql from "../migrations/0001_init.sql?raw";
import { ideaForTicket, randomTicket, ticketRanges, validateAllocation } from "../shared/draw";
import { parseNominatim } from "../shared/geocode";
import type {
  Allocation,
  Idea,
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

/** Statements from the (idempotent) schema file, without comments. */
export function schemaStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Create the tables on first use, once per Worker instance, so the site works
// even if the deploy never ran `wrangler d1 migrations apply`.
app.use("*", async (c, next) => {
  if (!c.env.DB) {
    return c.json({ error: "The database isn't connected. Check the D1 binding named DB on the Worker." }, 500);
  }
  schemaReady ??= c.env.DB.batch(schemaStatements(schemaSql).map((s) => c.env.DB.prepare(s)))
    .then(() => undefined)
    .catch((err) => {
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
  const cover = cleanText(b.cover_url, 1000);
  return {
    title,
    start_date: date(b.start_date),
    end_date: date(b.end_date),
    notes: cleanText(b.notes, 5000),
    rating,
    cover_url: cover && /^https?:\/\//.test(cover) ? cover : null,
    idea_id: typeof b.idea_id === "number" ? b.idea_id : null,
    created_by: typeof b.created_by === "number" ? b.created_by : null,
    places: cleanPlaces(b.places),
  };
}

app.get("/trips", async (c) => {
  const [{ results }, places] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM trips ORDER BY COALESCE(start_date, created_at) DESC").all<Omit<Trip, "places">>(),
    loadPlaces(c.env.DB, "trip_places", "trip_id"),
  ]);
  return c.json(results.map((t) => ({ ...t, places: places.get(t.id) ?? [] })));
});

app.post("/trips", async (c) => {
  const t = tripInput(await body(c));
  const row = await c.env.DB.prepare(
    `INSERT INTO trips (title, start_date, end_date, notes, rating, cover_url, idea_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(t.title, t.start_date, t.end_date, t.notes, t.rating, t.cover_url, t.idea_id, t.created_by ?? viewerId(c))
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
    `UPDATE trips SET title = ?, start_date = ?, end_date = ?, notes = ?, rating = ?, cover_url = ? WHERE id = ?`,
  )
    .bind(t.title, t.start_date, t.end_date, t.notes, t.rating, t.cover_url, id)
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

function ideaInput(b: Record<string, unknown>): IdeaInput {
  const title = cleanText(b.title, 200);
  if (!title) throw new HttpError(400, "Give the idea a name");
  return {
    title,
    description: cleanText(b.description, 5000),
    created_by: typeof b.created_by === "number" ? b.created_by : null,
    places: cleanPlaces(b.places),
  };
}

app.get("/ideas", async (c) => {
  const [{ results }, places] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM ideas WHERE status != 'archived' ORDER BY created_at DESC").all<Omit<Idea, "places">>(),
    loadPlaces(c.env.DB, "idea_places", "idea_id"),
  ]);
  return c.json(results.map((i) => ({ ...i, places: places.get(i.id) ?? [] })));
});

app.post("/ideas", async (c) => {
  const i = ideaInput(await body(c));
  const row = await c.env.DB.prepare("INSERT INTO ideas (title, description, created_by) VALUES (?, ?, ?) RETURNING id")
    .bind(i.title, i.description, i.created_by ?? viewerId(c))
    .first<{ id: number }>();
  await c.env.DB.batch(placeInserts(c.env.DB, "idea_places", "idea_id", row!.id, i.places));
  return c.json({ id: row!.id }, 201);
});

app.put("/ideas/:id", async (c) => {
  const id = idParam(c);
  const i = ideaInput(await body(c));
  const res = await c.env.DB.prepare("UPDATE ideas SET title = ?, description = ? WHERE id = ? AND status != 'archived'")
    .bind(i.title, i.description, id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  await c.env.DB.batch(placeInserts(c.env.DB, "idea_places", "idea_id", id, i.places));
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
  return c.json({ ok: true });
});

// ---------- Rounds and the draw ----------

async function loadRounds(db: D1Database, viewer: number | null, onlyId?: number): Promise<Round[]> {
  const where = onlyId === undefined ? "" : "WHERE id = ?";
  const roundsQ = db.prepare(`SELECT * FROM rounds ${where} ORDER BY id DESC`);
  const { results: rounds } = await (onlyId === undefined ? roundsQ : roundsQ.bind(onlyId)).all<Omit<Round, "locked" | "allocations" | "ideas">>();
  if (rounds.length === 0) return [];
  const [allocs, locks, ideas] = await Promise.all([
    db.prepare("SELECT round_id, person_id, idea_id, points FROM allocations").all<Allocation & { round_id: number }>(),
    db.prepare("SELECT round_id, person_id FROM round_locks").all<{ round_id: number; person_id: number }>(),
    db.prepare("SELECT id, title, status FROM ideas").all<{ id: number; title: string; status: IdeaStatus }>(),
  ]);
  const ideaById = new Map(ideas.results.map((i) => [i.id, i]));
  return rounds.map((r) => {
    const all = allocs.results.filter((a) => a.round_id === r.id);
    // Points stay secret until the draw: before it you only see your own.
    const visible = r.status === "drawn" ? all : all.filter((a) => a.person_id === viewer);
    const ideaIds = new Set(visible.map((a) => a.idea_id));
    if (r.winner_idea_id !== null) ideaIds.add(r.winner_idea_id);
    return {
      ...r,
      locked: locks.results.filter((l) => l.round_id === r.id).map((l) => l.person_id),
      allocations: visible.map(({ person_id, idea_id, points }) => ({ person_id, idea_id, points })),
      ideas: [...ideaIds].flatMap((id) => {
        const i = ideaById.get(id);
        return i ? [i] : [];
      }),
    };
  });
}

async function openRound(db: D1Database, id: number) {
  const r = await db.prepare("SELECT id, points_per_person, status FROM rounds WHERE id = ?")
    .bind(id)
    .first<{ id: number; points_per_person: number; status: string }>();
  if (!r) throw new HttpError(404, "Not found");
  if (r.status !== "open") throw new HttpError(409, "This round has already been drawn");
  return r;
}

async function activeIdeaIds(db: D1Database) {
  const { results } = await db.prepare("SELECT id FROM ideas WHERE status = 'active'").all<{ id: number }>();
  return new Set(results.map((r) => r.id));
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
  const row = await c.env.DB.prepare("INSERT INTO rounds (name, points_per_person) VALUES (?, ?) RETURNING id")
    .bind(name, points)
    .first<{ id: number }>();
  return c.json({ id: row!.id }, 201);
});

app.delete("/rounds/:id", async (c) => {
  const r = await openRound(c.env.DB, idParam(c));
  await c.env.DB.prepare("DELETE FROM rounds WHERE id = ?").bind(r.id).run();
  return c.json({ ok: true });
});

app.put("/rounds/:id/allocations", async (c) => {
  const viewer = requireViewer(c);
  const r = await openRound(c.env.DB, idParam(c));
  const locked = await c.env.DB.prepare("SELECT 1 FROM round_locks WHERE round_id = ? AND person_id = ?").bind(r.id, viewer).first();
  if (locked) throw new HttpError(409, "Unlock your points before changing them");
  const b = await body(c);
  const entries = Array.isArray(b.allocations)
    ? b.allocations.map((a: { idea_id?: unknown; points?: unknown }) => ({ idea_id: Number(a?.idea_id), points: Number(a?.points) }))
    : [];
  const error = validateAllocation(entries, r.points_per_person, await activeIdeaIds(c.env.DB), false);
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
  const error = validateAllocation(results, r.points_per_person, await activeIdeaIds(c.env.DB), true);
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

app.post("/rounds/:id/draw", async (c) => {
  const db = c.env.DB;
  const r = await openRound(db, idParam(c));
  const [people, locks, allocs] = await Promise.all([
    db.prepare("SELECT id FROM people").all<{ id: number }>(),
    db.prepare("SELECT person_id FROM round_locks WHERE round_id = ?").bind(r.id).all<{ person_id: number }>(),
    db.prepare("SELECT person_id, idea_id, points FROM allocations WHERE round_id = ?").bind(r.id).all<Allocation>(),
  ]);
  const lockedIds = new Set(locks.results.map((l) => l.person_id));
  if (!people.results.every((p) => lockedIds.has(p.id))) throw new HttpError(409, "Everyone needs to lock in their points first");

  const ranges = ticketRanges(allocs.results);
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
