import { describe, expect, it } from "vitest";
import { stampDate, stampLook } from "../src/stamps";

const CODES = ["FR", "IT", "ES", "PT", "JP", "US", "GB", "NO", "AT", "CH", "IS", "ME", "BA", "DE", "GR", "HR", "TH", "PE", "KE", "MX"];

describe("stampLook", () => {
  it("gives a country the same stamp every time", () => {
    expect(stampLook("FR", "France")).toEqual(stampLook("FR", "France"));
  });

  it("varies shapes, borders, trims and labels across countries", () => {
    const looks = CODES.map((c) => stampLook(c, "Italy"));
    expect(new Set(looks.map((l) => l.shape)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(looks.map((l) => l.border)).size).toBe(3);
    expect(new Set(looks.map((l) => l.trim)).size).toBe(3);
    expect(new Set(looks.map((l) => l.label)).size).toBeGreaterThanOrEqual(3);
  });

  it("keeps long names out of round stamps", () => {
    for (const c of CODES) expect(["circle", "oval"]).not.toContain(stampLook(c, "Bosnia and Herzegovina").shape);
  });
});

it("prints dates like an entry stamp", () => {
  expect(stampDate("2019-04-12")).toBe("12 APR 2019");
  expect(stampDate(null)).toBe("UNDATED");
});
