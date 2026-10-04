import { useEffect, useRef } from "react";
import L from "leaflet";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { numericCode } from "../countries";

export interface Pin {
  lat: number;
  lon: number;
  label: string;
  kind: "visited" | "idea";
}

let countriesPromise: Promise<FeatureCollection<Geometry, { name: string }>> | null = null;

function loadCountries() {
  // The 50m map includes small countries (Malta, Singapore…) and is loaded only when a map is shown.
  countriesPromise ??= import("world-atlas/countries-50m.json").then((m) => {
    const topo = m.default as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    return feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
  });
  return countriesPromise;
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function WorldMap({ visited, ideas, pins }: { visited: Set<string>; ideas: Set<string>; pins: Pin[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const m = L.map(el.current, { worldCopyJump: true, minZoom: 1, zoomSnap: 0.5 }).setView([30, 10], 1.5);
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(m);
    map.current = m;
    layers.current = L.layerGroup().addTo(m);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const visitedNum = new Set([...visited].map(numericCode).filter(Boolean));
    const ideaNum = new Set([...ideas].map(numericCode).filter(Boolean));
    void loadCountries().then((countries) => {
      if (cancelled || !map.current || !layers.current) return;
      const group = layers.current;
      group.clearLayers();
      const visitedColor = cssVar("--map-visited");
      const ideaColor = cssVar("--map-idea");
      L.geoJSON(countries, {
        filter: (f) => visitedNum.has(String(f.id)) || ideaNum.has(String(f.id)),
        style: (f) => {
          const isVisited = visitedNum.has(String(f?.id));
          return {
            color: isVisited ? visitedColor : ideaColor,
            weight: 1,
            fillColor: isVisited ? visitedColor : ideaColor,
            fillOpacity: isVisited ? 0.45 : 0.25,
            dashArray: isVisited ? undefined : "4 3",
          };
        },
        onEachFeature: (f, layer) => layer.bindTooltip(f.properties.name, { sticky: true }),
      }).addTo(group);

      const bounds: L.LatLngTuple[] = [];
      for (const p of pins) {
        const color = p.kind === "visited" ? visitedColor : ideaColor;
        L.circleMarker([p.lat, p.lon], { radius: 6, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(p.label)
          .addTo(group);
        bounds.push([p.lat, p.lon]);
      }
      if (bounds.length > 1) map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      else if (bounds.length === 1) map.current.setView(bounds[0], 5);
    });
    return () => {
      cancelled = true;
    };
  }, [visited, ideas, pins]);

  return <div ref={el} className="world-map" />;
}
