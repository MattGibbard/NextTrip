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

describe("flightLink", () => {
  it("wraps an Aviasales route search in our Travelpayouts link", async () => {
    const { flightLink } = await import("../shared/flights");
    const url = new URL(flightLink("LHR", "YYC", "idea_page"));
    expect(url.origin + url.pathname).toBe("https://tp.media/r");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      campaign_id: "100",
      marker: "786925",
      p: "4114",
      trs: "582749",
      sub_id: "idea_page",
      u: "https://www.aviasales.com/?params=LHRYYC",
    });
  });
});

describe("flightOrigin", () => {
  it("prefers the idea's own departure airport, then the home airport", async () => {
    const { flightOrigin } = await import("../shared/flights");
    const air = (code: string) => ({ kind: "airport" as const, code, name: code, country_code: "GB", lat: 0, lon: 0 });
    const station = { kind: "station" as const, code: "STP", name: "St Pancras", country_code: "GB", lat: 0, lon: 0 };
    expect(flightOrigin(air("MAN"), air("LHR"))?.code).toBe("MAN");
    expect(flightOrigin(null, air("LHR"))?.code).toBe("LHR");
    expect(flightOrigin(station, air("LHR"))?.code).toBe("LHR");
    expect(flightOrigin(null, null)).toBeNull();
  });
});
