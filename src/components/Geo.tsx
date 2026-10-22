import { geoText } from "../../shared/visitor";
import type { From, HoursFormat } from "../../shared/visitor";

type Part =
  | { geo: "code" | "name" | "label" | "fact-label" }
  | { geo: "hours"; to: { lat: number | null; lon: number | null }; fmt: HoursFormat }
  | { geo: "budget"; level: number };

/**
 * Words that depend on where the visitor flies from. The Worker finds these by their data-geo marks
 * and rewrites them for each visitor as the page goes out (worker/visitor.ts), with the same geoText,
 * so the page and its code always agree. Renders nothing when there's nothing to say.
 */
export function Geo({ from, ...part }: Part & { from: From }) {
  const to = part.geo === "hours" && part.to.lat !== null && part.to.lon !== null ? { lat: part.to.lat, lon: part.to.lon } : null;
  const text = geoText({ geo: part.geo, to, fmt: part.geo === "hours" ? part.fmt : null, level: part.geo === "budget" ? part.level : null }, from);
  if (text === null) return null;
  return (
    <span data-geo={part.geo} data-to={to ? `${to.lat},${to.lon}` : undefined} data-fmt={part.geo === "hours" ? part.fmt : undefined} data-level={part.geo === "budget" ? part.level : undefined}>
      {text}
    </span>
  );
}
