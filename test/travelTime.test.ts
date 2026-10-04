import { describe, expect, it } from "vitest";
import { estimateTravel, formatHours } from "../shared/travelTime";

const london = { lat: 51.51, lon: -0.13 };

describe("estimateTravel", () => {
  it("estimates a short hop", () => {
    const e = estimateTravel(london, [{ lat: 41.9, lon: 12.5 }])!;
    expect(Math.round(e.km / 10) * 10).toBe(1430);
    expect(e.travel_time).toBe("short");
  });

  it("uses the furthest place", () => {
    const e = estimateTravel(london, [
      { lat: 48.86, lon: 2.35 },
      { lat: 35.68, lon: 139.69 },
    ])!;
    expect(e.travel_time).toBe("very-long");
  });

  it("needs coordinates for home and at least one place", () => {
    expect(estimateTravel(null, [{ lat: 1, lon: 1 }])).toBeNull();
    expect(estimateTravel(london, [{ lat: null, lon: null }])).toBeNull();
  });
});

it("formats hours", () => {
  expect(formatHours(2.29)).toBe("2h 15m");
  expect(formatHours(12)).toBe("12h");
  expect(formatHours(0.4)).toBe("30m");
});
