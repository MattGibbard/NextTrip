import { describe, expect, it } from "vitest";
import { cleanFilters, hasFilters, matchesFilters, NO_FILTERS } from "../shared/roundFilters";
import type { IdeaDetails } from "../shared/types";

const beachWeek: IdeaDetails = { budget: 2, trip_length: "week", travel_time: "medium", holiday_types: ["beach", "relax"] };
const untagged: IdeaDetails = { budget: null, trip_length: null, travel_time: null, holiday_types: [] };

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

describe("cleanFilters", () => {
  it("parses stored JSON and drops unknown values", () => {
    expect(cleanFilters('{"budgets":[1,9,1],"holiday_types":["beach","moon"],"trip_lengths":"x"}')).toEqual({
      ...NO_FILTERS,
      budgets: [1],
      holiday_types: ["beach"],
    });
    expect(cleanFilters("not json")).toEqual(NO_FILTERS);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });
});
