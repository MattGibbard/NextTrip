import { describe, expect, it } from "vitest";
import { notAlready, starterPacking, starterTodos } from "../shared/starterLists";
import { tripOver } from "../shared/plan";

describe("starter packing", () => {
  it("adds things for the kind of holiday and how you get there", () => {
    const beach = starterPacking(["beach"], "flight");
    expect(beach.personal).toContain("Swimwear");
    expect(beach.shared).toEqual(expect.arrayContaining(["Passports", "Sun cream", "Plug adaptors"]));
    const ski = starterPacking(["ski", "nature"], "train");
    expect(ski.personal).toEqual(expect.arrayContaining(["Thermals", "Walking boots"]));
    expect(ski.shared).toContain("Train tickets");
    expect(ski.shared).not.toContain("Plug adaptors");
  });

  it("never lists the same thing twice", () => {
    const both = starterPacking(["nature", "adventure", "beach", "relax"], "flight");
    expect(new Set(both.personal).size).toBe(both.personal.length);
    expect(new Set(both.shared).size).toBe(both.shared.length);
  });
});

describe("starter jobs", () => {
  it("counts due dates back from the day you leave", () => {
    const jobs = starterTodos([], "flight", "2027-07-24", "2026-10-12");
    expect(jobs.find((j) => j.label === "Buy travel insurance")?.due).toBe("2027-05-25");
    expect(jobs.find((j) => j.label === "Pack!")?.due).toBe("2027-07-23");
    expect(jobs.some((j) => j.label.startsWith("Check in online"))).toBe(true);
  });

  it("leaves out jobs that don't fit the trip", () => {
    const jobs = starterTodos(["road-trip"], "road", null, "2026-10-12").map((j) => j.label);
    expect(jobs.some((j) => j.startsWith("Check in online"))).toBe(false);
    expect(jobs.some((j) => j.startsWith("Sort out the car"))).toBe(true);
    expect(jobs.some((j) => j.startsWith("Book ski"))).toBe(false);
  });

  it("has no dates without trip dates, and none in the past", () => {
    expect(starterTodos([], "flight", null, "2026-10-12").every((j) => j.due === null)).toBe(true);
    const soon = starterTodos([], "flight", "2026-10-20", "2026-10-12");
    expect(soon.find((j) => j.label === "Buy travel insurance")?.due).toBe("2026-10-12");
    expect(soon.find((j) => j.label === "Pack!")?.due).toBe("2026-10-19");
    // A trip that's already happened gets no dates at all.
    expect(starterTodos([], "flight", "2026-01-01", "2026-10-12").every((j) => j.due === null)).toBe(true);
  });

  it("skips anything already on the list", () => {
    expect(notAlready(["Passports", "Sun cream"], [" passports "], (l) => l)).toEqual(["Sun cream"]);
  });
});

describe("tripOver", () => {
  it("is over after the last day, or after the month", () => {
    expect(tripOver({ kind: "exact", start: "2026-10-01", end: "2026-10-11" }, "2026-10-12")).toBe(true);
    expect(tripOver({ kind: "exact", start: "2026-10-01", end: "2026-10-12" }, "2026-10-12")).toBe(false);
    expect(tripOver({ kind: "month", month: "2026-09" }, "2026-10-12")).toBe(true);
    expect(tripOver({ kind: "month", month: "2026-10" }, "2026-10-12")).toBe(false);
    expect(tripOver(null, "2026-10-12")).toBe(false);
  });
});
