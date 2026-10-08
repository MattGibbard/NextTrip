import { describe, expect, it } from "vitest";
import { HOME, ONBOARDING, bannerEnded, bannerKey, readBanner, readHome, readOnboarding } from "../src/site";

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

describe("welcome steps' words", () => {
  it("come from the editor's file", () => {
    expect(ONBOARDING.welcome.heading).toBe("Find your next holiday, together");
    expect(ONBOARDING.welcome.steps).toHaveLength(3);
    expect(ONBOARDING.done.invite_heading).toBe("Invite your family");
  });

  it("keep the original words for anything left empty", () => {
    const o = readOnboarding({ welcome: { heading: "Hello", lead: "  ", steps: [{ title: "" }] }, idea: { button: "Add it" } });
    expect(o.welcome.heading).toBe("Hello");
    expect(o.welcome.lead).toBe(ONBOARDING.welcome.lead);
    expect(o.welcome.steps).toEqual(ONBOARDING.welcome.steps);
    expect(o.idea.button).toBe("Add it");
    expect(o.airport.skip).toBe("We don't fly. Skip this");
  });
});
