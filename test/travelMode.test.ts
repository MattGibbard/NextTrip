import { describe, expect, it } from "vitest";
import { ideaMode, modeFlags, placeCode, ticketEnds, tripMode } from "../shared/travelMode";

describe("tripMode", () => {
  it("is a flight unless a trip says otherwise", () => {
    expect(tripMode({ road_trip: false, cruise: false, rail: false })).toBe("flight");
    expect(tripMode({ road_trip: false, cruise: false, rail: true })).toBe("train");
    expect(tripMode({ road_trip: true, cruise: false, rail: false })).toBe("road");
    expect(tripMode({ road_trip: true, cruise: true, rail: false })).toBe("cruise");
  });

  it("round-trips through the stored flags", () => {
    for (const m of ["flight", "train", "cruise", "road"] as const) expect(tripMode(modeFlags(m))).toBe(m);
  });

  it("reads an idea's holiday types", () => {
    expect(ideaMode(["beach"])).toBe("flight");
    expect(ideaMode(["rail", "food"])).toBe("train");
    expect(ideaMode(["cruise"])).toBe("cruise");
  });
});

describe("placeCode", () => {
  it("takes the first three letters, without accents or spaces", () => {
    expect(placeCode("Naples")).toBe("NAP");
    expect(placeCode("Ålesund")).toBe("ALE");
    expect(placeCode("St Ives")).toBe("STI");
    expect(placeCode("東京")).toBe("···");
  });
});

describe("ticketEnds", () => {
  const home = { name: "London" };
  const a = { name: "Bergen" };
  const b = { name: "Geiranger" };
  const c = { name: "Ålesund" };

  it("flies from home to the first place", () => {
    expect(ticketEnds("flight", [a, b], home)).toEqual({ from: home, to: a });
  });

  it("sails first port to last", () => {
    expect(ticketEnds("cruise", [a, b, c], home)).toEqual({ from: a, to: c });
  });

  it("has no ends without places, or with one place and no home", () => {
    expect(ticketEnds("flight", [], home)).toBeNull();
    expect(ticketEnds("train", [a], null)).toBeNull();
  });
});
