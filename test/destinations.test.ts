import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESTINATIONS, destinationMeta, findDestination, ideaFromDestination, readDestination } from "../src/destinations";
import { metaTags, publicPage } from "../shared/seo";

const dir = new URL("../content/destinations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("destination guide files", () => {
  it.each(files)("%s is a usable guide", (file) => {
    const slug = file.replace(/\.json$/, "");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    const d = readDestination(slug, raw);
    expect(d.name).not.toBe(slug);
    expect(d.country_code).toMatch(/^[A-Z]{2}$/);
    expect(d.seo_description.length).toBeLessThanOrEqual(160);
    expect(d.months).toHaveLength(12);
    expect(publicPage(`/destinations/${slug}`)).toBe(`destination:${slug}`);
  });
});

describe("readDestination", () => {
  it("fills gaps instead of failing on a half-written guide", () => {
    const d = readDestination("somewhere", { name: "Somewhere", budget: 7, holiday_types: ["city", "moon"], months: { jan: { rating: "best", note: "Lovely" } } });
    expect(d.published).toBe(false);
    expect(d.title).toBe("Family holidays in Somewhere");
    expect(d.budget).toBeNull();
    expect(d.holiday_types).toEqual(["city"]);
    expect(d.months[0]).toEqual({ code: "JAN", rating: "best", note: "Lovely" });
    expect(d.months[1].rating).toBe("quiet");
  });
});

describe("New York", () => {
  const ny = findDestination("new-york")!;

  it("is published", () => {
    expect(DESTINATIONS.map((d) => d.slug)).toContain("new-york");
  });

  it("fills in a new idea", () => {
    const idea = ideaFromDestination(ny);
    expect(idea.title).toBe("New York");
    expect(idea.places?.[0]).toMatchObject({ name: "New York", country_code: "US" });
    expect(idea.holiday_types).toEqual(["city"]);
    expect(idea.budget).toBe(3);
  });

  it("gives search engines a canonical address and question-and-answer data", () => {
    const tags = metaTags(destinationMeta(ny));
    expect(tags).toContain('<link rel="canonical" href="https://somewhere.party/destinations/new-york" />');
    expect(tags).toContain('"@type":"FAQPage"');
    expect(tags).toContain('"@type":"TouristDestination"');
    expect(tags).not.toContain("noindex");
  });
});
