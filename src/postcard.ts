// The pieces of a Been postcard that are worked out rather than drawn: its tilt, postmark and route sketch.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A slight tilt, from about 1.6° left to 1.6° right, that stays the same for a trip. */
export function postcardTilt(id: number): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((((h ^ (h >>> 16)) >>> 0) % 33) - 16) / 10;
}

/** "2026-09-15" → { month: "SEP", year: "2026" }, for the round postmark. */
export function postmarkDate(date: string | null): { month: string; year: string } | null {
  const m = date?.match(/^(\d{4})-(\d{2})/);
  return m ? { month: MONTHS[Number(m[2]) - 1], year: m[1] } : null;
}

export interface SketchPoint {
  lat: number;
  lon: number;
  label?: string;
}

export interface Sketch {
  /** An SVG path in a 100 × 70 box. */
  d: string;
  /** Each point as a percentage of the box, first one first. */
  pins: { x: number; y: number; label?: string }[];
}

export const SKETCH_W = 100;
export const SKETCH_H = 70;

/**
 * Draws the route through the points, scaled to fill a 100 × 70 box with room
 * round the edge. A flight's first leg bows into an arc; every other leg is straight.
 */
export function routeSketch(points: SketchPoint[], arcFirstLeg: boolean): Sketch | null {
  if (points.length === 0) return null;
  const pad = 15;
  const midLat = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * k);
  const ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const dx = Math.max(...xs) - minX;
  const dy = Math.max(...ys) - minY;
  // Scale by whichever side fills the box first; a single spot just sits in the middle.
  const s = Math.min(dx > 1e-6 ? (SKETCH_W - 2 * pad) / dx : Infinity, dy > 1e-6 ? (SKETCH_H - 2 * pad) / dy : Infinity);
  if (!Number.isFinite(s)) return { d: "", pins: points.map((p) => ({ x: 50, y: 50, label: p.label })) };
  const ox = (SKETCH_W - dx * s) / 2;
  const oy = (SKETCH_H - dy * s) / 2;
  const P = points.map((_, i) => ({ x: ox + (xs[i] - minX) * s, y: oy + (ys[i] - minY) * s }));
  const f = (n: number) => n.toFixed(1);

  let d = `M${f(P[0].x)} ${f(P[0].y)}`;
  P.slice(1).forEach((p, i) => {
    const a = P[i];
    if (i === 0 && arcFirstLeg) {
      const len = Math.hypot(p.x - a.x, p.y - a.y) || 1;
      const nx = -(p.y - a.y) / len;
      const ny = (p.x - a.x) / len;
      // Bow upwards, like a flight path on a map.
      const bend = len * 0.22 * (ny < 0 ? 1 : -1);
      d += ` Q${f((a.x + p.x) / 2 + nx * bend)} ${f((a.y + p.y) / 2 + ny * bend)} ${f(p.x)} ${f(p.y)}`;
    } else {
      d += ` L${f(p.x)} ${f(p.y)}`;
    }
  });

  return {
    d,
    pins: P.map((p, i) => ({ x: (p.x / SKETCH_W) * 100, y: (p.y / SKETCH_H) * 100, label: points[i].label })),
  };
}
