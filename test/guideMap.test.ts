import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain JavaScript build script
import { compact, guideMap } from "../scripts/guide-map.mjs";
// @ts-expect-error: a plain JavaScript build script
import { fullGuide } from "../scripts/destination-cards.mjs";
import { readDestination } from "../src/destinations";
import garda from "../content/destinations/lake-garda.json";

describe("guide maps", () => {
  it("shortens paths, dropping repeated points and rings that shrink to nothing", () => {
    expect(compact("M10,10L10,10L12,10L12,7L10,10ZM5,5L5,5L6,5Z")).toBe("M10,10l2,0 0-3 -2,3z");
  });

  it("draws the place's country separately from the rest", async () => {
    const map = await guideMap(45.6, 10.7, "IT");
    expect(map.country.length).toBeGreaterThan(100);
    expect(map.land.length).toBeGreaterThan(1000);
    expect(await guideMap(null, null, "IT")).toBeNull();
  });

  it("finds the country from the pin when the code has no outline of its own", async () => {
    // No country code: the pin is in Paris, so France is shaded.
    const map = await guideMap(48.86, 2.35, "");
    expect(map.country.length).toBeGreaterThan(100);
  });

  it("reaches a guide's page in its full file", async () => {
    const d = readDestination("lake-garda", await fullGuide(garda, "lake-garda"));
    expect(d.map?.country).toMatch(/^M/);
  });
});
