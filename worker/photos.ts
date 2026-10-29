import { HttpError } from "./env";
import type { Env } from "./env";
import { PHOTO_PATH, parsePixabay, pixabaySearch, sized } from "../shared/photos";
import type { PhotoSuggestion } from "../shared/photos";

// Pixabay asks for answers to be kept for a day. Errors aren't kept, so a fixed key works straight away.
const CACHE = { cacheTtlByStatus: { "200-299": 86400, "300-599": 0 }, cacheEverything: true };

/** A copied photo bigger than this isn't kept. D1 rows top out at 2 MB. */
const MAX_BYTES = 1_500_000;

/** Photos from one Pixabay lookup, or null when Pixabay didn't answer. */
async function pixabay(key: string, params: Record<string, string>): Promise<PhotoSuggestion[] | null> {
  const res = await fetch(pixabaySearch(key, params), { cf: CACHE }).catch((e: Error) => e);
  if (res instanceof Error || !res.ok) {
    // Shows up in the Worker's logs, so a bad key or a used-up allowance is easy to spot.
    console.warn(`Pixabay lookup failed: ${res instanceof Error ? res.message : `${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`}`);
    return null;
  }
  return parsePixabay(await res.json().catch(() => null));
}

const randomKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function download(url: string) {
  const res = await fetch(url).catch(() => null);
  const type = res?.headers.get("Content-Type") ?? "";
  if (!res?.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
  const data = await res.arrayBuffer();
  return data.byteLength <= MAX_BYTES ? { type, data } : null;
}

const validId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

async function copied(db: D1Database, family: number, id: number) {
  const had = await db.prepare("SELECT key FROM photos WHERE family_id = ? AND pixabay_id = ?").bind(family, id).first<{ key: string }>();
  return had ? PHOTO_PATH + had.key : null;
}

async function keep(db: D1Database, family: number, id: number, file: { type: string; data: ArrayBuffer }) {
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

/**
 * Copies a Pixabay photo into the database, as Pixabay's rules ask, and gives back
 * its new link. Only an id comes from the browser, so the Worker never fetches a
 * link someone made up. Picking the same photo twice reuses the first copy. Only a
 * fallback now: Pixabay turns most Worker requests away, so browsers send the photo.
 */
export async function savePhoto(env: Env, family: number, id: unknown): Promise<string> {
  const key = env.PIXABAY_API_KEY;
  if (!key) throw new HttpError(503, "Photo search isn't set up yet");
  if (!validId(id)) throw new HttpError(400, "Pick a photo");
  const had = await copied(env.DB, family, id);
  if (had) return had;

  const found = await pixabay(key, { id: String(id) });
  if (!found) throw new HttpError(503, "Pixabay is busy. Try again in a minute.");
  const [photo] = found;
  if (!photo) throw new HttpError(404, "That photo isn't on Pixabay any more");
  const file = (await download(sized(photo.preview, 960))) ?? (await download(photo.preview));
  if (!file) throw new HttpError(503, "Couldn't copy that photo. Try another one.");
  return keep(env.DB, family, id, file);
}

/** What a JPEG, PNG or WebP file starts with, so only real photos are kept. */
function imageType(data: ArrayBuffer): string | null {
  const b = new Uint8Array(data.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/**
 * Keeps a Pixabay photo the browser downloaded itself, since Pixabay answers
 * browsers but not the Worker. The file must really be a photo, and no bigger
 * than one copied here would be. Picking the same photo twice reuses the first copy.
 */
export async function keepUploadedPhoto(env: Env, family: number, id: unknown, data: ArrayBuffer): Promise<string> {
  if (!env.PIXABAY_API_KEY) throw new HttpError(503, "Photo search isn't set up yet");
  if (!validId(id)) throw new HttpError(400, "Pick a photo");
  const had = await copied(env.DB, family, id);
  if (had) return had;
  if (data.byteLength > MAX_BYTES) throw new HttpError(400, "That photo is too big. Try another one.");
  const type = imageType(data);
  if (!type) throw new HttpError(400, "That isn't a photo");
  return keep(env.DB, family, id, { type, data });
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
