import { describe, expect, it } from "vitest";
import { endsForMode, journeyLegs, nearestTerminal, searchTerminals } from "../shared/terminals";
import type { Terminal, TerminalRow } from "../shared/terminals";
import { cleanTerminal } from "../worker/terminals";

const rows: TerminalRow[] = [
  ["LHR", "London Heathrow", "London", "GB", 51.47, -0.46],
  ["LGW", "London Gatwick", "London", "GB", 51.15, -0.18],
  ["LHE", "Allama Iqbal", "Lahore", "PK", 31.52, 74.4],
  ["NAP", "Naples", "Napoli", "IT", 40.89, 14.29],
];

const stations: TerminalRow[] = [
  ["FRPNO", "Paris Gare du Nord", "", "FR", 48.88, 2.36],
  ["NLASC", "Amsterdam-Centraal", "", "NL", 52.38, 4.9],
  ["NLRTC", "Rotterdam Centraal", "", "NL", 51.93, 4.47],
];

describe("searchTerminals", () => {
  it("puts an exact code first, then codes starting with it", () => {
    expect(searchTerminals("airport", rows, "lhr").map((r) => r.terminal.code)).toEqual(["LHR"]);
    expect(searchTerminals("airport", rows, "LH").map((r) => r.terminal.code)).toEqual(["LHR", "LHE"]);
  });

  it("finds names and cities by the start of a word", () => {
    expect(searchTerminals("airport", rows, "heath").map((r) => r.terminal.code)).toEqual(["LHR"]);
    expect(searchTerminals("airport", rows, "london").map((r) => r.terminal.code)).toEqual(["LHR", "LGW"]);
    expect(searchTerminals("airport", rows, "napoli")[0].label).toBe("NAP · Naples, Napoli");
    expect(searchTerminals("airport", rows, "x")).toEqual([]);
  });

  it("matches several words in any order, across hyphens, with one wrong letter", () => {
    expect(searchTerminals("station", stations, "Amsterdam Centraal").map((r) => r.terminal.code)).toEqual(["NLASC"]);
    expect(searchTerminals("station", stations, "Gard Du Nord").map((r) => r.terminal.code)).toEqual(["FRPNO"]);
    expect(searchTerminals("station", stations, "paris nord").map((r) => r.terminal.code)).toEqual(["FRPNO"]);
    expect(searchTerminals("station", stations, "centraal").map((r) => r.terminal.code)).toEqual(["NLASC", "NLRTC"]);
  });
});

const place = (lat: number, lon: number) => ({ lat, lon });
const t = (kind: Terminal["kind"], lat: number, lon: number): Terminal => ({ kind, code: null, name: "", country_code: "GB", lat, lon });

describe("journeyLegs", () => {
  const places = [place(1, 1), place(2, 2), place(3, 3)];

  it("joins departure to arrival for flights and trains", () => {
    expect(journeyLegs("flight", t("airport", 0, 0), t("airport", 1, 1), places)).toEqual([[[0, 0], [1, 1]]]);
    expect(journeyLegs("train", t("station", 0, 0), null, places)).toEqual([]);
  });

  it("sails from the port to the first place, and back from the last", () => {
    expect(journeyLegs("cruise", t("port", 0, 0), null, places)).toEqual([
      [[0, 0], [1, 1]],
      [[3, 3], [0, 0]],
    ]);
  });

  it("flies a road trip out, then home from the last place", () => {
    expect(journeyLegs("road", t("airport", 0, 0), t("airport", 5, 5), places)).toEqual([
      [[0, 0], [5, 5]],
      [[3, 3], [0, 0]],
    ]);
  });

  it("draws nothing without a located departure", () => {
    expect(journeyLegs("flight", null, t("airport", 1, 1), places)).toEqual([]);
  });
});

describe("endsForMode", () => {
  it("drops ends that don't fit the mode", () => {
    const air = t("airport", 0, 0);
    expect(endsForMode("cruise", air, air)).toEqual({ depart: null, arrive: null });
    expect(endsForMode("road", air, air)).toEqual({ depart: air, arrive: air });
    expect(endsForMode("cruise", t("port", 0, 0), t("port", 0, 0)).arrive).toBeNull();
  });
});

describe("cleanTerminal", () => {
  it("takes airports and stations from the official lists by code", () => {
    expect(cleanTerminal({ kind: "airport", code: "lhr", name: "anything", lat: 0, lon: 0 })).toMatchObject({ code: "LHR", name: "London Heathrow", country_code: "GB" });
    expect(cleanTerminal(JSON.stringify({ kind: "station", code: "STP" }))).toMatchObject({ code: "STP", name: "London St Pancras International" });
    expect(cleanTerminal({ kind: "station", code: "KXSP" })).toBeNull();
    expect(cleanTerminal({ kind: "airport", code: "ZZZ" })).toBeNull();
  });

  it("keeps a named port without a code", () => {
    expect(cleanTerminal({ kind: "port", code: "SOU", name: "Southampton", country_code: "gb", lat: 50.9, lon: -1.4 })).toEqual({
      kind: "port",
      code: null,
      name: "Southampton",
      country_code: "GB",
      lat: 50.9,
      lon: -1.4,
    });
    expect(cleanTerminal(null)).toBeNull();
    expect(cleanTerminal("not json")).toBeNull();
  });
});

describe("nearestTerminal", () => {
  it("finds the closest listed airport", () => {
    expect(nearestTerminal("airport", rows, 40.85, 14.27)?.code).toBe("NAP");
    expect(nearestTerminal("airport", rows, 51.2, -0.2)?.code).toBe("LGW");
    expect(nearestTerminal("airport", [], 0, 0)).toBeNull();
  });
});
