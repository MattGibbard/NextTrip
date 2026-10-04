import { describe, expect, it } from "vitest";
import { countedAllocations, ideaForTicket, randomTicket, ticketRanges, validateAllocation, vetoesIgnored } from "../shared/draw";

describe("ticketRanges", () => {
  it("adds both people's points per idea and lays tickets end to end", () => {
    const ranges = ticketRanges([
      { person_id: 1, idea_id: 3, points: 4 },
      { person_id: 1, idea_id: 1, points: 6 },
      { person_id: 2, idea_id: 3, points: 10 },
    ]);
    expect(ranges).toEqual([
      { idea_id: 1, tickets: 6, from: 1, to: 6 },
      { idea_id: 3, tickets: 14, from: 7, to: 20 },
    ]);
    expect(ideaForTicket(ranges, 6)).toBe(1);
    expect(ideaForTicket(ranges, 7)).toBe(3);
    expect(ideaForTicket(ranges, 20)).toBe(3);
    expect(() => ideaForTicket(ranges, 21)).toThrow();
  });
});

describe("randomTicket", () => {
  it("stays in range and rejects biased values", () => {
    const values = [0xffffffff, 4];
    const ticket = randomTicket(10, (buf) => {
      buf[0] = values.shift()!;
    });
    expect(ticket).toBe(5);
  });

  it("is roughly weighted by points", () => {
    const ranges = ticketRanges([
      { person_id: 1, idea_id: 1, points: 1 },
      { person_id: 1, idea_id: 2, points: 9 },
    ]);
    let wins = 0;
    for (let i = 0; i < 20000; i++) {
      if (ideaForTicket(ranges, randomTicket(10, (b) => crypto.getRandomValues(b))) === 2) wins++;
    }
    expect(wins / 20000).toBeGreaterThan(0.88);
    expect(wins / 20000).toBeLessThan(0.92);
  });
});

describe("validateAllocation", () => {
  const active = new Set([1, 2, 3]);
  it("allows partial saves but requires every point to lock in", () => {
    const entries = [{ idea_id: 1, points: 4 }];
    expect(validateAllocation(entries, 10, active, false)).toBeNull();
    expect(validateAllocation(entries, 10, active, true)).toMatch(/6 left/);
    expect(validateAllocation([...entries, { idea_id: 2, points: 6 }], 10, active, true)).toBeNull();
  });
  it("rejects overspending, fractions and ideas outside the pool", () => {
    expect(validateAllocation([{ idea_id: 1, points: 11 }], 10, active, false)).toMatch(/only have 10/);
    expect(validateAllocation([{ idea_id: 1, points: 1.5 }], 10, active, false)).toMatch(/whole/);
    expect(validateAllocation([{ idea_id: 9, points: 1 }], 10, active, false)).toMatch(/pool/);
  });
});

describe("countedAllocations", () => {
  const allocs = [
    { person_id: 1, idea_id: 10, points: 6 },
    { person_id: 1, idea_id: 20, points: 4 },
    { person_id: 2, idea_id: 10, points: 10 },
  ];

  it("drops points on vetoed ideas", () => {
    expect(countedAllocations(allocs, [10])).toEqual([{ person_id: 1, idea_id: 20, points: 4 }]);
    expect(vetoesIgnored(allocs, [10])).toBe(false);
  });

  it("keeps everything when the vetoes would knock out every ticket", () => {
    expect(countedAllocations(allocs, [10, 20])).toEqual(allocs);
    expect(vetoesIgnored(allocs, [10, 20])).toBe(true);
  });

  it("changes nothing without vetoes", () => {
    expect(countedAllocations(allocs, [])).toEqual(allocs);
    expect(vetoesIgnored(allocs, [])).toBe(false);
  });
});
