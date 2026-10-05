import { describe, expect, it } from "vitest";
import type { Trip } from "../shared/types";
import { chunk, lookFor, pendingStamps, stampDate, visitStamps } from "../src/passport";

const place = (name: string, country: string, country_code: string) => ({ name, country, country_code, lat: null, lon: null });
const trip = (id: number, start_date: string | null, places: Trip["places"], flags: Partial<Trip> = {}): Trip => ({
  id,
  title: `Trip ${id}`,
  start_date,
  end_date: null,
  notes: null,
  rating: null,
  cover_url: null,
  road_trip: false,
  cruise: false,
  rail: false,
  depart: null,
  arrive: null,
  idea_id: null,
  created_by: null,
  created_at: `2026-01-0${id}T00:00:00Z`,
  places,
  ...flags,
});

describe("visitStamps", () => {
  it("stamps each country once per trip, oldest trip first", () => {
    const trips = [
      trip(2, "2024-03-07", [place("Porto", "Portugal", "PT")]),
      trip(1, "2019-04-12", [place("Lisbon", "Portugal", "PT"), place("Faro", "Portugal", "PT"), place("Seville", "Spain", "ES")]),
    ];
    const stamps = visitStamps(trips);
    expect(stamps.map((s) => [s.code, s.date])).toEqual([
      ["PT", "2019-04-12"],
      ["ES", "2019-04-12"],
      ["PT", "2024-03-07"],
    ]);
    expect(stamps[0].entry).toBe("LIS");
  });

  it("names the port on a cruise and the place on a road trip", () => {
    const [cruise, road] = visitStamps([
      trip(1, "2022-06-18", [place("Bergen", "Norway", "NO")], { cruise: true }),
      trip(2, "2023-08-05", [place("Edinburgh", "United Kingdom", "GB")], { road_trip: true }),
    ]);
    expect(cruise.entry).toBe("PORT OF BERGEN");
    expect(road.entry).toBe("EDINBURGH");
  });
});

describe("lookFor", () => {
  it("gives a stamp the same look every time", () => {
    expect(lookFor("12-FR", 3)).toEqual(lookFor("12-FR", 3));
  });

  it("varies the look between stamps", () => {
    const looks = Array.from({ length: 40 }, (_, i) => lookFor(`${i}-IT`, 0));
    expect(new Set(looks.map((l) => l.shape)).size).toBeGreaterThan(3);
    expect(new Set(looks.map((l) => l.ink)).size).toBeGreaterThan(3);
  });

  it("keeps stamps on the page", () => {
    for (let i = 0; i < 200; i++) {
      const l = lookFor(`k${i}`, i % 6);
      expect(l.x - l.width / 2).toBeGreaterThanOrEqual(3);
      expect(l.x + l.width / 2).toBeLessThanOrEqual(97);
    }
  });
});

describe("pendingStamps", () => {
  it("draws idea stamps at one size", () => {
    const stamps = pendingStamps([
      { code: "PE", name: "Peru", idea: "Peru trek" },
      { code: "KE", name: "Kenya", idea: "Safari" },
    ]);
    expect(stamps.map((s) => s.look.width)).toEqual([44, 44]);
  });
});

describe("chunk and stampDate", () => {
  it("splits stamps into pages of six", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7]).map((p) => p.length)).toEqual([6, 1]);
  });

  it("prints dates like an entry stamp", () => {
    expect(stampDate("2024-03-07")).toBe("07 MAR 2024");
    expect(stampDate(null)).toBe("UNDATED");
  });
});
