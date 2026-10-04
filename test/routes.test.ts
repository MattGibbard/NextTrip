import { describe, expect, it } from "vitest";
import { greatCircle, routeLegs } from "../shared/routes";

const a = { lat: 1, lon: 1 };
const b = { lat: 2, lon: 2 };
const c = { lat: 3, lon: 3 };

describe("routeLegs", () => {
  it("goes city to city on a road trip", () => {
    expect(routeLegs([a, b, c], true)).toEqual([
      [[1, 1], [2, 2]],
      [[2, 2], [3, 3]],
    ]);
  });

  it("fans out from the first city otherwise", () => {
    expect(routeLegs([a, b, c], false)).toEqual([
      [[1, 1], [2, 2]],
      [[1, 1], [3, 3]],
    ]);
  });

  it("draws nothing for one city, and skips places without coordinates", () => {
    expect(routeLegs([a], true)).toEqual([]);
    expect(routeLegs([a, { lat: null, lon: null }], false)).toEqual([]);
  });
});

describe("greatCircle", () => {
  it("starts and ends at the two places", () => {
    const pts = greatCircle([51.5, -0.1], [35.7, 139.7]);
    expect(pts[0][0]).toBeCloseTo(51.5);
    expect(pts[0][1]).toBeCloseTo(-0.1);
    expect(pts.at(-1)![0]).toBeCloseTo(35.7);
    expect(pts.at(-1)![1]).toBeCloseTo(139.7);
  });

  it("keeps longitudes continuous across the date line", () => {
    const pts = greatCircle([35.7, 139.7], [37.8, -122.4]);
    for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][1] - pts[i - 1][1])).toBeLessThan(180);
    expect(pts.at(-1)![1]).toBeCloseTo(-122.4 + 360);
  });
});

it("follows the route in order for road trips and cruises", async () => {
  const { followsInOrder } = await import("../shared/routes");
  expect(followsInOrder(["road-trip"])).toBe(true);
  expect(followsInOrder(["cruise", "relax"])).toBe(true);
  expect(followsInOrder(["city"])).toBe(false);
});
