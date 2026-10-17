import { describe, expect, it } from "vitest";
import { REDIRECTS, cleanPath, readRedirects, redirectFor } from "../shared/redirects";
import { pages } from "../src/prerender";

// Every page the build writes, by address.
const LIVE = new Set(pages().map((p) => p.path));

describe("redirects", () => {
  it("tidies addresses from the editor", () => {
    expect(cleanPath("https://somewhere.party/blog/old/?x=1")).toBe("/blog/old");
    expect(cleanPath("blog/old")).toBe("/blog/old");
    expect(readRedirects({ redirects: [{ from: "", to: "/a" }, { from: "/a", to: "" }, { from: "/", to: "/blog" }, { from: "/a", to: "https://example.com/x" }] })).toEqual([
      { from: "/a", to: "https://example.com/x" },
    ]);
    expect(redirectFor("/blog/where-is-hot-at-christmas/")).toBe("/destinations/where-to-go-in-december");
    expect(redirectFor("/blog")).toBeNull();
  });

  it("each one lands on a page the site has", () => {
    for (const r of REDIRECTS) {
      if (/^https?:/.test(r.to)) continue;
      expect(LIVE.has(r.to), `${r.from} → ${r.to}: there's no page at ${r.to}`).toBe(true);
    }
  });

  // A redirect only applies once nothing is at the old address (worker/pages.ts), so one for a page that
  // comes back, like a later page of the blog, simply rests until the page goes again.
  it("lists each old address once, and doesn't go round in circles", () => {
    const froms = new Set<string>();
    for (const r of REDIRECTS) {
      expect(froms.has(r.from), `${r.from} is listed twice`).toBe(false);
      froms.add(r.from);
    }
    for (const r of REDIRECTS) expect(froms.has(r.to), `${r.from} → ${r.to}, which redirects again`).toBe(false);
  });
});
