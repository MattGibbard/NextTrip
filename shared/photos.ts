import type { Place } from "./types";

/** A Pixabay photo to choose from. Its links only last a day, so they're never saved. */
export interface PhotoSuggestion {
  id: number;
  /** Small, for the picker. */
  thumb: string;
  /** Big enough for the live preview while the sheet is open. */
  preview: string;
  /** Pixabay's tags, like "lisbon, tram, city". */
  alt: string;
}

export interface PhotoSearch {
  photos: PhotoSuggestion[];
  /** True when Pixabay didn't answer, so "no photos" means "try again", not "nothing matches". */
  busy?: boolean;
}

/**
 * The Pixabay key, for signed-in browsers to search with. Pixabay turns away
 * most searches from Cloudflare's shared servers, so browsers ask it directly.
 * Null until the Worker has a key; the sheet then only offers a link box.
 */
export interface PhotoSetup {
  key: string | null;
}

/** How many photos the picker shows, and how many places it looks up. */
export const PHOTO_COUNT = 8;
export const PHOTO_PLACES = 3;
/** How far "More photos" goes. Pixabay stops at 500 results anyway. */
export const PHOTO_PAGES = 10;

export const PIXABAY_URL = "https://pixabay.com/";

/** Where picked photos are served from, so the API knows a cover link is one of its own. */
export const PHOTO_PATH = "/api/photos/";

/** The first few places, without repeats, as "Lisbon|Portugal". */
export function photoQueries(places: Place[]): string[] {
  const out: string[] = [];
  for (const p of places) {
    const q = `${p.name}|${p.country}`;
    if (!out.includes(q)) out.push(q);
    if (out.length === PHOTO_PLACES) break;
  }
  return out;
}

/** A Pixabay search link. */
export function pixabaySearch(key: string, params: Record<string, string>): string {
  return `https://pixabay.com/api/?${new URLSearchParams({ key, image_type: "photo", orientation: "horizontal", safesearch: "true", ...params })}`;
}

/**
 * A few cover photos of some places, or of whatever someone typed. Each place is
 * searched by name, and by its country too when the name alone finds too few, as
 * it does for small towns. Later pages carry on further down the same results.
 * `search` gives null when Pixabay didn't answer.
 */
export async function findPhotos(search: (params: Record<string, string>) => Promise<PhotoSuggestion[] | null>, queries: string[], page = 1): Promise<PhotoSearch> {
  const params = { per_page: String(PHOTO_COUNT), page: String(Math.min(Math.max(1, Math.floor(page) || 1), PHOTO_PAGES)) };
  const terms = [...new Set(queries.map((q) => q.trim().slice(0, 200)).filter(Boolean))].slice(0, PHOTO_PLACES);
  let failed = false;
  const one = async (q: string) => {
    const found = await search({ q: q.slice(0, 100), ...params });
    if (!found) failed = true;
    return found ?? [];
  };
  const lists = await Promise.all(
    terms.map(async (t) => {
      const { name, country } = splitQuery(t);
      if (!name) return [];
      const found = await one(name);
      if (found.length >= 4 || !country) return found;
      return [...found, ...(await one(country))];
    }),
  );
  const photos = mixPhotos(lists);
  return { photos, ...(failed && !photos.length ? { busy: true } : {}) };
}

/** "Lisbon|Portugal" back into its parts. */
export function splitQuery(q: string): { name: string; country: string | null } {
  const [name, country] = q.split("|").map((s) => s.trim());
  return { name: name ?? "", country: country && country !== name ? country : null };
}

/** Pixabay's webformat links end in _640; the same photo comes in other widths by changing it. */
export function sized(url: string, width: 340 | 640 | 960) {
  return url.replace(/_640(\.\w+)$/, `_${width}$1`);
}

interface PixabayHit {
  id?: number;
  webformatURL?: string;
  tags?: string;
}

/** Photos from a Pixabay /api/ response. */
export function parsePixabay(data: unknown): PhotoSuggestion[] {
  const hits = (data as { hits?: unknown })?.hits;
  if (!Array.isArray(hits)) return [];
  return (hits as PixabayHit[]).flatMap((h) =>
    typeof h.id === "number" && typeof h.webformatURL === "string" && h.webformatURL.startsWith("https://")
      ? [{ id: h.id, thumb: sized(h.webformatURL, 340), preview: h.webformatURL, alt: typeof h.tags === "string" ? h.tags : "" }]
      : [],
  );
}

/** One from each place in turn, so every place gets a look in, without repeats. */
export function mixPhotos(lists: PhotoSuggestion[][], count = PHOTO_COUNT): PhotoSuggestion[] {
  const out: PhotoSuggestion[] = [];
  const seen = new Set<number>();
  for (let i = 0; out.length < count && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const p = l[i];
      if (p && !seen.has(p.id) && out.length < count) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out;
}
