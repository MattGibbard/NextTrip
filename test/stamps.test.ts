import { describe, expect, it } from "vitest";
import { stampDate, stampLook } from "../src/stamps";

const CODES = ["FR", "IT", "ES", "PT", "JP", "US", "GB", "NO", "AT", "CH", "IS", "ME", "BA", "DE", "GR", "HR", "TH", "PE", "KE", "MX"];

describe("stampLook", () => {
  it("gives a country the same stamp every time", () => {
    expect(stampLook("FR", "France")).toEqual(stampLook("FR", "France"));
  });

  it("varies shapes, borders, trims and labels across countries", () => {
    const looks = Array.from({ length: 60 }, (_, i) => stampLook(`${i}-IT`, "Italy"));
    expect(new Set(looks.map((l) => l.shape)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(looks.map((l) => l.border)).size).toBe(3);
    expect(new Set(looks.map((l) => l.trim)).size).toBe(3);
    expect(new Set(looks.map((l) => l.label)).size).toBeGreaterThanOrEqual(3);
  });

  it("tilts stamps both ways, at most 4 degrees", () => {
    const tilts = CODES.map((c) => stampLook(`7-${c}`, "Italy").tilt);
    expect(tilts.some((t) => t < 0) && tilts.some((t) => t > 0)).toBe(true);
    for (const t of tilts) expect(Math.abs(t)).toBeLessThanOrEqual(4);
  });

  it("gives repeat visits to a country different stamps", () => {
    const looks = ["1-FR", "2-FR", "3-FR", "4-FR"].map((k) => JSON.stringify(stampLook(k, "France")));
    expect(new Set(looks).size).toBeGreaterThan(1);
  });

  it("keeps long names out of round stamps", () => {
    for (const c of CODES) expect(["circle", "oval"]).not.toContain(stampLook(c, "Bosnia and Herzegovina").shape);
  });
});

it("prints dates like an entry stamp", () => {
  expect(stampDate("2019-04-12")).toBe("12 APR 2019");
  expect(stampDate(null)).toBe("UNDATED");
});
