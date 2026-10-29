import type { Hono } from "hono";
import { HttpError } from "./env";
import type { App } from "./env";
import { keepUploadedPhoto, savePhoto } from "./photos";
import type { PhotoSetup } from "../shared/photos";
import { cleanText } from "./request";
import { findTerminals, nearestAirport } from "./terminals";
import { parseNominatim } from "../shared/geocode";

export function searchRoutes(app: Hono<App>) {
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

  // Signed-in browsers search Pixabay themselves, as it turns most Worker requests away.
  app.get("/photos", (c) => c.json({ key: c.env.PIXABAY_API_KEY || null } satisfies PhotoSetup));

  // A picked photo the browser downloaded from Pixabay, as the file itself.
  app.post("/photos/upload", async (c) => {
    if (Number(c.req.header("Content-Length") ?? 0) > 2_000_000) throw new HttpError(400, "That photo is too big. Try another one.");
    return c.json({ url: await keepUploadedPhoto(c.env, c.get("family"), Number(c.req.query("id")), await c.req.arrayBuffer()) });
  });

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
}
