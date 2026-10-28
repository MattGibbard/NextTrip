import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AIRPORTS, airportMeta, findAirport, readAirport } from "../src/airportPages";
import { AIRPORT_CARDS, airportGuide } from "../src/airports";
import { POSTS } from "../src/blog";
import { DESTINATIONS } from "../src/destinations";
import { HUBS } from "../src/hubs";
import { mainAirport } from "../shared/mainAirports";
import { publicPage } from "../shared/seo";

const dir = new URL("../content/airports/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const pages = new Set([
  "/",
  "/airports",
  "/blog",
  ...DESTINATIONS.map((d) => `/destinations/${d.slug}`),
  ...HUBS.map((h) => `/destinations/${h.slug}`),
  ...POSTS.map((p) => `/blog/${p.slug}`),
  ...AIRPORTS.map((a) => `/airports/${a.slug}`),
]);

describe("airport guide files", () => {
  it.each(files)("%s is a usable airport guide", (file) => {
    const slug = file.replace(/\.json$/, "");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    const a = readAirport(slug, raw);
    expect(mainAirport(a.code), `${a.code} is one of the airports visitors can fly from`).toBeDefined();
    expect(a.intro).not.toBe("");
    expect(a.terminals.length).toBeGreaterThan(0);
    // Links in its writing go to real pages.
    for (const [, href] of [...a.terminals.map((t) => t.text), ...a.sections.map((s) => s.text), ...a.faqs.map((f) => f.answer)].join("\n").matchAll(/\]\((\/[^)\s#]*)/g)) {
      expect(pages.has(href), `${slug} links to ${href}, which isn't a page`).toBe(true);
    }
    if (raw.published) {
      expect(findAirport(slug)).toBeDefined();
      expect(publicPage(`/airports/${slug}`)).toBe(`airport:${slug}`);
    }
  });

  it("gives each airport one guide at most", () => {
    const codes = AIRPORTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(AIRPORT_CARDS.map((a) => a.slug)).toEqual(AIRPORTS.map((a) => a.slug));
  });
});

describe("airport pages", () => {
  it("lists the blog posts about the airport, direct flights first, and the places they link to", () => {
    const man = findAirport("manchester")!;
    const posts = POSTS.filter((p) => man.posts.some((x) => x.slug === p.slug));
    expect(posts.length).toBe(man.posts.length);
    expect(man.posts[0].slug).toMatch(/direct/);
    expect(man.posts.some((p) => p.slug.startsWith("how-early"))).toBe(true);
    expect(man.places.length).toBeGreaterThan(0);
    for (const p of man.places) expect(DESTINATIONS.some((d) => d.slug === p.slug)).toBe(true);
  });

  it("finds an airport's guide by its code, for the boards on airport posts", () => {
    expect(airportGuide("man")).toMatchObject({ slug: "manchester", path: "/airports/manchester" });
    expect(airportGuide("XXX")).toBeUndefined();
  });

  it("gives each guide its own title, address and breadcrumbs", () => {
    const meta = airportMeta(findAirport("gatwick")!);
    expect(meta.path).toBe("/airports/gatwick");
    expect(meta.title).toContain("Gatwick Airport");
    expect(meta.index).toBe(true);
    expect(JSON.stringify(meta.jsonLd)).toContain('"iataCode":"LGW"');
  });

  it("reads the addresses", () => {
    expect(publicPage("/airports")).toBe("airports");
    expect(publicPage("/airports/")).toBe("airports");
    expect(publicPage("/airports/heathrow")).toBe("airport:heathrow");
  });

  it("fills gaps instead of failing on a half-written guide", () => {
    expect(readAirport("x", { code: "man", name: "Manchester Airport" })).toMatchObject({ code: "MAN", published: false, title: "Manchester Airport guide", terminals: [], posts: [], places: [] });
    expect(readAirport("x", { code: "Manchester" }).code).toBe("");
  });
});
