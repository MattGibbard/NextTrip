// The "Where is it?" map on a guide's page, drawn when the site builds. It's plain SVG paths in the
// guide's own file, so the map is in the prerendered page, needs no map service (nothing leaves the
// visitor's browser) and costs no JavaScript. src/components/GuideMap.tsx draws it.
import { readFile } from "node:fs/promises";
import { geoBounds, geoContains, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";

/** The map's size in SVG units. It scales to fit its box on the page. */
export const MAP_WIDTH = 600;
export const MAP_HEIGHT = 400;
/** How far across the map is on the ground, in km, wherever in the world the place is. */
const SPAN_KM = 2400;
const EARTH_KM = 6371;

let shapes;
async function countryShapes() {
  shapes ??= readFile(new URL("../node_modules/world-atlas/countries-50m.json", import.meta.url), "utf8").then((text) => {
    const topo = JSON.parse(text);
    // Each country's box, so drawing a map can skip the countries nowhere near it.
    return feature(topo, topo.objects.countries).features.map((f) => ({ f, box: geoBounds(f) }));
  });
  return shapes;
}

/**
 * The map for a place: `land` is every other country, `country` the place's own (its code, or failing
 * that the country the pin is in), and the pin sits in the middle. Null without a position.
 */
export async function guideMap(lat, lon, code) {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const all = await countryShapes();
  // Mercator stretches the map away from the equator, so zoom out there to keep the same span of ground.
  const scale = (MAP_WIDTH / (SPAN_KM / EARTH_KM)) * Math.cos((lat * Math.PI) / 180);
  const projection = geoMercator()
    .rotate([-lon, 0])
    .center([0, lat])
    .scale(scale)
    .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])
    .clipExtent([
      [-2, -2],
      [MAP_WIDTH + 2, MAP_HEIGHT + 2],
    ]);
  const draw = geoPath(projection).digits(0);
  const path = (f) => compact(draw(f) ?? "");
  const numeric = code ? countries.alpha2ToNumeric(code) : undefined;
  // The map's corners, a little wider for safety. A box crossing the date line (west > east) is always drawn.
  const [west, north] = projection.invert([-MAP_WIDTH / 4, -MAP_HEIGHT / 4]);
  const [east, south] = projection.invert([MAP_WIDTH * 1.25, MAP_HEIGHT * 1.25]);
  const near = (box) => {
    const [[w, s], [e, n]] = box;
    if (s > north || n < south) return false;
    if (w > e || west > east) return true;
    return !(w > east || e < west);
  };
  const shown = all.filter((c) => near(c.box)).map((c) => c.f);
  const own = all.find((c) => numeric && c.f.id === numeric)?.f ?? shown.find((f) => geoContains(f, [lon, lat]));
  const land = shown
    .filter((f) => f !== own)
    .map((f) => path(f))
    .filter(Boolean)
    .join("");
  return { land, country: (own && path(own)) || "" };
}

/**
 * Shortens a path from whole-unit points: drops points that land on the one before, and rings that
 * shrink to nothing, and writes the rest with relative moves, which are mostly one or two digits.
 */
export function compact(d) {
  let out = "";
  for (const ring of d.split("M").filter(Boolean)) {
    const points = [];
    for (const pair of ring.replace(/Z$/, "").split("L")) {
      const [px, py] = pair.split(",").map(Number);
      const last = points[points.length - 1];
      if (!last || last[0] !== px || last[1] !== py) points.push([px, py]);
    }
    if (points.length < 3) continue;
    const [[sx, sy], ...rest] = points;
    out += `M${sx},${sy}l`;
    out += rest
      .map(([px, py], i) => {
        const [qx, qy] = i ? rest[i - 1] : [sx, sy];
        return `${px - qx}${py - qy < 0 ? "" : ","}${py - qy}`;
      })
      .join(" ");
    out += "z";
  }
  return out;
}
