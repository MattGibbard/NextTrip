// Reading a family's things from the database, and the row shapes they're stored in.
import { cleanTerminal } from "./terminals";
import type { Terminal } from "../shared/terminals";
import { cleanDetails } from "../shared/ideaDetails";
import { cleanFilters, matchesFilters } from "../shared/roundFilters";
import type { RoundFilters } from "../shared/roundFilters";
import { parseShortlist, unswiped } from "../shared/shortlist";
import type { Swipe } from "../shared/shortlist";
import { cleanTripDates } from "../shared/tripDates";
import type { Allocation, FamilyData, FamilyPart, HomeEnds, Idea, IdeaDetails, IdeaStatus, Person, Place, Round, Trip } from "../shared/types";

export function placeInserts(db: D1Database, table: "trip_places" | "idea_places", key: string, ownerId: number, places: Place[]) {
  return [
    db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).bind(ownerId),
    ...places.map((p, i) =>
      db
        .prepare(`INSERT INTO ${table} (${key}, position, name, country, country_code, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(ownerId, i, p.name, p.country, p.country_code, p.lat, p.lon),
    ),
  ];
}

export const terminalJson = (t: Terminal | null) => (t ? JSON.stringify(t) : null);

type EndsRow = { depart: string | null; arrive: string | null };
const parseEnds = (r: EndsRow) => ({ depart: cleanTerminal(r.depart), arrive: cleanTerminal(r.arrive) });

type IdeaRow = Omit<Idea, "places" | "holiday_types" | "depart" | "arrive"> & { holiday_types: string | null } & EndsRow;

function parseTypes(raw: string | null): Idea["holiday_types"] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return cleanDetails({ holiday_types: v }).holiday_types;
  } catch {
    return [];
  }
}

type RoundRow = Omit<Round, "locked" | "vetoes" | "allocations" | "ideas" | "filters" | "swipe" | "shortlist" | "my_swipes" | "swiping" | "trip_dates"> & {
  filters: string;
  trip_dates: string | null;
  swipe: number;
  shortlist: string | null;
};
export type SwipeRow = { round_id: number; person_id: number; idea_id: number; liked: number };
export const toSwipe = (s: Omit<SwipeRow, "round_id">): Swipe => ({ person_id: s.person_id, idea_id: s.idea_id, liked: !!s.liked });

/** People in a family who take part in draws. */
export async function activePeople(db: D1Database, family: number) {
  const { results } = await db.prepare("SELECT id FROM people WHERE family_id = ? AND removed = 0").bind(family).all<{ id: number }>();
  return results.map((p) => p.id);
}

/** Active ideas that fit a round's filters. */
export async function matchingIdeaIds(db: D1Database, family: number, filters: RoundFilters) {
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

export const FAMILY_PARTS = ["people", "trips", "ideas", "rounds", "home_ends"] as const satisfies readonly FamilyPart[];

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
export async function loadFamily(db: D1Database, family: number, viewer: number | null, parts: readonly FamilyPart[]): Promise<Partial<FamilyData>> {
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
      trip_dates: cleanTripDates(r.trip_dates),
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

export async function loadHomeEnds(db: D1Database, family: number): Promise<HomeEnds> {
  return (await loadFamily(db, family, null, ["home_ends"])).home_ends!;
}

function homeEndsFrom(rows: { key: string; value: string }[]): HomeEnds {
  const get = (key: string, kind: string) => {
    const t = cleanTerminal(rows.find((r) => r.key === key)?.value ?? null);
    return t?.kind === kind ? t : null;
  };
  return { airport: get("home_airport", "airport"), station: get("home_station", "station") };
}

