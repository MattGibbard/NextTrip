import { HttpError } from "./env";
import type { Env } from "./env";
import { PHOTO_COUNT, PHOTO_PATH, PHOTO_PLACES, mixPhotos, parsePixabay, sized, splitQuery } from "../shared/photos";
import type { PhotoSearch, PhotoSuggestion } from "../shared/photos";

// Pixabay asks for answers to be kept for a day, and the same places are looked up
// again and again as people edit. Errors aren't kept, so a fixed key works straight away.
const CACHE = { cacheTtlByStatus: { "200-299": 86400, "300-599": 0 }, cacheEverything: true };

/** A copied photo bigger than this isn't kept. D1 rows top out at 2 MB. */
const MAX_BYTES = 1_500_000;

async function pixabay(key: string, params: Record<string, string>): Promise<PhotoSuggestion[]> {
  const url = new URL("https://pixabay.com/api/");
  url.search = new URLSearchParams({ key, image_type: "photo", orientation: "horizontal", safesearch: "true", ...params }).toString();
  const res = await fetch(url, { cf: CACHE }).catch((e: Error) => e);
  if (res instanceof Error || !res.ok) {
    // Shows up in the Worker's logs, so a bad key or a used-up allowance is easy to spot.
    console.warn(`Pixabay search failed: ${res instanceof Error ? res.message : `${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`}`);
    return [];
  }
  return parsePixabay(await res.json().catch(() => null));
}

/**
 * A few cover photos of some places. Each place is searched by name, and by its
 * country too when the name alone finds too few, as it does for small towns.
 */
export async function findPhotos(env: Env, queries: string[]): Promise<PhotoSearch> {
  const key = env.PIXABAY_API_KEY;
  if (!key) return { enabled: false, photos: [] };
  const terms = [...new Set(queries.map((q) => q.trim().slice(0, 200)).filter(Boolean))].slice(0, PHOTO_PLACES);
  const lists = await Promise.all(
    terms.map(async (t) => {
      const { name, country } = splitQuery(t);
      if (!name) return [];
      const found = await pixabay(key, { q: name.slice(0, 100), per_page: String(PHOTO_COUNT) });
      if (found.length >= 4 || !country) return found;
      return [...found, ...(await pixabay(key, { q: country.slice(0, 100), per_page: String(PHOTO_COUNT) }))];
    }),
  );
  return { enabled: true, photos: mixPhotos(lists) };
}

const randomKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function download(url: string) {
  const res = await fetch(url).catch(() => null);
  const type = res?.headers.get("Content-Type") ?? "";
  if (!res?.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
  const data = await res.arrayBuffer();
  return data.byteLength <= MAX_BYTES ? { type, data } : null;
}

/**
 * Copies a Pixabay photo into the database, as Pixabay's rules ask, and gives back
 * its new link. Only an id comes from the browser, so the Worker never fetches a
 * link someone made up. Picking the same photo twice reuses the first copy.
 */
export async function savePhoto(env: Env, family: number, id: unknown): Promise<string> {
  const key = env.PIXABAY_API_KEY;
  if (!key) throw new HttpError(503, "Photo search isn't set up yet");
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, "Pick a photo");
  const db = env.DB;
  const had = await db.prepare("SELECT key FROM photos WHERE family_id = ? AND pixabay_id = ?").bind(family, id).first<{ key: string }>();
  if (had) return PHOTO_PATH + had.key;

  const [photo] = await pixabay(key, { id: String(id) });
  if (!photo) throw new HttpError(404, "That photo isn't on Pixabay any more");
  const file = (await download(sized(photo.preview, 960))) ?? (await download(photo.preview));
  if (!file) throw new HttpError(503, "Couldn't copy that photo. Try another one.");

  const name = randomKey();
  await db.batch([
    db.prepare("INSERT INTO photos (key, family_id, pixabay_id, content_type, data) VALUES (?, ?, ?, ?, ?)").bind(name, family, id, file.type, file.data),
    // Photos picked and then swapped or never saved are cleared out after a day.
    db
      .prepare(
        `DELETE FROM photos WHERE family_id = ?1 AND created_at < datetime('now', '-1 day')
           AND ?2 || key NOT IN (SELECT cover_url FROM trips WHERE family_id = ?1 AND cover_url IS NOT NULL
                                 UNION SELECT cover_url FROM ideas WHERE family_id = ?1 AND cover_url IS NOT NULL)`,
      )
      .bind(family, PHOTO_PATH),
  ]);
  return PHOTO_PATH + name;
}

/** A copied photo. Its link is a long random key, so it's served without a sign-in, like any image link. */
export async function servePhoto(db: D1Database, key: string): Promise<Response> {
  if (!/^[0-9a-f]{32}$/.test(key)) return new Response("Not found", { status: 404 });
  const row = await db.prepare("SELECT content_type, data FROM photos WHERE key = ?").bind(key).first<{ content_type: string; data: ArrayBuffer | number[] }>();
  if (!row) return new Response("Not found", { status: 404 });
  // D1 hands blobs back as an array of numbers.
  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
  return new Response(body, {
    headers: { "Content-Type": row.content_type, "Cache-Control": "public, max-age=31536000, immutable", "X-Robots-Tag": "noindex" },
  });
}
