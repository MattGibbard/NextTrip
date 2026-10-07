import { describe, expect, it } from "vitest";
import { hotelLink, hotelPlaces } from "../shared/hotels";
import type { Place } from "../shared/types";

const banff: Place = { name: "Banff", country: "Canada", country_code: "CA", lat: 51.1784, lon: -115.5708 };

describe("hotelLink", () => {
  it("searches by the place's name and country with our affiliate ID", () => {
    const url = new URL(hotelLink(banff, "draw_result"));
    expect(url.origin + url.pathname).toBe("https://www.stay22.com/allez/roam");
    expect(url.searchParams.get("aid")).toBe("somewhereparty");
    expect(url.searchParams.get("address")).toBe("Banff, Canada");
    expect(url.searchParams.get("campaign")).toBe("draw_result");
  });

  it("leaves the coordinates out, so they can't override the name", () => {
    const url = new URL(hotelLink(banff, "idea_page"));
    expect(url.searchParams.get("lat")).toBeNull();
    expect(url.searchParams.get("lng")).toBeNull();
  });

  it("uses the name alone when there's no country", () => {
    const url = new URL(hotelLink({ ...banff, country: "" }, "idea_page"));
    expect(url.searchParams.get("address")).toBe("Banff");
  });
});

describe("hotelPlaces", () => {
  it("drops blanks and repeats and keeps at most four", () => {
    const at = (name: string): Place => ({ ...banff, name });
    const places = [at("Banff"), at("banff "), at(" "), at("Jasper"), at("Calgary"), at("Lake Louise"), at("Canmore")];
    expect(hotelPlaces(places).map((p) => p.name)).toEqual(["Banff", "Jasper", "Calgary", "Lake Louise"]);
  });
});
