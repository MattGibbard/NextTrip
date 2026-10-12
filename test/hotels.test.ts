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
    expect(url.searchParams.get("currency")).toBe("GBP");
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
    const url = new URL(flightLink("LHR", "YYC", 4, "idea_page"));
    expect(url.origin + url.pathname).toBe("https://tp.media/r");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      campaign_id: "100",
      marker: "786925",
      p: "4114",
      trs: "582749",
      sub_id: "idea_page",
      u: "https://www.aviasales.com/?params=LHRYYC4&currency=gbp",
    });
  });
});

describe("flightLink passengers", () => {
  it("always sends between 1 and 9 passengers, because Aviasales drops a route without any", async () => {
    const { flightLink } = await import("../shared/flights");
    const params = (n: number) => new URL(new URL(flightLink("LHR", "YVR", n, "draw_result")).searchParams.get("u")!).searchParams.get("params");
    expect(params(0)).toBe("LHRYVR1");
    expect(params(2)).toBe("LHRYVR2");
    expect(params(12)).toBe("LHRYVR9");
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

describe("family size and currency", () => {
  it("searches hotels for everyone, in the family's currency", async () => {
    const url = new URL(hotelLink(banff, "draw_result", { guests: 4, currency: "CAD" }));
    expect(url.searchParams.get("adults")).toBe("4");
    expect(url.searchParams.get("currency")).toBe("CAD");
  });

  it("leaves the guest count out when nobody's known, and defaults to pounds", () => {
    const url = new URL(hotelLink(banff, "draw_result"));
    expect(url.searchParams.has("adults")).toBe(false);
    expect(url.searchParams.get("currency")).toBe("GBP");
  });

  it("prices flights in the family's currency", async () => {
    const { flightLink } = await import("../shared/flights");
    const u = new URL(new URL(flightLink("DUB", "BCN", 3, "idea_page", { currency: "EUR" })).searchParams.get("u")!);
    expect(u.searchParams.get("params")).toBe("DUBBCN3");
    expect(u.searchParams.get("currency")).toBe("eur");
  });
});

describe("currencyFor", () => {
  it("goes by the home airport's country", async () => {
    const { currencyFor } = await import("../shared/currency");
    expect(currencyFor("GB")).toBe("GBP");
    expect(currencyFor("IE")).toBe("EUR");
    expect(currencyFor("es")).toBe("EUR");
    expect(currencyFor("US")).toBe("USD");
    expect(currencyFor("CA")).toBe("CAD");
    expect(currencyFor("AU")).toBe("AUD");
    expect(currencyFor("CH")).toBe("CHF");
    // Somewhere we don't list: dollars. No home airport yet: pounds.
    expect(currencyFor("ZZ")).toBe("USD");
    expect(currencyFor(null)).toBe("GBP");
  });
});

describe("activitiesLink", () => {
  it("wraps a Tiqets search for the place in our Travelpayouts link", async () => {
    const { activitiesLink } = await import("../shared/activities");
    const url = new URL(activitiesLink({ ...banff, name: " Rome " }, "trip_plan"));
    expect(url.origin + url.pathname).toBe("https://tp.media/r");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      campaign_id: "89",
      marker: "786925",
      p: "2074",
      trs: "582749",
      sub_id: "trip_plan",
      u: "https://www.tiqets.com/en/search?q=Rome",
    });
  });
});
