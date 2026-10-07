import { describe, expect, it } from "vitest";
import { hotelLink, hotelPlaces } from "../shared/hotels";
import type { Place } from "../shared/types";

const lisbon: Place = { name: "Lisbon", country: "Portugal", country_code: "PT", lat: 38.7223, lon: -9.1393 };

describe("hotelLink", () => {
  it("searches around a place's coordinates with our affiliate ID", () => {
    const url = new URL(hotelLink(lisbon, "draw_result"));
    expect(url.origin + url.pathname).toBe("https://www.stay22.com/allez/roam");
    expect(url.searchParams.get("aid")).toBe("somewhereparty");
    expect(url.searchParams.get("lat")).toBe("38.7223");
    expect(url.searchParams.get("lng")).toBe("-9.1393");
    expect(url.searchParams.get("address")).toBeNull();
    expect(url.searchParams.get("campaign")).toBe("draw_result");
  });

  it("falls back to the place's name when it has no coordinates", () => {
    const url = new URL(hotelLink({ ...lisbon, lat: null, lon: null }, "idea_page"));
    expect(url.searchParams.get("address")).toBe("Lisbon, Portugal");
    expect(url.searchParams.get("lat")).toBeNull();
  });
});

describe("hotelPlaces", () => {
  it("drops blanks and repeats and keeps at most four", () => {
    const at = (name: string): Place => ({ ...lisbon, name });
    const places = [at("Lisbon"), at("lisbon "), at(" "), at("Porto"), at("Faro"), at("Sintra"), at("Lagos")];
    expect(hotelPlaces(places).map((p) => p.name)).toEqual(["Lisbon", "Porto", "Faro", "Sintra"]);
  });
});
