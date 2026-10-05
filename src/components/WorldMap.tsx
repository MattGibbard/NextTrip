import { useEffect, useRef } from "react";
import L from "leaflet";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { alpha2FromNumeric, numericCode } from "../countries";
import { greatCircle, routeLegs } from "../../shared/routes";
import type { Terminal } from "../../shared/terminals";

export interface Pin {
  lat: number;
  lon: number;
  label: string;
  kind: "visited" | "idea";
  /** A CSS variable to colour it with instead of the usual been/idea colour. */
  colorVar?: string;
  /** An airport, station or port: drawn as a ring rather than a dot. */
  terminal?: boolean;
}

/** Lines between the places of one trip or idea. */
export interface Route {
  places: { lat: number | null; lon: number | null }[];
  /** Join the places in order (road trips, cruises) instead of from the first one. */
  inOrder: boolean;
  label: string;
  kind: "visited" | "idea";
  /** A CSS variable to colour it with, such as the trip's travel mode. */
  colorVar?: string;
  /** Dotted legs to and from the places, such as the flight out. */
  journey?: [[number, number], [number, number]][];
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

const NO_ROUTES: Route[] = [];

interface Props {
  visited: Set<string>;
  ideas: Set<string>;
  pins: Pin[];
  routes?: Route[];
  /** Alpha-2 code of the highlighted country. */
  selected: string | null;
  onSelect: (code: string) => void;
  /** Zoom in as close as the pins allow, for a single trip or idea. */
  close?: boolean;
}

export function WorldMap({ visited, ideas, pins, routes = NO_ROUTES, selected, onSelect, close = false }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const countryLayers = useRef(new Map<string, L.Path & { getBounds(): L.LatLngBounds }>());
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { worldCopyJump: true, minZoom: 1, zoomSnap: 0.25 }).setView([30, 10], 1.5);
    // Standard OpenStreetMap tiles need no API key. Dark mode darkens them with a CSS filter.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
      countryLayers.current.clear();
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
        onEachFeature: (f, layer) => {
          layer.bindTooltip(f.properties.name, { sticky: true });
          const code = alpha2FromNumeric(String(f.id));
          if (!code) return;
          countryLayers.current.set(code, layer as L.Path & { getBounds(): L.LatLngBounds });
          layer.on("click", () => selectRef.current(code));
        },
      }).addTo(group);
      highlight(selectedRef.current, false);

      // Routes go under the pins so the city dots stay tappable.
      for (const r of routes) {
        const color = r.colorVar ? cssVar(r.colorVar) : r.kind === "visited" ? visitedColor : ideaColor;
        for (const [from, to] of r.journey ?? []) {
          const path = greatCircle(from, to);
          L.polyline(path, { color: "#fff", weight: 6, opacity: 0.6, interactive: false }).addTo(group);
          L.polyline(path, { color, weight: 3.5, opacity: 0.9, dashArray: "0.1 8", lineCap: "round", interactive: true })
            .bindTooltip(r.label, { sticky: true })
            .addTo(group);
        }
        for (const [from, to] of routeLegs(r.places, r.inOrder)) {
          const path = greatCircle(from, to);
          // A pale halo keeps the line readable on top of a shaded country.
          L.polyline(path, { color: "#fff", weight: 5, opacity: 0.7, interactive: false }).addTo(group);
          L.polyline(path, {
            color,
            weight: 2.5,
            opacity: 0.85,
            dashArray: r.kind === "idea" ? "6 6" : undefined,
            interactive: true,
          })
            .bindTooltip(r.label, { sticky: true })
            .addTo(group);
        }
      }

      const bounds: L.LatLngTuple[] = [];
      for (const p of pins) {
        const color = p.colorVar ? cssVar(p.colorVar) : p.kind === "visited" ? visitedColor : ideaColor;
        const style = p.terminal ? { radius: 6, color, weight: 3, fillColor: "#fff", fillOpacity: 1 } : { radius: 6, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 };
        L.circleMarker([p.lat, p.lon], style)
          .bindTooltip(p.label)
          .addTo(group);
        bounds.push([p.lat, p.lon]);
      }
      if (selectedRef.current && countryLayers.current.has(selectedRef.current)) return;
      if (bounds.length > 1) map.current.fitBounds(bounds, close ? { padding: [28, 28], maxZoom: 11 } : { padding: [40, 40], maxZoom: 5 });
      else if (bounds.length === 1) map.current.setView(bounds[0], close ? 9 : 5);
    });
    return () => {
      cancelled = true;
    };
  }, [visited, ideas, pins, routes, close]);

  function highlight(code: string | null, fly: boolean) {
    for (const [c, layer] of countryLayers.current) layer.setStyle({ weight: c === code ? 3 : 1 });
    const layer = code ? countryLayers.current.get(code) : undefined;
    if (layer && map.current) {
      layer.bringToFront();
      if (fly) map.current.flyToBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 6, duration: 0.6 });
    }
  }

  useEffect(() => {
    highlight(selected, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return <div ref={el} className="world-map" />;
}

/** Pins for where a trip or idea sets off from and arrives at. */
export function terminalPins(ends: (Terminal | null)[], kind: Pin["kind"], colorVar?: string): Pin[] {
  return ends.flatMap((t) =>
    t && t.lat !== null && t.lon !== null ? [{ lat: t.lat, lon: t.lon, label: t.code ? `${t.code} · ${t.name}` : t.name, kind, colorVar, terminal: true }] : [],
  );
}
