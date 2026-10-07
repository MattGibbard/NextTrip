import type { Place } from "./types";

export type PhotoSource = "Unsplash" | "Wikimedia Commons";

/** Who took a cover photo, shown under it. Unsplash and most Commons licences ask for this. */
export interface PhotoCredit {
  name: string;
  /** The photographer's page on Unsplash, or the file's page on Commons. */
  url: string | null;
  source: PhotoSource;
  /** Commons licence, like "CC BY-SA 4.0". */
  license: string | null;
}

export interface PhotoSuggestion {
  /** Big enough for a cover. */
  url: string;
  /** Small, for the picker. */
  thumb: string;
  alt: string;
  credit: PhotoCredit;
  /** Unsplash asks to be told when one of its photos is used. */
  download: string | null;
}

/** How many suggestions the picker shows, and how many places it looks up. */
export const PHOTO_COUNT = 6;
export const PHOTO_PLACES = 3;

const UTM = "utm_source=nexttrip&utm_medium=referral";
export const UNSPLASH_URL = `https://unsplash.com/?${UTM}`;
export const COMMONS_URL = "https://commons.wikimedia.org/";

/** The first few places, without repeats, as "Lisbon, Portugal". */
export function photoQueries(places: Place[]): string[] {
  const out: string[] = [];
  for (const p of places) {
    const q = p.name === p.country ? p.name : `${p.name}, ${p.country}`;
    if (!out.includes(q)) out.push(q);
    if (out.length === PHOTO_PLACES) break;
  }
  return out;
}

interface UnsplashPhoto {
  alt_description?: string | null;
  description?: string | null;
  urls?: { regular?: string; small?: string };
  links?: { download_location?: string };
  user?: { name?: string; links?: { html?: string } };
}

const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

/** Photos from an Unsplash /search/photos response. */
export function parseUnsplash(data: unknown): PhotoSuggestion[] {
  const results = (data as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  return (results as UnsplashPhoto[]).flatMap((r): PhotoSuggestion[] => {
    const url = r.urls?.regular;
    const thumb = r.urls?.small ?? url;
    const name = r.user?.name?.trim();
    if (!isHttps(url) || !isHttps(thumb) || !name) return [];
    const profile = r.user?.links?.html;
    const download = r.links?.download_location;
    return [
      {
        url,
        thumb,
        alt: r.alt_description || r.description || "",
        credit: { name, url: isHttps(profile) ? withUtm(profile) : null, source: "Unsplash", license: null },
        download: isHttps(download) ? download : null,
      },
    ];
  });
}

interface CommonsPage {
  index?: number;
  title?: string;
  imageinfo?: {
    thumburl?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    mime?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
}

/** Text from a bit of Commons HTML, like an Artist field with links in it. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Landscape photos from a Commons generator=search response (formatversion=2,
 * imageinfo with a thumbnail width). Maps, flags and small pictures are left out.
 */
export function parseCommons(data: unknown): PhotoSuggestion[] {
  const pages = (data as { query?: { pages?: unknown } })?.query?.pages;
  if (!Array.isArray(pages)) return [];
  return (pages as CommonsPage[])
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p): PhotoSuggestion[] => {
      const info = p.imageinfo?.[0];
      const url = info?.thumburl;
      if (!info || !isHttps(url) || info.mime !== "image/jpeg") return [];
      if (!info.width || !info.height || info.width < 1000 || info.width < info.height * 1.2) return [];
      const meta = info.extmetadata ?? {};
      const artist = stripHtml(meta.Artist?.value ?? "").slice(0, 100);
      const license = stripHtml(meta.LicenseShortName?.value ?? "").slice(0, 50) || null;
      const title = (p.title ?? "").replace(/^File:/, "").replace(/\.[a-z]+$/i, "");
      return [
        {
          url,
          // Commons makes thumbnails at a few standard widths, 500 among them.
          thumb: url.replace(/\/\d+px-([^/]+)$/, "/500px-$1"),
          alt: title,
          credit: { name: artist || "Unknown", url: isHttps(info.descriptionurl) ? info.descriptionurl : null, source: "Wikimedia Commons", license },
          download: null,
        },
      ];
    });
}

/** Takes turns between each place's photos so every place gets a look in. */
/** "New York, United States" into the place and its country. */
export function splitQuery(q: string): { name: string; country: string | null } {
  const i = q.lastIndexOf(",");
  if (i < 0) return { name: q.trim(), country: null };
  return { name: q.slice(0, i).trim(), country: q.slice(i + 1).trim() || null };
}

export function mixPhotos(lists: PhotoSuggestion[][], count = PHOTO_COUNT): PhotoSuggestion[] {
  const out: PhotoSuggestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < count && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const p = l[i];
      if (!p || seen.has(p.url)) continue;
      seen.add(p.url);
      out.push(p);
      if (out.length === count) break;
    }
  }
  return out;
}

/** A credit sent by the browser, checked over before it's saved. */
export function cleanCredit(v: unknown): PhotoCredit | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const text = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);
  const name = text(c.name, 100);
  const source = c.source === "Unsplash" || c.source === "Wikimedia Commons" ? c.source : null;
  if (!name || !source) return null;
  const url = text(c.url, 1000);
  return { name, url: url && isHttps(url) ? url : null, source, license: text(c.license, 50) };
}

/** A saved credit column back into a credit. */
export function parseCredit(raw: string | null | undefined): PhotoCredit | null {
  if (!raw) return null;
  try {
    return cleanCredit(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isHttps(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("https://");
}
