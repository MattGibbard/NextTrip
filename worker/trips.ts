import type { Hono } from "hono";
import { HttpError } from "./env";
import type { App } from "./env";
import { requireOwner } from "./auth";
import { loadFamily, placeInserts, terminalJson } from "./data";
import { body, cleanPlaces, cleanText, cleanUrl, familyIdea, familyPerson, idParam, viewerId } from "./request";
import { cleanTerminal } from "./terminals";
import { endsForMode } from "../shared/terminals";
import { tripMode } from "../shared/travelMode";
import type { TripInput } from "../shared/types";

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

export function tripRoutes(app: Hono<App>) {
  app.get("/trips", async (c) => c.json((await loadFamily(c.env.DB, c.get("family"), viewerId(c), ["trips"])).trips));

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
}
