import { describe, expect, it } from "vitest";
import { CREATORS, HOME, ONBOARDING, bannerEnded, bannerKey, readBanner, readCreators, readFeatured, readHome, readOnboarding } from "../src/site";

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

describe("creators page", () => {
  it("comes from the editor's file, terms included", () => {
    expect(CREATORS.hero.heading).toContain("get featured");
    expect(CREATORS.how.steps).toHaveLength(4);
    expect(CREATORS.terms.items.map((t) => t.title)).toContain("Using your name, photo and words");
  });

  it("keeps a button label when the editor empties it", () => {
    expect(readCreators({}).hero.button).toBe("Message us on Instagram");
    expect(readCreators({ terms: { items: [{ title: "Only a title" }] } }).terms.items).toEqual([]);
  });
});

describe("featured creators", () => {
  it("shows nobody until someone is added", () => {
    expect(readFeatured({ creators: [] }).creators).toEqual([]);
  });

  it("needs a name and a real handle, and leaves out anyone switched off", () => {
    const f = readFeatured({
      creators: [
        { name: "Sam", handle: "@sam.travels" },
        { name: "Off", handle: "off", show: false },
        { name: "", handle: "noname" },
        { name: "Bad", handle: "not a handle" },
      ],
    });
    expect(f.creators).toEqual([{ name: "Sam", handle: "sam.travels", url: "https://instagram.com/sam.travels", photo: "", quote: "" }]);
  });

  it("only links to https addresses and only shows photos uploaded to the site", () => {
    const [c] = readFeatured({
      creators: [{ name: "Sam", handle: "sam", url: "javascript:alert(1)", photo: "https://example.com/x.jpg" }],
    }).creators;
    expect(c.url).toBe("https://instagram.com/sam");
    expect(c.photo).toBe("");
    const [d] = readFeatured({ creators: [{ name: "Sam", handle: "sam", url: "https://instagram.com/p/abc", photo: "/images/creators/sam.webp" }] }).creators;
    expect(d.url).toBe("https://instagram.com/p/abc");
    expect(d.photo).toBe("/images/creators/sam.webp");
  });
});
