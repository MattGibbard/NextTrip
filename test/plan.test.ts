import { describe, expect, it } from "vitest";
import { balances, costTotals, dayDate, dayStatus, daysUntil, formatMoney, guessCategory, parseAmount, lastTripDay, planDays, settleUp, tripSpanLabel } from "../shared/plan";
import type { PlanCost, PlanItem, PlanSettlement } from "../shared/plan";

const cost = (amount: number, paid_by: number | null, status: PlanCost["status"] = "booked", category: PlanCost["category"] = "travel"): PlanCost => ({
  id: amount,
  title: "x",
  amount,
  category,
  status,
  day: null,
  paid_by,
});
const item = (day: number, status: PlanItem["status"] = "plan"): PlanItem => ({ id: day, day, time: null, title: "x", notes: null, status });
const paid = (from_person: number, to_person: number, amount: number): PlanSettlement => ({ id: 1, from_person, to_person, amount, created_at: "" });

describe("planDays", () => {
  it("has a day for each of the draw's exact dates, counting both ends", () => {
    expect(planDays({ days: 4, items: [] }, { kind: "exact", start: "2027-08-14", end: "2027-08-22" }, "week")).toBe(9);
  });
  it("uses the days the family set when there are no exact dates", () => {
    expect(planDays({ days: 4, items: [] }, { kind: "month", month: "2027-08" }, "week")).toBe(4);
  });
  it("falls back to the trip length, then a week", () => {
    expect(planDays({ days: null, items: [] }, { kind: "month", month: "2027-08" }, "weekend")).toBe(3);
    expect(planDays({ days: null, items: [] }, null, null)).toBe(8);
  });
  it("never hides a day that has something on it", () => {
    expect(planDays({ days: 3, items: [item(6)] }, null, null)).toBe(6);
  });
});

describe("tripSpanLabel", () => {
  it("counts days and nights from the draw's exact dates", () => {
    expect(tripSpanLabel({ kind: "exact", start: "2027-08-14", end: "2027-08-15" })).toBe("2 days · 1 night");
    expect(tripSpanLabel({ kind: "exact", start: "2027-08-14", end: "2027-08-21" })).toBe("8 days · 7 nights");
    expect(tripSpanLabel({ kind: "exact", start: "2027-08-14", end: "2027-08-14" })).toBe("1 day");
  });
  it("is null without exact dates, so the idea's length shows instead", () => {
    expect(tripSpanLabel({ kind: "month", month: "2027-08" })).toBeNull();
    expect(tripSpanLabel(null)).toBeNull();
    expect(lastTripDay(null)).toBeNull();
    expect(lastTripDay({ kind: "exact", start: "2027-08-14", end: "2027-08-15" })).toBe(2);
  });
});

it("dates each day from the draw's exact start, across a month end", () => {
  const dates = { kind: "exact", start: "2027-08-30", end: "2027-09-03" } as const;
  expect(dayDate(dates, 1)).toBe("2027-08-30");
  expect(dayDate(dates, 4)).toBe("2027-09-02");
  expect(dayDate({ kind: "month", month: "2027-08" }, 1)).toBeNull();
});

it("counts the days to go", () => {
  expect(daysUntil({ kind: "exact", start: "2027-08-14", end: "2027-08-22" }, "2026-10-11")).toBe(307);
  expect(daysUntil(null, "2026-10-11")).toBeNull();
});

it("adds up booked and estimated costs, and each category", () => {
  const t = costTotals([cost(184000, 1), cost(52000, null, "estimate", "stays"), cost(11800, 2, "booked", "activities")]);
  expect(t).toMatchObject({ booked: 195800, estimate: 52000, total: 247800 });
  expect(t.byCategory).toMatchObject({ travel: 184000, stays: 52000, activities: 11800, food: 0 });
});

describe("settling up", () => {
  it("splits what each person paid evenly and says who owes whom", () => {
    // Matt (1) paid 2,368, Brogan (2) paid 1,072: each share is 1,720, so Brogan owes Matt 648.
    const owed = balances([cost(184000, 1), cost(41000, 1), cost(11800, 1), cost(61200, 2), cost(46000, 2)], [], [1, 2]);
    expect(owed.get(1)).toBe(64800);
    expect(owed.get(2)).toBe(-64800);
    expect(settleUp(owed)).toEqual([{ from: 2, to: 1, amount: 64800 }]);
  });

  it("ignores estimates and costs nobody has paid", () => {
    expect(settleUp(balances([cost(5000, 1, "estimate"), cost(5000, null)], [], [1, 2]))).toEqual([]);
  });

  it("hands out the odd pennies so nothing is lost", () => {
    const owed = balances([cost(1000, 1)], [], [1, 2, 3]);
    expect([...owed.values()].reduce((a, b) => a + b, 0)).toBe(0);
    expect(owed.get(1)).toBe(1000 - 334);
    expect(owed.get(2)).toBe(-333);
  });

  it("counts paying someone back", () => {
    const owed = balances([cost(10000, 1)], [paid(2, 1, 5000)], [1, 2]);
    expect(settleUp(owed)).toEqual([]);
    const part = balances([cost(10000, 1)], [paid(2, 1, 2000)], [1, 2]);
    expect(settleUp(part)).toEqual([{ from: 2, to: 1, amount: 3000 }]);
  });

  it("keeps someone who paid in, even after they've left the family", () => {
    const owed = balances([cost(9000, 9)], [], [1, 2]);
    expect(settleUp(owed)).toEqual([
      { from: 1, to: 9, amount: 4500 },
      { from: 2, to: 9, amount: 4500 },
    ]);
  });
});

it("reads amounts as pence", () => {
  expect(parseAmount("960")).toBe(96000);
  expect(parseAmount("£1,250.5")).toBe(125050);
  expect(parseAmount("12.345")).toBeNull();
  expect(parseAmount("0")).toBeNull();
  expect(parseAmount("")).toBeNull();
});

it("shows money without pence when it's whole", () => {
  expect(formatMoney(464000, "GBP")).toBe("£4,640");
  expect(formatMoney(1250, "GBP")).toBe("£12.50");
  expect(formatMoney(100, "CAD")).toBe("CA$1");
});

it("says whether a day is booked", () => {
  expect(dayStatus([])).toBe("free");
  expect(dayStatus([item(1, "booked"), item(1, "booked")])).toBe("booked");
  expect(dayStatus([item(1, "booked"), item(1, "plan")])).toBe("plan");
  expect(dayStatus([item(1, "booked"), item(1, "to_book")])).toBe("to_book");
});

describe("guessCategory", () => {
  it("files booked things under the right kind of cost", () => {
    expect(guessCategory("Flights to Vancouver")).toBe("travel");
    expect(guessCategory("Car hire at the airport")).toBe("travel");
    expect(guessCategory("Fairmont hotel, 2 nights")).toBe("stays");
    expect(guessCategory("Dinner at Araxi")).toBe("food");
    expect(guessCategory("Peak 2 Peak gondola")).toBe("activities");
  });
});
