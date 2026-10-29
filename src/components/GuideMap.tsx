import type { CSSProperties } from "react";
import type { GuideMap as Map } from "../destinations";

/** "45.6°N 10.7°E" */
function coordinates(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(1)}°${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(1)}°${lon < 0 ? "W" : "E"}`;
}

/**
 * Where a guide's place is: its region with the country shaded and a pin in the middle, and a small
 * world map in the corner with a dot. The region is drawn when the site builds (scripts/guide-map.mjs);
 * the world is public/images/world.svg, coloured by CSS, from 84°N to 58°S. Beside the facts board the
 * map takes the board's height, trimming the region's edges around the pin.
 */
export function GuideMap({ map, name, country, lat, lon }: { map: Map; name: string; country: string; lat: number; lon: number }) {
  return (
    <figure className="dg-map">
      <div className="dg-map-frame">
        <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Map showing where ${name} is${country ? ` in ${country}` : ""}`}>
          <rect className="dg-map-sea" width="600" height="400" />
          <path className="dg-map-land" d={map.land} />
          {map.country && <path className="dg-map-country" d={map.country} />}
          {/* A ring round the place, so a speck of an island still stands out under its pin. */}
          <circle className="dg-map-halo" cx="300" cy="200" r="22" />
          <ellipse className="dg-map-shadow" cx="300" cy="200" rx="7" ry="2.5" />
          <path className="dg-map-pin" d="M300 200c-4-9-13-15-13-25a13 13 0 1 1 26 0c0 10-9 16-13 25z" />
          <circle className="dg-map-pin-dot" cx="300" cy="175" r="5" />
        </svg>
        <span className="dg-map-world" aria-hidden>
          <i style={{ "--x": (lon + 180) / 360, "--y": Math.min(Math.max((84 - lat) / 142, 0), 1) } as CSSProperties} />
        </span>
      </div>
      <figcaption>
        <span className="dg-label">WHERE IN THE WORLD</span>
        <strong>
          {name}
          {country && name !== country ? `, ${country}` : ""}
        </strong>
        <span className="dg-map-coords">{coordinates(lat, lon)}</span>
      </figcaption>
    </figure>
  );
}
