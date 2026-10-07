import type { Env } from "./env";
import { PHOTO_COUNT, PHOTO_PLACES, mixPhotos, parseCommons, parseUnsplash } from "../shared/photos";
import type { PhotoSuggestion } from "../shared/photos";

const USER_AGENT = "NextTrip holiday planner (https://github.com/MattGibbard/NextTrip)";
// The same place is looked up again and again as people edit, so answers are kept for a day.
const CACHE = { cacheTtl: 86400, cacheEverything: true };

async function getJson(url: URL): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Version": "v1" }, cf: CACHE }).catch(() => null);
  if (!res?.ok) return null;
  return res.json().catch(() => null);
}

function unsplash(key: string, q: string) {
  const url = new URL("https://api.unsplash.com/search/photos");
  // The key goes in the address rather than a header so Cloudflare can cache the answer.
  url.search = new URLSearchParams({ query: q, per_page: String(PHOTO_COUNT), orientation: "landscape", content_filter: "high", client_id: key }).toString();
  return getJson(url).then(parseUnsplash);
}

function commons(q: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${q} filetype:bitmap -map -flag -coat -logo -locator -diagram`,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName",
    iiurlwidth: "1280",
  }).toString();
  return getJson(url).then(parseCommons);
}

/**
 * A few cover photos for some places, from Unsplash when there's a key and it
 * finds enough, otherwise from Wikimedia Commons. Searches run from here so
 * browsers never talk to the photo sites until a picture is shown.
 */
export async function findPhotos(env: Env, queries: string[]): Promise<PhotoSuggestion[]> {
  const terms = [...new Set(queries.map((q) => q.trim().slice(0, 100)).filter(Boolean))].slice(0, PHOTO_PLACES);
  const lists = await Promise.all(
    terms.map(async (q) => {
      const found = env.UNSPLASH_ACCESS_KEY ? await unsplash(env.UNSPLASH_ACCESS_KEY, q) : [];
      return found.length >= 2 ? found : commons(q);
    }),
  );
  return mixPhotos(lists);
}

/** Tells Unsplash one of its photos was picked, as its rules ask. */
export async function markPhotoUsed(env: Env, download: unknown) {
  if (!env.UNSPLASH_ACCESS_KEY || typeof download !== "string" || !download.startsWith("https://api.unsplash.com/photos/")) return;
  const url = new URL(download);
  url.searchParams.set("client_id", env.UNSPLASH_ACCESS_KEY);
  await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Version": "v1" } }).catch(() => null);
}
