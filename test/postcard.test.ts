import { describe, expect, it } from "vitest";
import { postcardTilt, postmarkDate, routeSketch } from "../src/postcard";

describe("postcardTilt", () => {
  it("keeps the same tilt for a trip, within 1.6° either way", () => {
    expect(postcardTilt(42)).toBe(postcardTilt(42));
    const tilts = Array.from({ length: 200 }, (_, i) => postcardTilt(i + 1));
    expect(Math.max(...tilts.map(Math.abs))).toBeLessThanOrEqual(1.6);
    expect(new Set(tilts).size).toBeGreaterThan(20);
    expect(tilts.some((t) => t < 0) && tilts.some((t) => t > 0)).toBe(true);
  });
});

describe("postmarkDate", () => {
  it("reads the month and year off a date", () => {
    expect(postmarkDate("2026-09-15")).toEqual({ month: "SEP", year: "2026" });
    expect(postmarkDate(null)).toBeNull();
  });
});

describe("routeSketch", () => {
  const lgw = { lat: 51.15, lon: -0.18, label: "LGW" };
  const palma = { lat: 39.57, lon: 2.65, label: "PMI" };
  const calvia = { lat: 39.56, lon: 2.51 };

  it("fits every point inside the box with room round the edge", () => {
    const s = routeSketch([lgw, palma, calvia], true)!;
    for (const p of s.pins) {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(90);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(90);
    }
    expect(s.pins.map((p) => p.label)).toEqual(["LGW", "PMI", undefined]);
  });

  it("arcs a flight's first leg and draws the rest straight", () => {
    expect(routeSketch([lgw, palma, calvia], true)!.d).toMatch(/^M[\d.]+ [\d.]+ Q.+ L/);
    expect(routeSketch([lgw, palma, calvia], false)!.d).not.toContain("Q");
  });

  it("centres a single place and draws nothing without places", () => {
    expect(routeSketch([palma], false)!.pins[0]).toMatchObject({ x: 50, y: 50 });
    expect(routeSketch([], false)).toBeNull();
  });
});
