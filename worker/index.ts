import { Hono } from "hono";
import { migrate } from "./migrate";
import { authRoutes, familyRoutes, readSession, sessionJson } from "./auth";
import { HttpError } from "./env";
import type { App, Env } from "./env";
import { servePage } from "./pages";
import { cmsRoutes } from "./cms";
import { servePhoto } from "./photos";
import { PHOTO_PATH } from "../shared/photos";
import { FAMILY_PARTS, loadFamily } from "./data";
import { peopleRoutes } from "./people";
import { tripRoutes } from "./trips";
import { ideaRoutes } from "./ideas";
import { roundRoutes } from "./rounds";
import { homeEndRoutes } from "./homeEnds";
import { searchRoutes } from "./search";
import type { Bootstrap, FamilyPart } from "../shared/types";

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
peopleRoutes(app);
tripRoutes(app);
ideaRoutes(app);
roundRoutes(app);
homeEndRoutes(app);
searchRoutes(app);

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
