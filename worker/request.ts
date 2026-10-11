// Reading and checking what a request sends: who is asking, ids in the address, and the JSON body.
import { HttpError } from "./env";
import type { Ctx } from "./env";
import { PHOTO_PATH } from "../shared/photos";
import type { Place } from "../shared/types";

export function viewerId(c: Ctx): number | null {
  return c.get("person");
}

export function requireViewer(c: Ctx): number {
  const id = viewerId(c);
  if (id === null) throw new HttpError(400, "Pick who you are first");
  return id;
}

export function idParam(c: Ctx): number {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw new HttpError(404, "Not found");
  return id;
}

export function cleanText(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export function cleanPlaces(v: unknown): Place[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 50).flatMap((p): Place[] => {
    const name = cleanText(p?.name, 200);
    const country = cleanText(p?.country, 200);
    const code = cleanText(p?.country_code, 2)?.toUpperCase();
    if (!name || !country || !code || !/^[A-Z]{2}$/.test(code)) return [];
    const lat = typeof p.lat === "number" && Number.isFinite(p.lat) ? p.lat : null;
    const lon = typeof p.lon === "number" && Number.isFinite(p.lon) ? p.lon : null;
    return [{ name, country, country_code: code, lat, lon }];
  });
}

export async function body(c: Ctx): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

/** The id if it's one of this family's ideas, otherwise null. */
export async function familyIdea(c: Ctx, id: number | null) {
  if (id === null) return null;
  const row = await c.env.DB.prepare("SELECT id FROM ideas WHERE id = ? AND family_id = ?").bind(id, c.get("family")).first<{ id: number }>();
  return row?.id ?? null;
}

/** The id if it's one of this family's people, otherwise whoever is using this browser. */
export async function familyPerson(c: Ctx, id: number | null) {
  if (id === null) return viewerId(c);
  const row = await c.env.DB.prepare("SELECT id FROM people WHERE id = ? AND family_id = ?").bind(id, c.get("family")).first<{ id: number }>();
  return row?.id ?? viewerId(c);
}

/** An http(s) link, or null. */
export function cleanUrl(v: unknown) {
  const url = cleanText(v, 1000);
  return url && (/^https?:\/\//.test(url) || new RegExp(`^${PHOTO_PATH}[0-9a-f]{32}$`).test(url)) ? url : null;
}

