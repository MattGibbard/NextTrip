import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HUBS, alsoGood, countryHub, findHub, hubGuides, hubMeta, hubSearchTitle, loadHub, monthHub, readHub, typeHub } from "../src/hubs";
import { DESTINATIONS, destinationMeta, findDestination, readDestination } from "../src/destinations";
import { publicPage } from "../shared/seo";

const dir = new URL("../content/hubs/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const posts = readdirSync(new URL("../content/blog/", import.meta.url)).filter((f) => f.endsWith(".json"));
const pages = new Set(["/", "/destinations", "/blog", "/how-to-decide-where-to-go-on-holiday", ...DESTINATIONS.map((d) => `/destinations/${d.slug}`), ...HUBS.map((h) => `/destinations/${h.slug}`), ...posts.map((f) => `/blog/${f.replace(/\.json$/, "")}`)]);

describe("hub files", () => {
  it.each(files)("%s is a usable hub", (file) => {
    const slug = file.replace(/\.json$/, "");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(findDestination(slug), "a hub can't share a guide's address").toBeUndefined();
    const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    const h = readHub(slug, raw);
    if (h.kind === "type") expect(h.holiday_type).not.toBeNull();
    else if (h.kind === "month") expect(h.month).not.toBeNull();
    else if (h.kind === "collection") {
      expect(h.guides.length).toBeGreaterThan(0);
      for (const g of h.guides) expect(findDestination(g), `${g} is a published guide`).toBeDefined();
    }
    else expect(h.country_code).toMatch(/^[A-Z]{2}$/);
    expect(h.intro).not.toBe("");
    // Links in its writing and answers go to real pages, and never back to the hub itself.
    for (const [, href] of [...h.sections.map((x) => x.text), ...h.faqs.map((f) => f.answer)].join("\n").matchAll(/\]\((\/[^)\s#]*)/g)) {
      expect(pages.has(href), `${slug} links to ${href}, which isn't a page`).toBe(true);
      expect(href, `${slug} links to itself`).not.toBe(`/destinations/${slug}`);
    }
    if (raw.published) {
      expect(findHub(slug), "published hubs need at least one guide").toBeDefined();
      expect(publicPage(`/destinations/${slug}`)).toBe(`destination:${slug}`);
    }
  });

  it("gives each kind of holiday and country one hub at most", () => {
    const keys = HUBS.filter((h) => h.kind !== "collection").map((h) => `${h.kind}:${h.holiday_type ?? h.month ?? h.country_code}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("readHub", () => {
  it("fills gaps instead of failing on a half-written hub", () => {
    const type = readHub("beach", { holiday_type: "beach" });
    expect(type).toMatchObject({ kind: "type", holiday_type: "beach", name: "Beach holidays", title: "Beach holidays", published: false, faqs: [] });
    const country = readHub("spain", { kind: "country", country: "es", holiday_type: "beach" });
    expect(country).toMatchObject({ kind: "country", country_code: "ES", holiday_type: null, name: "Spain", title: "Holidays in Spain" });
    expect(readHub("x", { holiday_type: "moon" }).holiday_type).toBeNull();
    const month = readHub("feb", { kind: "month", month: "feb", holiday_type: "beach" });
    expect(month).toMatchObject({ kind: "month", month: 1, holiday_type: null, country_code: "", name: "February", title: "Where to go on holiday in February" });
    expect(readHub("x", { kind: "month", month: "smarch" }).month).toBeNull();
    const xmas = readHub("christmas", { kind: "collection", guides: ["vienna", " vienna", "prague"], icon: "🎄", month: "dec" });
    expect(xmas).toMatchObject({ kind: "collection", guides: ["vienna", "prague"], icon: "🎄", month: 11, name: "christmas" });
    expect(readHub("beach", { holiday_type: "beach", guides: ["vienna"] }).guides).toEqual([]);
  });
});

describe("hub pages", () => {
  it("list the guides that fit, A to Z", () => {
    const beach = typeHub("beach")!;
    const guides = hubGuides(beach);
    expect(guides.length).toBeGreaterThan(0);
    expect(guides.every((d) => d.holiday_types.includes("beach"))).toBe(true);
    expect(guides).toEqual(DESTINATIONS.filter((d) => d.holiday_types.includes("beach")));
    expect(hubGuides(countryHub("ES")!).every((d) => d.country_code === "ES")).toBe(true);
  });

  it("put kinds of holiday first, then months in order, then countries", () => {
    const kinds = HUBS.map((h) => h.kind);
    expect(kinds.indexOf("month")).toBeGreaterThan(kinds.lastIndexOf("type"));
    expect(kinds.indexOf("country")).toBeGreaterThan(kinds.lastIndexOf("month"));
    if (kinds.includes("collection")) expect(kinds.indexOf("collection")).toBeGreaterThan(kinds.lastIndexOf("month"));
    const months = HUBS.filter((h) => h.kind === "month").map((h) => h.month);
    expect(months).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it("list a month's best guides, then its good ones, picking up new guides by themselves", () => {
    const feb = monthHub(1)!;
    expect(feb.slug).toBe("where-to-go-in-february");
    const best = hubGuides(feb);
    expect(best.length).toBeGreaterThan(0);
    expect(best).toEqual(DESTINATIONS.filter((d) => d.months[1].rating === "best"));
    const good = alsoGood(feb);
    expect(good).toEqual(DESTINATIONS.filter((d) => d.months[1].rating === "good"));
    expect(good.some((d) => best.includes(d))).toBe(false);
    expect(alsoGood(typeHub("beach")!)).toEqual([]);
    const xmas = findHub("christmas-holidays")!;
    expect(hubGuides(xmas)).toEqual(DESTINATIONS.filter((d) => xmas.guides.includes(d.slug)));
    expect(alsoGood(xmas)).toEqual([]);
    expect(hubSearchTitle(readHub("may", { kind: "month", month: "may" }))).toBe("Where to go on holiday in May | somewhere🎉");
  });

  it("tell search engines what they list", async () => {
    const hub = (await loadHub("beach-holidays"))!;
    const meta = hubMeta(hub, "2026-10-11");
    expect(meta.path).toBe("/destinations/beach-holidays");
    expect(meta.title).toBe(hubSearchTitle(hub));
    expect(meta.title).toContain("where to go and when");
    const [page, crumbs, faq] = meta.jsonLd as Record<string, any>[];
    expect(page["@type"]).toBe("CollectionPage");
    expect(page.dateModified).toBe("2026-10-11");
    expect(page.mainEntity.numberOfItems).toBe(hubGuides(hub).length);
    expect(page.mainEntity.itemListElement[0].url).toMatch(/^https:\/\/somewhere\.party\/destinations\//);
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Home", "Destinations", "Beach holidays"]);
    expect(faq["@type"]).toBe("FAQPage");
  });
});

describe("a guide in a country with a hub", () => {
  it("goes through the country in its breadcrumb", () => {
    const spain = countryHub("ES")!;
    const d = readDestination("valencia", JSON.parse(readFileSync(new URL("../content/destinations/valencia.json", import.meta.url), "utf8")));
    const crumbs = (destinationMeta(d, { country: spain }).jsonLd as Record<string, any>[])[2];
    expect(crumbs.itemListElement.map((i: { name: string; position: number }) => [i.position, i.name])).toEqual([
      [1, "Home"],
      [2, "Destinations"],
      [3, "Spain"],
      [4, "Valencia"],
    ]);
  });
});

describe("where's hot on month pages", () => {
  it("lists the warmest places that are good that month, near and far, warmest first", async () => {
    const { HUBS, hotList, NEAR_HOURS } = await import("../src/hubs");
    const { LONDON } = await import("../src/destinations");
    const nov = HUBS.find((h) => h.kind === "month" && h.month === 10)!;
    const { near, far } = hotList(nov, LONDON);
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    for (const rows of [near, far]) {
      expect(rows.map((r) => r.temp)).toEqual([...rows.map((r) => r.temp)].sort((a, b) => b - a));
      for (const r of rows) expect(r.d.months[10].rating).not.toBe("quiet");
    }
    for (const r of near) expect(r.hours!).toBeLessThanOrEqual(NEAR_HOURS);
  });

  it("is empty for hubs that aren't about a month", async () => {
    const { HUBS, hotList } = await import("../src/hubs");
    const { LONDON } = await import("../src/destinations");
    const spain = HUBS.find((h) => h.slug === "holidays-in-spain")!;
    expect(hotList(spain, LONDON)).toEqual({ near: [], far: [] });
  });
});
