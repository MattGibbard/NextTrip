import type { Hono } from "hono";
import { HttpError } from "./env";
import type { App } from "./env";
import { requireOwner } from "./auth";
import { body } from "./request";
import { loadHomeEnds } from "./data";
import { cleanTerminal } from "./terminals";

export function homeEndRoutes(app: Hono<App>) {
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
}
