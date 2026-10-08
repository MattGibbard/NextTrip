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
  /** False until the Worker has a Pixabay key. The sheet then only offers a link box. */
  enabled: boolean;
  photos: PhotoSuggestion[];
}

/** How many photos the picker shows, and how many places it looks up. */
export const PHOTO_COUNT = 8;
export const PHOTO_PLACES = 3;

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
