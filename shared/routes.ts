interface Point {
  lat: number | null;
  lon: number | null;
}

type LatLon = [number, number];

/** Road trips, cruises and train journeys go place to place in order rather than out from the first place. */
export function followsInOrder(holidayTypes: readonly string[]): boolean {
  return holidayTypes.includes("road-trip") || holidayTypes.includes("cruise") || holidayTypes.includes("rail");
}

/**
 * The legs to draw between a trip or idea's places. A road trip or cruise goes
 * place to place in order; anything else fans out from the first city. Places without
 * coordinates are skipped, and a single place has no legs.
 */
export function routeLegs(places: Point[], inOrder: boolean): [LatLon, LatLon][] {
  const pts = places.flatMap((p): LatLon[] => (p.lat !== null && p.lon !== null ? [[p.lat, p.lon]] : []));
  if (pts.length < 2) return [];
  if (inOrder) return pts.slice(1).map((p, i) => [pts[i], p]);
  return pts.slice(1).map((p) => [pts[0], p]);
}

/**
 * Points along the shortest path over the globe, so long legs curve like a
 * flight path. Longitudes are kept continuous, so a leg across the Pacific
 * doesn't wrap the long way round the map.
 */
export function greatCircle([lat1, lon1]: LatLon, [lat2, lon2]: LatLon, steps = 32): LatLon[] {
  const rad = Math.PI / 180;
  const toVec = (lat: number, lon: number) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
  const a = toVec(lat1, lon1);
  const b = toVec(lat2, lon2);
  const angle = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  if (angle < 1e-6) return [[lat1, lon1], [lat2, lon2]];
  const out: LatLon[] = [];
  let prevLon = lon1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * angle) / Math.sin(angle);
    const s2 = Math.sin(t * angle) / Math.sin(angle);
    const v = [0, 1, 2].map((k) => s1 * a[k] + s2 * b[k]);
    const lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad;
    let lon = Math.atan2(v[1], v[0]) / rad;
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    out.push([lat, lon]);
  }
  return out;
}
