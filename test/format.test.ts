import { expect, it } from "vitest";
import { listNames, nights, shortRange } from "../src/format";

it("counts nights", () => {
  expect(nights("2026-04-02", "2026-04-14")).toBe(12);
  expect(nights("2026-04-02", null)).toBeNull();
});

it("writes compact date ranges", () => {
  expect(shortRange("2026-04-02", "2026-04-14")).toBe("2–14 Apr 2026");
  expect(shortRange("2026-03-28", "2026-04-03")).toBe("28 Mar – 3 Apr 2026");
  expect(shortRange("2025-12-30", "2026-01-02")).toBe("30 Dec 2025 – 2 Jan 2026");
  expect(shortRange("2026-04-02", null)).toBe("2 Apr 2026");
  expect(shortRange(null, null)).toBeNull();
});

it("lists names in a sentence", () => {
  expect(listNames(["Sam"])).toBe("Sam");
  expect(listNames(["Sam", "Alex"])).toBe("Sam and Alex");
  expect(listNames(["Sam", "Alex", "Jo"])).toBe("Sam, Alex and Jo");
});
