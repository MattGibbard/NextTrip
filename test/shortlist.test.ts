import { describe, expect, it } from "vitest";
import { buildShortlist, unswiped } from "../shared/shortlist";

const yes = (person_id: number, idea_id: number) => ({ person_id, idea_id, liked: true });
const no = (person_id: number, idea_id: number) => ({ person_id, idea_id, liked: false });

describe("buildShortlist", () => {
  it("keeps ideas you both liked", () => {
    const swipes = [yes(1, 10), yes(2, 10), yes(1, 20), yes(2, 20), yes(1, 30), no(2, 30)];
    expect(buildShortlist([10, 20, 30], [1, 2], swipes)).toEqual({ ids: [10, 20], rule: "both" });
  });

  it("falls back to ideas either of you liked", () => {
    const swipes = [yes(1, 10), yes(2, 10), yes(1, 20), no(2, 20), no(1, 30), no(2, 30)];
    expect(buildShortlist([10, 20, 30], [1, 2], swipes)).toEqual({ ids: [10, 20], rule: "either" });
  });

  it("keeps everything when hardly anything was liked", () => {
    const swipes = [no(1, 10), no(2, 10), yes(1, 20), no(2, 20)];
    expect(buildShortlist([10, 20], [1, 2], swipes)).toEqual({ ids: [10, 20], rule: "all" });
  });
});

it("lists the ideas a person still has to swipe", () => {
  expect(unswiped(1, [10, 20, 30], [yes(1, 10), no(2, 20)])).toEqual([20, 30]);
});
