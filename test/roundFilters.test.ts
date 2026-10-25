import { describe, expect, it } from "vitest";
import { cleanFilters, hasFilters, matchesFilters, NO_FILTERS } from "../shared/roundFilters";
import type { IdeaDetails, Place } from "../shared/types";

type Matchable = IdeaDetails & { places: Pick<Place, "country_code">[] };
const beachWeek: Matchable = { budget: 2, trip_length: "week", travel_time: "medium", holiday_types: ["beach", "relax"], places: [{ country_code: "ES" }] };
const untagged: Matchable = { budget: null, trip_length: null, travel_time: null, holiday_types: [], places: [] };
// A cruise from Miami down to Cartagena: in North and South America.
const cruise: Matchable = { ...untagged, places: [{ country_code: "US" }, { country_code: "CO" }] };

describe("matchesFilters", () => {
  it("matches everything with no filters", () => {
    expect(matchesFilters(beachWeek, NO_FILTERS)).toBe(true);
    expect(matchesFilters(untagged, NO_FILTERS)).toBe(true);
  });
  it("needs every set filter to match, any choice within one", () => {
    expect(matchesFilters(beachWeek, { ...NO_FILTERS, budgets: [1, 2] })).toBe(true);
    expect(matchesFilters(beachWeek, { ...NO_FILTERS, budgets: [3] })).toBe(false);
    expect(matchesFilters(beachWeek, { ...NO_FILTERS, holiday_types: ["city", "beach"] })).toBe(true);
    expect(matchesFilters(beachWeek, { ...NO_FILTERS, budgets: [2], travel_times: ["short"] })).toBe(false);
  });
  it("leaves out ideas missing a filtered detail", () => {
    expect(matchesFilters(untagged, { ...NO_FILTERS, trip_lengths: ["week"] })).toBe(false);
  });
});

describe("continent filters", () => {
  it("lets an idea in when any of its places is in a picked continent", () => {
    expect(matchesFilters(beachWeek, { ...NO_FILTERS, continents: ["europe"] })).toBe(true);
    expect(matchesFilters(beachWeek, { ...NO_FILTERS, continents: ["asia", "africa"] })).toBe(false);
    expect(matchesFilters(cruise, { ...NO_FILTERS, continents: ["south-america"] })).toBe(true);
    expect(matchesFilters(cruise, { ...NO_FILTERS, continents: ["europe"] })).toBe(false);
  });

  it("leaves out ideas without places", () => {
    expect(matchesFilters(untagged, { ...NO_FILTERS, continents: ["europe"] })).toBe(false);
  });

  it("counts Turkey and Cyprus as Europe", () => {
    expect(matchesFilters({ ...untagged, places: [{ country_code: "TR" }] }, { ...NO_FILTERS, continents: ["europe"] })).toBe(true);
    expect(matchesFilters({ ...untagged, places: [{ country_code: "CY" }] }, { ...NO_FILTERS, continents: ["asia"] })).toBe(false);
  });
});

describe("cleanFilters", () => {
  it("parses stored JSON and drops unknown values", () => {
    expect(cleanFilters('{"budgets":[1,9,1],"holiday_types":["beach","moon"],"trip_lengths":"x","continents":["europe","atlantis"]}')).toEqual({
      ...NO_FILTERS,
      budgets: [1],
      holiday_types: ["beach"],
      continents: ["europe"],
    });
    expect(cleanFilters("not json")).toEqual(NO_FILTERS);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });
});
