import { Hono } from "hono";
import { migrate } from "./migrate";
import { authRoutes, familyRoutes, readSession, requireOwner, sessionJson, setOwnerPerson, setSessionPerson } from "./auth";
import { HttpError } from "./env";
import type { App, Ctx, Env } from "./env";
import { servePage } from "./pages";
import { cmsRoutes } from "./cms";
import { findPhotos, savePhoto, servePhoto } from "./photos";
import { PHOTO_PATH } from "../shared/photos";
import { countedAllocations, ideaForTicket, randomTicket, ticketRanges, validateAllocation } from "../shared/draw";
import { parseNominatim } from "../shared/geocode";
import { cleanDetails } from "../shared/ideaDetails";
import { estimateTravel } from "../shared/travelTime";
import { ideaMode, tripMode } from "../shared/travelMode";
import { endsForMode } from "../shared/terminals";
import type { Terminal } from "../shared/terminals";
import { cleanTerminal, findTerminals, nearestAirport } from "./terminals";
import { NO_FILTERS, cleanFilters, matchesFilters } from "../shared/roundFilters";
import { buildShortlist, parseShortlist, unswiped } from "../shared/shortlist";
import type { Swipe } from "../shared/shortlist";
import type { RoundFilters } from "../shared/roundFilters";
import type {
  Allocation,
  Bootstrap,
  FamilyData,
  FamilyPart,
  HomeEnds,
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

const app = new Hono<App>().basePath("/api");

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

// The content editor's GitHub sign-in needs no database, so it comes before the database check.
cmsRoutes(app);

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

// Picked cover photos load as plain images, without a sign-in. Their keys are long and random.
app.get("/photos/:key", (c) => servePhoto(c.env.DB, c.req.param("key")));

authRoutes(app);

// What the signed-in app needs to open, in one request: who this browser is and the family's things.
// The app also uses it to refresh, with ?only=rounds,ideas to fetch just the lists that changed.
app.get("/bootstrap", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ session: { signed_in: false }, data: null } satisfies Bootstrap);
  const asked = (c.req.query("only") ?? "").split(",").filter((p): p is FamilyPart => (FAMILY_PARTS as readonly string[]).includes(p));
  const data = await loadFamily(c.env.DB, session.family, session.person, asked.length ? asked : FAMILY_PARTS);
  return c.json({ session: sessionJson(session), data } satisfies Bootstrap);
});

// Everything below needs a signed-in family. Which family member this browser
// is comes from its session, so nobody can act or vote as someone else.
app.use("*", async (c, next) => {
  const session = await readSession(c);
  if (!session) throw new HttpError(401, "Sign in to carry on");
  c.set("family", session.family);
  c.set("role", session.role);
  c.set("person", session.person);
  await next();
});

familyRoutes(app);

