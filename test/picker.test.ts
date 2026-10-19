import { describe, expect, it } from "vitest";
import { DESTINATIONS, findDestination } from "../src/destinations";
import { BOARD_SIZE, NO_ANSWERS, answersSummary, draw, fits, loosen, matches, nextMonth, pickMeta, pickerStay, readAlso, readAnswers, resultHref } from "../src/picker";
import type { Answers } from "../src/picker";
import { metaTags, publicPage } from "../shared/seo";

const lisbon = findDestination("lisbon")!;
const answers = (a: Partial<Answers>): Answers => ({ ...NO_ANSWERS, ...a });

describe("holiday picker filters", () => {
  it("lets every guide in with no answers", () => {
    expect(matches(DESTINATIONS, NO_ANSWERS)).toHaveLength(DESTINATIONS.length);
  });

  it("matches any of the holiday types picked", () => {
    expect(fits(lisbon, answers({ types: ["beach", "ski"] }))).toBe(true);
    expect(fits(lisbon, answers({ types: ["ski"] }))).toBe(false);
  });

  it("only counts the best and good months", () => {
    const good = lisbon.months.findIndex((m) => m.rating !== "quiet");
    const quiet = lisbon.months.findIndex((m) => m.rating === "quiet");
    const code = (i: number) => lisbon.months[i].code.toLowerCase() as Answers["month"];
    expect(fits(lisbon, answers({ month: code(good) }))).toBe(true);
    expect(fits(lisbon, answers({ month: code(quiet) }))).toBe(false);
  });

  it("treats the budget as the most they'll spend", () => {
    expect(lisbon.budget).toBe(2);
    expect(fits(lisbon, answers({ budget: 1 }))).toBe(false);
    expect(fits(lisbon, answers({ budget: 2 }))).toBe(true);
    expect(fits(lisbon, answers({ budget: 3 }))).toBe(true);
  });

  it("matches the trip length", () => {
    expect(lisbon.trip_length).toBe("week");
    expect(fits(lisbon, answers({ length: "week" }))).toBe(true);
    expect(fits(lisbon, answers({ length: "weekend" }))).toBe(false);
  });

  it("suggests which answer to loosen when nothing fits", () => {
    const none = answers({ types: ["ski"], month: "jul", budget: 1 });
    expect(matches(DESTINATIONS, none)).toHaveLength(0);
    const fixes = loosen(DESTINATIONS, none);
    expect(fixes.length).toBeGreaterThan(0);
    for (const f of fixes) expect(matches(DESTINATIONS, f.answers)).toHaveLength(f.count);
    expect(fixes.map((f) => f.count)).toEqual([...fixes.map((f) => f.count)].sort((a, b) => b - a));
  });
});

describe("the draw", () => {
  it("draws from the matches and puts a few others on the board", () => {
    const pool = matches(DESTINATIONS, answers({ types: ["city"] }));
    const picked = draw(pool, () => 0.5)!;
    expect(pool).toContain(picked.winner);
    expect(picked.also).toHaveLength(BOARD_SIZE - 1);
    expect(picked.also).not.toContain(picked.winner);
    expect(new Set(picked.also.map((d) => d.slug)).size).toBe(picked.also.length);
  });

  it("draws nothing when nothing fits, and the only match when one does", () => {
    expect(draw([])).toBeNull();
    expect(draw([lisbon])).toEqual({ winner: lisbon, also: [] });
  });
});

describe("result links", () => {
  it("carry the answers and the board, and read back", () => {
    const a = answers({ types: ["city", "beach"], month: "sep", budget: 2, length: "week", from: "LGW" });
    const href = resultHref("lisbon", a, ["nice", "lisbon", "nowhere"]);
    expect(href).toBe("/holiday-picker/lisbon?t=city,beach&m=sep&b=2&n=week&from=LGW&also=nice,lisbon,nowhere");
    const q = new URL(href, "https://somewhere.party").searchParams;
    expect(readAnswers(q)).toEqual(a);
    expect(readAlso(q, DESTINATIONS, "lisbon").map((d) => d.slug)).toEqual(["nice"]);
    expect(publicPage("/holiday-picker/lisbon")).toBe("pick:lisbon");
    expect(publicPage("/holiday-picker")).toBe("picker");
  });

  it("drop anything that isn't a real answer", () => {
    expect(readAnswers(new URLSearchParams("t=ski,space&m=smarch&b=9&n=forever&from=XXX"))).toEqual(answers({ types: ["ski"] }));
  });

  it("are kept out of search but still preview when shared", () => {
    const tags = metaTags(pickMeta(lisbon));
    expect(tags).toContain('<meta name="robots" content="noindex" />');
    expect(tags).not.toContain("canonical");
    expect(tags).toContain("og:image");
    expect(tags).toContain("Our random holiday: Lisbon");
  });

  it("summarise the answers", () => {
    expect(answersSummary(answers({ types: ["city", "beach"], month: "sep", budget: 2, length: "week" }))).toEqual(["city break or beach", "September", "about a week", "££ budget"]);
    expect(answersSummary(NO_ANSWERS)).toEqual([]);
  });
});

describe("booking dates", () => {
  it("use the next time the month comes round", () => {
    const today = new Date(2026, 9, 19);
    expect(nextMonth("dec", today)).toBe("2026-12");
    expect(nextMonth("oct", today)).toBe("2027-10");
    expect(pickerStay(answers({ month: "dec", length: "weekend" }), today)).toEqual({ start: "2026-12-01", end: "2026-12-04" });
    expect(pickerStay(NO_ANSWERS, today)).toBeNull();
  });
});
