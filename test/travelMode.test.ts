import { describe, expect, it } from "vitest";
import { ideaMode, modeFlags, placeCode, ticketEnds, tripMode } from "../shared/travelMode";
import type { Terminal } from "../shared/terminals";

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
  const trip = (places: { name: string }[], depart: Terminal | null = null, arrive: Terminal | null = null) => ({ places, depart, arrive });
  const at = (code: string, name: string) => ({ code, name });
  const terminal = (kind: Terminal["kind"], code: string | null, name: string): Terminal => ({ kind, code, name, country_code: "GB", lat: 0, lon: 0 });

  it("flies from home to the first place", () => {
    expect(ticketEnds("flight", trip([a, b]), home)).toEqual({ from: at("LON", "London"), to: at("BER", "Bergen") });
  });

  it("sails first port to last", () => {
    expect(ticketEnds("cruise", trip([a, b, c]), home)).toEqual({ from: at("BER", "Bergen"), to: at("ALE", "Ålesund") });
  });

  it("has no ends without places, or with one place and no home", () => {
    expect(ticketEnds("flight", trip([]), home)).toBeNull();
    expect(ticketEnds("train", trip([a]), null)).toBeNull();
  });

  it("uses the airports or stations when they're set", () => {
    const lhr = terminal("airport", "LHR", "London Heathrow");
    const bgo = terminal("airport", "BGO", "Bergen");
    expect(ticketEnds("flight", trip([a, b], lhr, bgo), home)).toEqual({ from: at("LHR", "London Heathrow"), to: at("BGO", "Bergen") });
    expect(ticketEnds("road", trip([b, c], lhr, bgo), null)).toEqual({ from: at("LHR", "London Heathrow"), to: at("BGO", "Bergen") });
    const stp = terminal("station", "STP", "London St Pancras International");
    expect(ticketEnds("train", trip([b, c], stp), null)).toEqual({ from: at("STP", "London St Pancras International"), to: at("ALE", "Ålesund") });
  });

  it("sails from the embarking port to the first place", () => {
    const port = terminal("port", null, "Southampton");
    expect(ticketEnds("cruise", trip([a, b], port), home)).toEqual({ from: at("SOU", "Southampton"), to: at("BER", "Bergen") });
  });
});
