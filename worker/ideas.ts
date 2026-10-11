import type { Hono } from "hono";
import { HttpError } from "./env";
import type { App } from "./env";
import { requireOwner } from "./auth";
import { loadFamily, loadHomeEnds, placeInserts, terminalJson } from "./data";
import { body, cleanPlaces, cleanText, cleanUrl, familyIdea, familyPerson, idParam, viewerId } from "./request";
import { finishOpenShortlist } from "./rounds";
import { cleanTerminal } from "./terminals";
import { cleanDetails } from "../shared/ideaDetails";
import { endsForMode } from "../shared/terminals";
import { ideaMode } from "../shared/travelMode";
import { estimateTravel } from "../shared/travelTime";
import type { IdeaInput } from "../shared/types";

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

export function ideaRoutes(app: Hono<App>) {
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
}
