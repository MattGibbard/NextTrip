import { lazyView } from "../lazyView";
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

export interface WorldMapProps {
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

/**
 * The world map with shaded countries, routes and pins. Leaflet is a big download, so its code arrives
 * only when a map is first shown; until then an empty box the same size holds its place.
 */
export const WorldMap = lazyView(() => import("./LeafletMap").then((m) => m.LeafletMap), <div className="world-map" />);

/** Pins for where a trip or idea sets off from and arrives at. */
export function terminalPins(ends: (Terminal | null)[], kind: Pin["kind"], colorVar?: string): Pin[] {
  return ends.flatMap((t) =>
    t && t.lat !== null && t.lon !== null ? [{ lat: t.lat, lon: t.lon, label: t.code ? `${t.code} · ${t.name}` : t.name, kind, colorVar, terminal: true }] : [],
  );
}