function viewerId(c: Ctx): number | null {
  return c.get("person");
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

app.get("/people", async (c) => c.json((await loadFamily(c.env.DB, c.get("family"), viewerId(c), ["people"])).people));

function personInput(b: Record<string, unknown>) {
  const name = cleanText(b.name, 40);
  const color = typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : null;
  if (!name) throw new HttpError(400, "Name is required");
  return { name, color };
}

// Anyone in the family without a name yet can add themselves, and this browser
// becomes them. The organiser can also add people who aren't on somewhere🎉 themselves.
app.post("/people", async (c) => {
  const isOwner = c.get("role") === "owner";
  if (viewerId(c) !== null && !isOwner) throw new HttpError(403, "You're already in the family on this device");
  const { name, color } = personInput(await body(c));
  const db = c.env.DB;
  const count = await db.prepare("SELECT COUNT(*) AS n FROM people WHERE family_id = ? AND removed = 0").bind(c.get("family")).first<{ n: number }>();
  if ((count?.n ?? 0) >= 30) throw new HttpError(409, "A family can have up to 30 people");
  const row = await db.prepare("INSERT INTO people (name, color, family_id) VALUES (?, ?, ?) RETURNING id")
    .bind(name, color ?? "#2563eb", c.get("family"))
    .first<{ id: number }>();
  if (viewerId(c) === null) {
    await setSessionPerson(c, row!.id);
    if (isOwner) await setOwnerPerson(c, c.get("family"), row!.id);
  }
  // A newcomer joins a shortlist still being made, so it waits for their swipes too.
  return c.json({ id: row!.id }, 201);
});

// The organiser can say which of the family they are on this device. Everyone
// else gets an existing name only through a link the organiser sends them.
app.post("/me", async (c) => {
  requireOwner(c);
  const id = Number((await body(c)).person_id);
  const row = Number.isInteger(id)
    ? await c.env.DB.prepare("SELECT id FROM people WHERE id = ? AND family_id = ? AND removed = 0").bind(id, c.get("family")).first<{ id: number }>()
    : null;
  if (!row) throw new HttpError(404, "Not found");
  await setSessionPerson(c, row.id);
  await setOwnerPerson(c, c.get("family"), row.id);
  return c.json({ ok: true });
});

// The welcome steps are shown once to each person, the first time they're in.
app.post("/me/onboarded", async (c) => {
  const id = viewerId(c);
  if (id === null) throw new HttpError(409, "Give your name first");
  await c.env.DB.prepare("UPDATE people SET onboarded = 1 WHERE id = ? AND family_id = ?").bind(id, c.get("family")).run();
  return c.json({ ok: true });
});

// The organiser can rename anyone; everyone else only themselves.
app.put("/people/:id", async (c) => {
  const id = idParam(c);
  if (c.get("role") !== "owner" && viewerId(c) !== id) throw new HttpError(403, "You can only change your own name");
  const { name, color } = personInput(await body(c));
  const res = await c.env.DB.prepare("UPDATE people SET name = ?, color = COALESCE(?, color) WHERE id = ? AND family_id = ? AND removed = 0")
    .bind(name, color, id, c.get("family"))
    .run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  return c.json({ ok: true });
});

// Removing someone keeps their name on past draws, but takes them out of the open round.
app.delete("/people/:id", async (c) => {
  requireOwner(c);
  const id = idParam(c);
  const db = c.env.DB;
  const family = c.get("family");
  const res = await db.prepare("UPDATE people SET removed = 1 WHERE id = ? AND family_id = ? AND removed = 0").bind(id, family).run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  const open = "(SELECT id FROM rounds WHERE family_id = ? AND status = 'open')";
  await db.batch([
    ...["allocations", "round_locks", "round_vetoes", "round_swipes"].map((t) =>
      db.prepare(`DELETE FROM ${t} WHERE person_id = ? AND round_id IN ${open}`).bind(id, family),
    ),
    // Their devices are signed out too.
    db.prepare("DELETE FROM sessions WHERE person_id = ? AND role = 'member'").bind(id),
    db.prepare("DELETE FROM person_links WHERE person_id = ?").bind(id),
  ]);
  // They may have been the last one still swiping.
  await finishOpenShortlist(db, family);
  return c.json({ ok: true });
});

// ---------- Places helpers ----------

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

const terminalJson = (t: Terminal | null) => (t ? JSON.stringify(t) : null);

type EndsRow = { depart: string | null; arrive: string | null };
const parseEnds = (r: EndsRow) => ({ depart: cleanTerminal(r.depart), arrive: cleanTerminal(r.arrive) });

function tripInput(b: Record<string, unknown>): TripInput {
  const title = cleanText(b.title, 200);
  if (!title) throw new HttpError(400, "Give the trip a name");
  const date = (v: unknown) => {
    const t = cleanText(v, 10);
    return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
  };
  const flags = { road_trip: b.road_trip === true, cruise: b.cruise === true, rail: b.rail === true };
  const rating = typeof b.rating === "number" && b.rating >= 1 && b.rating <= 5 ? Math.round(b.rating) : null;
  const cover = cleanUrl(b.cover_url);
  return {
    title,
    start_date: date(b.start_date),
    end_date: date(b.end_date),
    notes: cleanText(b.notes, 5000),
    rating,
    cover_url: cover,
    ...flags,
    ...endsForMode(tripMode(flags), cleanTerminal(b.depart), cleanTerminal(b.arrive)),
    idea_id: typeof b.idea_id === "number" ? b.idea_id : null,
    created_by: typeof b.created_by === "number" ? b.created_by : null,
    places: cleanPlaces(b.places),
  };
}

app.get("/trips", async (c) => c.json((await loadFamily(c.env.DB, c.get("family"), viewerId(c), ["trips"])).trips));

/** The id if it's one of this family's ideas, otherwise null. */
async function familyIdea(c: Ctx, id: number | null) {
  if (id === null) return null;
  const row = await c.env.DB.prepare("SELECT id FROM ideas WHERE id = ? AND family_id = ?").bind(id, c.get("family")).first<{ id: number }>();
  return row?.id ?? null;
}

/** The id if it's one of this family's people, otherwise whoever is using this browser. */
async function familyPerson(c: Ctx, id: number | null) {
  if (id === null) return viewerId(c);
  const row = await c.env.DB.prepare("SELECT id FROM people WHERE id = ? AND family_id = ?").bind(id, c.get("family")).first<{ id: number }>();
  return row?.id ?? viewerId(c);
}

app.post("/trips", async (c) => {
  const t = tripInput(await body(c));
  t.idea_id = await familyIdea(c, t.idea_id);
  const row = await c.env.DB.prepare(
    `INSERT INTO trips (title, start_date, end_date, notes, rating, cover_url, road_trip, cruise, rail, depart, arrive, idea_id, created_by, family_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(t.title, t.start_date, t.end_date, t.notes, t.rating, t.cover_url, t.road_trip ? 1 : 0, t.cruise ? 1 : 0, t.rail ? 1 : 0, terminalJson(t.depart), terminalJson(t.arrive), t.idea_id, await familyPerson(c, t.created_by), c.get("family"))
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
    `UPDATE trips SET title = ?, start_date = ?, end_date = ?, notes = ?, rating = ?, cover_url = ?, road_trip = ?, cruise = ?, rail = ?, depart = ?, arrive = ? WHERE id = ? AND family_id = ?`,
  )
    .bind(t.title, t.start_date, t.end_date, t.notes, t.rating, t.cover_url, t.road_trip ? 1 : 0, t.cruise ? 1 : 0, t.rail ? 1 : 0, terminalJson(t.depart), terminalJson(t.arrive), id, c.get("family"))
    .run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  await c.env.DB.batch(placeInserts(c.env.DB, "trip_places", "trip_id", id, t.places));
  return c.json({ ok: true });
});

app.delete("/trips/:id", async (c) => {
  requireOwner(c);
  const id = idParam(c);
  const trip = await c.env.DB.prepare("SELECT idea_id FROM trips WHERE id = ? AND family_id = ?").bind(id, c.get("family")).first<{ idea_id: number | null }>();
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
  return url && (/^https?:\/\//.test(url) || new RegExp(`^${PHOTO_PATH}[0-9a-f]{32}$`).test(url)) ? url : null;
}

function ideaInput(b: Record<string, unknown>): IdeaInput {
  const title = cleanText(b.title, 200);
  if (!title) throw new HttpError(400, "Give the idea a name");
  const details = cleanDetails(b);
  return {
    title,
    description: cleanText(b.description, 5000),
    cover_url: cleanUrl(b.cover_url),
    created_by: typeof b.created_by === "number" ? b.created_by : null,
    places: cleanPlaces(b.places),
    ...endsForMode(ideaMode(details.holiday_types), cleanTerminal(b.depart), cleanTerminal(b.arrive)),
    ...details,
  };
}

type IdeaRow = Omit<Idea, "places" | "holiday_types" | "depart" | "arrive"> & { holiday_types: string | null } & EndsRow;

function parseTypes(raw: string | null): Idea["holiday_types"] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return cleanDetails({ holiday_types: v }).holiday_types;
  } catch {
    return [];
  }
}

app.get("/ideas", async (c) => c.json((await loadFamily(c.env.DB, c.get("family"), viewerId(c), ["ideas"])).ideas));

app.post("/ideas", async (c) => {
  const i = ideaInput(await body(c));
  // Travel time is always worked out from the departure point or the home airport, never typed in.
  const travel = estimateTravel(i.depart ?? (await loadHomeEnds(c.env.DB, c.get("family"))).airport, i.places)?.travel_time ?? null;
  const row = await c.env.DB.prepare(
    `INSERT INTO ideas (title, description, cover_url, created_by, budget, trip_length, travel_time, holiday_types, depart, arrive, family_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(i.title, i.description, i.cover_url, await familyPerson(c, i.created_by), i.budget, i.trip_length, travel, JSON.stringify(i.holiday_types), terminalJson(i.depart), terminalJson(i.arrive), c.get("family"))
    .first<{ id: number }>();
  await c.env.DB.batch(placeInserts(c.env.DB, "idea_places", "idea_id", row!.id, i.places));
  return c.json({ id: row!.id }, 201);
});

app.put("/ideas/:id", async (c) => {
  const id = idParam(c);
  const i = ideaInput(await body(c));
  // Without an estimate (no departure or home airport, or no located places) the old travel time stays.
  const travel = estimateTravel(i.depart ?? (await loadHomeEnds(c.env.DB, c.get("family"))).airport, i.places)?.travel_time ?? null;
  const res = await c.env.DB.prepare(
    `UPDATE ideas SET title = ?, description = ?, cover_url = ?, budget = ?, trip_length = ?, travel_time = COALESCE(?, travel_time), holiday_types = ?, depart = ?, arrive = ?
     WHERE id = ? AND family_id = ? AND status != 'archived'`,
  )
    .bind(i.title, i.description, i.cover_url, i.budget, i.trip_length, travel, JSON.stringify(i.holiday_types), terminalJson(i.depart), terminalJson(i.arrive), id, c.get("family"))
    .run();
  if (!res.meta.changes) throw new HttpError(404, "Not found");
  await c.env.DB.batch(placeInserts(c.env.DB, "idea_places", "idea_id", id, i.places));
  // An edit can move an idea out of a filtered round's pool.
  await finishOpenShortlist(c.env.DB, c.get("family"));
  return c.json({ ok: true });
});

app.delete("/ideas/:id", async (c) => {
  requireOwner(c);
  const id = idParam(c);
  const db = c.env.DB;
  if ((await familyIdea(c, id)) === null) throw new HttpError(404, "Not found");
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
  await finishOpenShortlist(db, c.get("family"));
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

/** People in a family who take part in draws. */
async function activePeople(db: D1Database, family: number) {
  const { results } = await db.prepare("SELECT id FROM people WHERE family_id = ? AND removed = 0").bind(family).all<{ id: number }>();
  return results.map((p) => p.id);
}

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

/** Active ideas that fit a round's filters. */
async function matchingIdeaIds(db: D1Database, family: number, filters: RoundFilters) {
  const { results } = await db
    .prepare("SELECT id, status, budget, trip_length, travel_time, holiday_types FROM ideas WHERE family_id = ? AND status = 'active'")
    .bind(family)
    .all<MatchRow>();
  return matchingIds(results, filters);
}

type MatchRow = Omit<IdeaDetails, "holiday_types"> & { id: number; status: IdeaStatus; holiday_types: string | null };

/** The active ideas among these that fit a round's filters. */
function matchingIds(ideas: MatchRow[], filters: RoundFilters) {
  return ideas.filter((i) => i.status === "active" && matchesFilters({ ...i, holiday_types: parseTypes(i.holiday_types) }, filters)).map((i) => i.id);
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
  const row = await c.env.DB.prepare("INSERT INTO rounds (name, points_per_person, filters, swipe, family_id) VALUES (?, ?, ?, ?, ?) RETURNING id")
    .bind(name, points, JSON.stringify(filters), b.swipe === true ? 1 : 0, family)
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
  // Deleting a draw puts its winner back in the pool, unless you've already turned it into a trip.
  if (r.winner_idea_id !== null) {
    stmts.push(db.prepare("UPDATE ideas SET status = 'active' WHERE id = ? AND status = 'won'").bind(r.winner_idea_id));
  }
  await db.batch(stmts);
  return c.json({ ok: true });
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

async function finishOpenShortlist(db: D1Database, family: number) {
  const r = await db.prepare("SELECT id FROM rounds WHERE family_id = ? AND status = 'open'").bind(family).first<{ id: number }>();
  if (r) await finishShortlist(db, family, r.id);
}

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

// ---------- Loading a family's things ----------

const FAMILY_PARTS = ["people", "trips", "ideas", "rounds", "home_ends"] as const satisfies readonly FamilyPart[];

type PersonRow = Omit<Person, "removed" | "onboarded"> & { removed: number; onboarded: number };
type TripRow = Omit<Trip, "places" | "road_trip" | "cruise" | "rail" | "depart" | "arrive"> & { road_trip: number; cruise: number; rail: number } & EndsRow;
type PlaceRow = Place & { owner: number };

const placesSql = (table: "trip_places" | "idea_places", key: "trip_id" | "idea_id", parent: "trips" | "ideas") =>
  `SELECT ${key} AS owner, name, country, country_code, lat, lon FROM ${table}
   WHERE ${key} IN (SELECT id FROM ${parent} WHERE family_id = ?) ORDER BY ${key}, position`;

function byOwner(rows: PlaceRow[]) {
  const map = new Map<number, Place[]>();
  for (const { owner, ...place } of rows) {
    const list = map.get(owner) ?? [];
    list.push(place);
    map.set(owner, list);
  }
  return map;
}

/**
 * The lists the app shows, or just some of them. Every read goes in one batch, so however many
 * lists are asked for it's a single trip to the database. Each query takes the family as its only value.
 */
async function loadFamily(db: D1Database, family: number, viewer: number | null, parts: readonly FamilyPart[]): Promise<Partial<FamilyData>> {
  const want = new Set(parts);
  const rounds = want.has("rounds");
  const mine = "round_id IN (SELECT id FROM rounds WHERE family_id = ?)";
  const sql = {
    // Rounds need the people (who's still swiping) and every idea, archived ones too (past draws).
    people: want.has("people") || rounds ? "SELECT id, name, color, removed, onboarded FROM people WHERE family_id = ? ORDER BY id" : null,
    trips: want.has("trips") ? "SELECT * FROM trips WHERE family_id = ? ORDER BY COALESCE(start_date, created_at) DESC" : null,
    tripPlaces: want.has("trips") ? placesSql("trip_places", "trip_id", "trips") : null,
    ideas: want.has("ideas") || rounds ? "SELECT * FROM ideas WHERE family_id = ? ORDER BY created_at DESC" : null,
    ideaPlaces: want.has("ideas") ? placesSql("idea_places", "idea_id", "ideas") : null,
    rounds: rounds ? "SELECT * FROM rounds WHERE family_id = ? ORDER BY id DESC" : null,
    allocations: rounds ? `SELECT round_id, person_id, idea_id, points FROM allocations WHERE ${mine}` : null,
    locks: rounds ? `SELECT round_id, person_id FROM round_locks WHERE ${mine}` : null,
    vetoes: rounds ? `SELECT round_id, person_id, idea_id FROM round_vetoes WHERE ${mine}` : null,
    swipes: rounds ? `SELECT round_id, person_id, idea_id, liked FROM round_swipes WHERE ${mine}` : null,
    homeEnds: want.has("home_ends") ? "SELECT key, value FROM family_settings WHERE family_id = ? AND key IN ('home_airport', 'home_station')" : null,
  };
  const keys = (Object.keys(sql) as (keyof typeof sql)[]).filter((k) => sql[k] !== null);
  const results = await db.batch(keys.map((k) => db.prepare(sql[k]!).bind(family)));
  const rows = <T>(k: keyof typeof sql) => (results[keys.indexOf(k)]?.results ?? []) as T[];

  const out: Partial<FamilyData> = {};
  const people = rows<PersonRow>("people").map((p) => ({ ...p, removed: !!p.removed, onboarded: !!p.onboarded }));
  if (want.has("people")) out.people = people;
  if (want.has("trips")) {
    const places = byOwner(rows<PlaceRow>("tripPlaces"));
    out.trips = rows<TripRow>("trips").map((t) => ({ ...t, road_trip: !!t.road_trip, cruise: !!t.cruise, rail: !!t.rail, ...parseEnds(t), places: places.get(t.id) ?? [] }));
  }
  const ideas = rows<IdeaRow>("ideas");
  if (want.has("ideas")) {
    const places = byOwner(rows<PlaceRow>("ideaPlaces"));
    out.ideas = ideas
      .filter((i) => i.status !== "archived")
      .map((i) => ({ ...i, holiday_types: parseTypes(i.holiday_types), ...parseEnds(i), places: places.get(i.id) ?? [] }));
  }
  if (rounds) {
    out.rounds = buildRounds({
      rounds: rows<RoundRow>("rounds"),
      allocations: rows<Allocation & { round_id: number }>("allocations"),
      locks: rows<{ round_id: number; person_id: number }>("locks"),
      vetoes: rows<{ round_id: number; person_id: number; idea_id: number }>("vetoes"),
      swipes: rows<SwipeRow>("swipes"),
      ideas,
      people: people.filter((p) => !p.removed).map((p) => p.id),
      viewer,
    });
  }
  if (want.has("home_ends")) out.home_ends = homeEndsFrom(rows<{ key: string; value: string }>("homeEnds"));
  return out;
}

function buildRounds({
  rounds,
  allocations,
  locks,
  vetoes,
  swipes,
  ideas,
  people,
  viewer,
}: {
  rounds: RoundRow[];
  allocations: (Allocation & { round_id: number })[];
  locks: { round_id: number; person_id: number }[];
  vetoes: { round_id: number; person_id: number; idea_id: number }[];
  swipes: SwipeRow[];
  ideas: IdeaRow[];
  /** Everyone who takes part in draws. */
  people: number[];
  viewer: number | null;
}): Round[] {
  const ideaById = new Map(ideas.map((i) => [i.id, { id: i.id, title: i.title, status: i.status }]));
  // Who is still swiping only matters for an open round that's still building its shortlist.
  const building = rounds.find((r) => r.status === "open" && r.swipe && !r.shortlist);
  const pool = building ? matchingIds(ideas, cleanFilters(building.filters)) : [];
  return rounds.map((r) => {
    const roundSwipes = swipes.filter((s) => s.round_id === r.id).map(toSwipe);
    const all = allocations.filter((a) => a.round_id === r.id);
    // Points stay secret until the draw: before it you only see your own.
    const visible = r.status === "drawn" ? all : all.filter((a) => a.person_id === viewer);
    const ideaIds = new Set(visible.map((a) => a.idea_id));
    if (r.winner_idea_id !== null) ideaIds.add(r.winner_idea_id);
    // Vetoes are secret too: before the draw you only see your own.
    const roundVetoes = vetoes
      .filter((v) => v.round_id === r.id && (r.status === "drawn" || v.person_id === viewer))
      .map(({ person_id, idea_id }) => ({ person_id, idea_id }));
    for (const v of roundVetoes) ideaIds.add(v.idea_id);
    return {
      ...r,
      filters: cleanFilters(r.filters),
      swipe: !!r.swipe,
      shortlist: parseShortlist(r.shortlist),
      my_swipes: roundSwipes.filter((x) => x.person_id === viewer).map(({ idea_id, liked }) => ({ idea_id, liked })),
      swiping: r === building ? people.filter((id) => unswiped(id, pool, roundSwipes).length > 0) : [],
      locked: locks.filter((l) => l.round_id === r.id).map((l) => l.person_id),
      vetoes: roundVetoes,
      allocations: visible.map(({ person_id, idea_id, points }) => ({ person_id, idea_id, points })),
      ideas: [...ideaIds].flatMap((id) => {
        const i = ideaById.get(id);
        return i ? [i] : [];
      }),
    };
  });
}

// ---------- Settings ----------

async function loadHomeEnds(db: D1Database, family: number): Promise<HomeEnds> {
  return (await loadFamily(db, family, null, ["home_ends"])).home_ends!;
}

function homeEndsFrom(rows: { key: string; value: string }[]): HomeEnds {
  const get = (key: string, kind: string) => {
    const t = cleanTerminal(rows.find((r) => r.key === key)?.value ?? null);
    return t?.kind === kind ? t : null;
  };
  return { airport: get("home_airport", "airport"), station: get("home_station", "station") };
}

app.get("/home-ends", async (c) => c.json(await loadHomeEnds(c.env.DB, c.get("family"))));

app.put("/home-ends", async (c) => {
  requireOwner(c);
  const b = await body(c);
  const stmts: D1PreparedStatement[] = [];
  for (const kind of ["airport", "station"] as const) {
    if (!(kind in b)) continue;
    const t = cleanTerminal(b[kind]);
    if (b[kind] !== null && t?.kind !== kind) throw new HttpError(400, `Pick the ${kind} from the search`);
    stmts.push(
      t
        ? c.env.DB.prepare("INSERT OR REPLACE INTO family_settings (family_id, key, value) VALUES (?, ?, ?)").bind(c.get("family"), `home_${kind}`, JSON.stringify(t))
        : c.env.DB.prepare("DELETE FROM family_settings WHERE family_id = ? AND key = ?").bind(c.get("family"), `home_${kind}`),
    );
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ---------- Place search ----------

app.get("/terminals", (c) => {
  const kind = c.req.query("kind");
  if (kind !== "airport" && kind !== "station") throw new HttpError(400, "Search airports or stations");
  return c.json(findTerminals(kind, cleanText(c.req.query("q"), 100) ?? ""));
});

app.get("/terminals/nearest", (c) => {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, "Give a latitude and longitude");
  return c.json(nearestAirport(lat, lon));
});

app.get("/photos", async (c) => c.json(await findPhotos(c.env, c.req.queries("q") ?? [])));

app.post("/photos", async (c) => {
  const b = await c.req.json<{ id?: unknown }>().catch(() => ({}) as { id?: unknown });
  return c.json({ url: await savePhoto(c.env, c.get("family"), b.id) });
});

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
    headers: { "User-Agent": "somewhere.party holiday planner (https://somewhere.party)" },
    cf: { cacheTtl: 86400, cacheEverything: true },
  }).catch(() => null);
  if (!res?.ok) throw new HttpError(409, "Place search is unavailable right now");
  return c.json(parseNominatim(await res.json()));
});

app.all("*", (c) => c.json({ error: "Not found" }, 404));

/**
 * Picked cover photos never change, so each one is kept in Cloudflare's cache near whoever looked at it,
 * and the next family member to see it there gets it without a trip to the database.
 */
async function cachedPhoto(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // The cache isn't there in tests, or on the workers.dev address.
  const cache = typeof caches === "undefined" ? null : caches.default;
  const hit = await cache?.match(req).catch(() => undefined);
  if (hit) return hit;
  const res = await app.fetch(req, env, ctx);
  if (cache && res.status === 200) ctx.waitUntil(cache.put(req, res.clone()).catch(() => {}));
  return res;
}

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(req.url).pathname;
    if (req.method === "GET" && path.startsWith(PHOTO_PATH)) return cachedPhoto(req, env, ctx);
    return path.startsWith("/api/") ? app.fetch(req, env, ctx) : servePage(req, env);
  },
} satisfies ExportedHandler<Env>;
