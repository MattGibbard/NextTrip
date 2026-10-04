import { expect, it } from "vitest";
import { parseNominatim } from "../shared/geocode";

it("maps Nominatim results to places and drops duplicates and incomplete rows", () => {
  const out = parseNominatim([
    { lat: "35.0116", lon: "135.7681", name: "Kyoto", address: { city: "Kyoto", state: "Kyoto Prefecture", country: "Japan", country_code: "jp" } },
    { lat: "35.02", lon: "135.76", name: "Kyoto", address: { city: "Kyoto", state: "Kyoto Prefecture", country: "Japan", country_code: "jp" } },
    { lat: "1", lon: "2", name: "Nowhere", address: {} },
    { lat: "51.5", lon: "-0.12", address: { city: "London", state: "England", country: "United Kingdom", country_code: "gb" } },
  ]);
  expect(out).toEqual([
    { label: "Kyoto, Kyoto Prefecture, Japan", place: { name: "Kyoto", country: "Japan", country_code: "JP", lat: 35.0116, lon: 135.7681 } },
    { label: "London, England, United Kingdom", place: { name: "London", country: "United Kingdom", country_code: "GB", lat: 51.5, lon: -0.12 } },
  ]);
  expect(parseNominatim({ error: "x" })).toEqual([]);
});
