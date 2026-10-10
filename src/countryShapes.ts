import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

export type CountryShapes = FeatureCollection<Geometry, { name: string }>;

let countriesPromise: Promise<CountryShapes> | null = null;

/** Every country's outline, keyed by ISO numeric id. Shared by the live map and the share picture. */
export function loadCountries() {
  // The 50m map includes small countries (Malta, Singapore…) and is loaded only when a map is shown.
  countriesPromise ??= import("world-atlas/countries-50m.json").then((m) => {
    const topo = m.default as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    return feature(topo, topo.objects.countries) as CountryShapes;
  });
  return countriesPromise;
}
