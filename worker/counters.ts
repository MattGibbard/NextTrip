import type { Hono } from "hono";
import type { App } from "./env";

/**
 * Daily counts for the owner's stats page, kept in stat_counts: just a name and a number per day,
 * nothing about who. A failed count never gets in the way of what it's counting.
 */
export async function bump(db: D1Database, name: string): Promise<void> {
  await db
    .prepare("INSERT INTO stat_counts (day, name, n) VALUES (date('now'), ?, 1) ON CONFLICT (day, name) DO UPDATE SET n = n + 1")
    .bind(name)
    .run()
    .catch((err) => console.warn("Couldn't count", name, err));
}

export const BOOK_KINDS = ["flights", "hotels", "things"] as const;
export const BOOK_PLACES = ["draw_result", "idea_page", "been_page", "trip_plan"] as const;

/** Notes when someone taps a Book it button. The button still opens the booking site straight away. */
export function clickRoutes(app: Hono<App>) {
  app.post("/clicks", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { kind?: unknown; place?: unknown } | null;
    const kind = BOOK_KINDS.find((k) => k === body?.kind);
    const place = BOOK_PLACES.find((p) => p === body?.place);
    if (kind && place) await bump(c.env.DB, `book:${kind}:${place}`);
    return c.body(null, 204);
  });
}
