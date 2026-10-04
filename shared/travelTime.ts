import type { TravelTime } from "./ideaDetails";

interface Point {
  lat: number | null;
  lon: number | null;
}

/** Straight-line distance in km between two points on the globe. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** A rough direct flight: about 800 km/h plus half an hour for take-off and landing. */
export function flightHours(km: number): number {
  return km / 800 + 0.5;
}

export function travelTimeFor(hours: number): TravelTime {
  if (hours < 3) return "short";
  if (hours < 6) return "medium";
  if (hours < 10) return "long";
  return "very-long";
}

export interface TravelEstimate {
  km: number;
  hours: number;
  travel_time: TravelTime;
}

/** Estimated travel time from home to the furthest of an idea's places, or null without coordinates. */
export function estimateTravel(home: Point | null, places: Point[]): TravelEstimate | null {
  if (!home || home.lat === null || home.lon === null) return null;
  const from = { lat: home.lat, lon: home.lon };
  const kms = places.flatMap((p) => (p.lat !== null && p.lon !== null ? [distanceKm(from, { lat: p.lat, lon: p.lon })] : []));
  if (kms.length === 0) return null;
  const km = Math.max(...kms);
  const hours = flightHours(km);
  return { km, hours, travel_time: travelTimeFor(hours) };
}

/** "2h 30m" style, rounded to the nearest quarter hour. */
export function formatHours(hours: number): string {
  const q = Math.max(1, Math.round(hours * 4));
  const h = Math.floor(q / 4);
  const m = (q % 4) * 15;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}
