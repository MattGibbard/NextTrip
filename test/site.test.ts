import { describe, expect, it } from "vitest";
import { HOME, bannerEnded, bannerKey, readBanner, readHome } from "../src/site";

describe("home page words", () => {
  it("come from the editor's file", () => {
    expect(HOME.hero.heading).toBe("Can't agree where to go next? Let the draw decide.");
    expect(HOME.how.steps).toHaveLength(4);
    expect(HOME.features.draw.title).toBe("The draw");
  });

  it("drop empty entries rather than breaking", () => {
    const h = readHome({ hero: { perks: ["", "Free"] }, how: { steps: [{ title: "" }, { title: "One" }] } });
    expect(h.hero.perks).toEqual(["Free"]);
    expect(h.how.steps.map((s) => s.title)).toEqual(["One"]);
    expect(h.features.been).toEqual({ title: "", text: "" });
  });
});

describe("announcement banner", () => {
  it("only shows when switched on and written", () => {
    expect(readBanner({ show: false, text: "Hi" })).toBeNull();
    expect(readBanner({ show: true, text: " " })).toBeNull();
    expect(readBanner({ show: true, text: "Hi", style: "odd" })?.style).toBe("news");
  });

  it("only links to web addresses and the site's own pages", () => {
    expect(readBanner({ show: true, text: "Hi", link_url: "/destinations" })?.link_url).toBe("/destinations");
    expect(readBanner({ show: true, text: "Hi", link_url: "https://example.com" })?.link_url).toBe("https://example.com");
    expect(readBanner({ show: true, text: "Hi", link_url: "javascript:alert(1)" })?.link_url).toBe("");
  });

  it("hides itself after its last day", () => {
    const b = readBanner({ show: true, text: "Sale", ends: "2026-10-20" })!;
    expect(bannerEnded(b, new Date(2026, 9, 20, 23, 0))).toBe(false);
    expect(bannerEnded(b, new Date(2026, 9, 21, 0, 1))).toBe(true);
    expect(bannerEnded({ ...b, ends: "" }, new Date(2030, 0, 1))).toBe(false);
  });

  it("is remembered as closed only until its words change", () => {
    const b = readBanner({ show: true, text: "One" })!;
    expect(bannerKey(b)).toBe(bannerKey({ ...b }));
    expect(bannerKey(b)).not.toBe(bannerKey({ ...b, text: "Two" }));
  });
});
