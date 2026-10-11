import type { Hono } from "hono";
import { HttpError } from "./env";
import type { App } from "./env";
import { requireOwner, setOwnerPerson, setSessionPerson } from "./auth";
import { loadFamily } from "./data";
import { body, cleanText, idParam, viewerId } from "./request";
import { finishOpenShortlist } from "./rounds";

function personInput(b: Record<string, unknown>) {
  const name = cleanText(b.name, 40);
  const color = typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : null;
  if (!name) throw new HttpError(400, "Name is required");
  return { name, color };
}

export function peopleRoutes(app: Hono<App>) {
  app.get("/people", async (c) => c.json((await loadFamily(c.env.DB, c.get("family"), viewerId(c), ["people"])).people));

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
}
