import { HttpError } from "./env";
import type { Env } from "./env";
import { PHOTO_COUNT, PHOTO_PAGES, PHOTO_PATH, PHOTO_PLACES, mixPhotos, parsePixabay, sized, splitQuery } from "../shared/photos";
import type { PhotoSearch, PhotoSuggestion } from "../shared/photos";

// Pixabay asks for answers to be kept for a day, and the same places are looked up
// again and again as people edit. Errors aren't kept, so a fixed key works straight away.
const CACHE = { cacheTtlByStatus: { "200-299": 86400, "300-599": 0 }, cacheEverything: true };

/** A copied photo bigger than this isn't kept. D1 rows top out at 2 MB. */
const MAX_BYTES = 1_500_000;

/** How long to wait before asking Pixabay again when it says it's busy. */
const RETRY_MS = [600, 1500];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Photos from one Pixabay search, or null when Pixabay didn't answer. It often
 * turns Workers away with a 429 even when our key has plenty left, likely because
 * Cloudflare's outgoing addresses are shared, so a busy answer is tried again.
 */
async function pixabay(key: string, params: Record<string, string>): Promise<PhotoSuggestion[] | null> {
  const url = new URL("https://pixabay.com/api/");
  url.search = new URLSearchParams({ key, image_type: "photo", orientation: "horizontal", safesearch: "true", ...params }).toString();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { cf: CACHE }).catch((e: Error) => e);
    if (!(res instanceof Error) && res.ok) return parsePixabay(await res.json().catch(() => null));
    const busy = res instanceof Error || res.status === 429 || res.status >= 500;
    if (busy && attempt < RETRY_MS.length) {
      await wait(RETRY_MS[attempt]);
      continue;
    }
    // Shows up in the Worker's logs, so a bad key or a used-up allowance is easy to spot.
    const left = res instanceof Error ? null : res.headers.get("X-RateLimit-Remaining");
    console.warn(
      `Pixabay search failed after ${attempt + 1} tries: ${res instanceof Error ? res.message : `${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`}${left ? ` (key has ${left} left)` : ""}`,
    );
    return null;
  }
}

/**
 * A few cover photos of some places, or of whatever someone typed. Each place is
 * searched by name, and by its country too when the name alone finds too few, as
 * it does for small towns. Later pages carry on further down the same results.
 */
export async function findPhotos(env: Env, queries: string[], page = 1): Promise<PhotoSearch> {
  const key = env.PIXABAY_API_KEY;
  if (!key) return { enabled: false, photos: [] };
  const params = { per_page: String(PHOTO_COUNT), page: String(Math.min(Math.max(1, Math.floor(page) || 1), PHOTO_PAGES)) };
  const terms = [...new Set(queries.map((q) => q.trim().slice(0, 200)).filter(Boolean))].slice(0, PHOTO_PLACES);
  let failed = false;
  const search = async (q: string) => {
    const found = await pixabay(key, { q: q.slice(0, 100), ...params });
    if (!found) failed = true;
    return found ?? [];
  };
  const lists = await Promise.all(
    terms.map(async (t) => {
      const { name, country } = splitQuery(t);
      if (!name) return [];
      const found = await search(name);
      if (found.length >= 4 || !country) return found;
      return [...found, ...(await search(country))];
    }),
  );
  const photos = mixPhotos(lists);
  return { enabled: true, photos, ...(failed && !photos.length ? { busy: true } : {}) };
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

  const found = await pixabay(key, { id: String(id) });
  if (!found) throw new HttpError(503, "Pixabay is busy. Try again in a minute.");
  const [photo] = found;
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
