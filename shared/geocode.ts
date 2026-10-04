import type { GeocodeResult } from "./types";

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
}

/** Turns Nominatim jsonv2 results (with addressdetails) into places, dropping duplicates. */
export function parseNominatim(data: unknown): GeocodeResult[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const r of data as NominatimResult[]) {
    const a = r.address ?? {};
    const code = a.country_code?.toUpperCase();
    const name = r.name || a.city || a.town || a.village || a.municipality || a.state;
    if (!code || !/^[A-Z]{2}$/.test(code) || !name || !a.country) continue;
    const region = a.state && a.state !== name ? a.state : null;
    const label = [name, region, a.country].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, place: { name, country: a.country, country_code: code, lat: Number(r.lat), lon: Number(r.lon) } });
  }
  return out;
}
