import type { Env } from "./env";
import { PHOTO_COUNT, PHOTO_PLACES, mixPhotos, parseCommons, parseUnsplash, splitQuery } from "../shared/photos";
import type { PhotoSuggestion } from "../shared/photos";

const USER_AGENT = "NextTrip holiday planner (https://github.com/MattGibbard/NextTrip)";
// The same place is looked up again and again as people edit, so answers are kept for a
// day. Errors aren't kept, so a fixed key or a fresh allowance works straight away.
const CACHE = { cacheTtlByStatus: { "200-299": 86400, "300-599": 0 }, cacheEverything: true };

async function getJson(url: URL, what: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Version": "v1" }, cf: CACHE }).catch((e: Error) => e);
  if (res instanceof Error || !res.ok) {
    // Shows up in the Worker's logs, so a bad key or a used-up allowance is easy to spot.
    console.warn(`${what} photo search failed: ${res instanceof Error ? res.message : `${res.status} ${await res.text().catch(() => "")}`.slice(0, 300)}`);
    return null;
  }
  return res.json().catch(() => null);
}

function unsplash(key: string, name: string, country: string | null) {
  const url = new URL("https://api.unsplash.com/search/photos");
  // The key goes in the address rather than a header so Cloudflare can cache the answer.
  const query = country ? `${name} ${country}` : name;
  url.search = new URLSearchParams({ query, per_page: String(PHOTO_COUNT), orientation: "landscape", content_filter: "high", client_id: key }).toString();
  return getJson(url, "Unsplash").then(parseUnsplash);
}

function commons(search: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${search} filetype:bitmap -map -flag -coat -logo -locator -diagram`,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName",
    iiurlwidth: "1280",
  }).toString();
  return getJson(url, "Wikimedia Commons").then(parseCommons);
}

/**
 * Commons' own "quality images" are reviewed photos, so searching just those
 * keeps out the scanned documents and drawings a plain search turns up.
 * A plain search is the fallback for places with too few of them.
 */
async function commonsPhotos(name: string, country: string | null) {
  const quality = await commons(`"${name}" incategory:Quality_images`);
  if (quality.length >= 2) return quality;
  return commons(country ? `"${name}" ${country}` : `"${name}"`);
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
      const { name, country } = splitQuery(q);
      const found = env.UNSPLASH_ACCESS_KEY ? await unsplash(env.UNSPLASH_ACCESS_KEY, name, country) : [];
      return found.length >= 2 ? found : commonsPhotos(name, country);
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
