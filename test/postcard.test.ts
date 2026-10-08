import { describe, expect, it } from "vitest";
import { postcardTilt, postmarkDate } from "../src/postcard";

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
