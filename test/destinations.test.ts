import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESTINATIONS, LONDON, bestMonths, countryFlag, destinationCountry, destinationMeta, findDestination, flightHoursTo, loadDestination, loadedDestination, flightTime, ideaFromDestination, readDestination, shortIntro } from "../src/destinations";
import geo from "../content/destinations-geo.json";
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
    if (raw.published) expect(d.lat, "run scripts/geocode-destinations.mjs").not.toBeNull();
    if (raw.published) expect(d.airport?.code, "To code should be an airport; run scripts/destination-airports.mjs").toBe(d.to_code);
    expect(d.months).toHaveLength(12);
    expect(publicPage(`/destinations/${slug}`)).toBe(`destination:${slug}`);
  });
});

describe("readDestination", () => {
  it("fills gaps instead of failing on a half-written guide", () => {
    const d = readDestination("somewhere", { name: "Somewhere", budget: 7, holiday_types: ["city", "moon"], months: { jan: { rating: "best", note: "Lovely" } } });
    expect(d.published).toBe(false);
    expect(d.title).toBe("Holidays in Somewhere");
    expect(d.budget).toBeNull();
    expect(d.holiday_types).toEqual(["city"]);
    expect(d.months[0]).toEqual({ code: "JAN", rating: "best", note: "Lovely" });
    expect(d.months[1].rating).toBe("quiet");
  });
});

describe("the editor's country list", () => {
  it("offers every country by the name the pages show", () => {
    const config = readFileSync(new URL("../public/admin/config.yml", import.meta.url), "utf8");
    const options = [...config.matchAll(/- \{ label: "([^"]+)", value: ([A-Z]{2}) \}/g)];
    expect(options.length).toBeGreaterThan(240);
    for (const [, label, code] of options) expect(label).toBe(destinationCountry(code));
  });
});

describe("bestMonths", () => {
  const guide = (best: string[]) =>
    readDestination("x", { name: "X", months: Object.fromEntries(best.map((m) => [m, { rating: "best" }])) });

  it("joins runs of best months", () => {
    expect(bestMonths(guide(["apr", "may", "jun", "sep", "oct"]))).toBe("Apr–Jun, Sep–Oct");
    expect(bestMonths(guide(["jul"]))).toBe("Jul");
  });

  it("keeps a run over new year together", () => {
    expect(bestMonths(guide(["nov", "dec", "jan", "feb", "jun"]))).toBe("Jun, Nov–Feb");
  });

  it("says so when nothing or everything is best", () => {
    expect(bestMonths(guide([]))).toBe("");
    expect(bestMonths(guide(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]))).toBe("All year");
  });
});

describe("guide cards", () => {
  it("carry what the list of guides needs but not each guide's full text", () => {
    const card = findDestination("new-york")! as unknown as Record<string, unknown>;
    expect(card.name).toBe("New York");
    expect(card.things).toEqual([]);
    expect(card.faqs).toEqual([]);
    expect(findDestination("new-york")!.months.every((m) => !m.note)).toBe(true);
  });

  it("load the full guide when asked, and only for published guides", async () => {
    const ny = await loadDestination("new-york");
    expect(ny?.things.length).toBeGreaterThan(0);
    expect(ny?.months.some((m) => m.note)).toBe(true);
    expect(loadedDestination("new-york")).toBe(ny);
    expect(await loadDestination("nowhere")).toBeUndefined();
  });
});

describe("New York", () => {
  const ny = findDestination("new-york")!;

  it("is published", () => {
    expect(DESTINATIONS.map((d) => d.slug)).toContain("new-york");
  });

  it("finds its country, map position, flight time and best months by itself", () => {
    expect(ny.country).toBe("United States");
    expect(ny.country_code).toBe("US");
    expect(ny.lat).toBeCloseTo(40.71, 1);
    expect(flightTime(LONDON, ny)).toBe("About 8 hrs");
    expect(bestMonths(ny)).toBe("Apr–Jun, Sep–Oct");
  });

  it("forgets its old map position when the place changes", () => {
    const moved = readDestination("new-york", { name: "York", country: "GB", published: true }, geo);
    expect(moved.lat).toBeNull();
  });

  it("fills in a new idea", () => {
    const idea = ideaFromDestination(ny);
    expect(idea.title).toBe("New York");
    expect(idea.places?.[0]).toMatchObject({ name: "New York", country_code: "US" });
    expect(idea.holiday_types).toEqual(["city"]);
    expect(idea.budget).toBe(3);
    expect(idea.arrive).toMatchObject({ kind: "airport", code: "JFK", country_code: "US" });
  });

  it("gives search engines a canonical address and question-and-answer data", async () => {
    const tags = metaTags(destinationMeta((await loadDestination("new-york"))!));
    expect(tags).toContain('<link rel="canonical" href="https://somewhere.party/destinations/new-york" />');
    expect(tags).toContain('"@type":"FAQPage"');
    expect(tags).toContain('"@type":"TouristDestination"');
    expect(tags).not.toContain("noindex");
  });

  it("gives search results a title that suits anyone, unless the editor wrote one", () => {
    expect(destinationMeta(readDestination("x", { name: "Lisbon" })).title).toBe("Lisbon holiday guide: when to go and what to do | somewhere🎉");
    const own = readDestination("x", { name: "Lisbon", intro: "Hills and trams.", seo_title: "Lisbon city breaks", seo_description: "Seven hills." });
    expect(destinationMeta(own)).toMatchObject({ title: "Lisbon city breaks | somewhere🎉", description: "Seven hills." });
    expect(destinationMeta(readDestination("x", { name: "Lisbon", intro: "Hills and trams." })).description).toBe("Hills and trams.");
  });

  it("says when the guide last changed, when the build knows", () => {
    expect(metaTags(destinationMeta(ny, "2026-10-08"))).toContain('"dateModified":"2026-10-08"');
    expect(metaTags(destinationMeta(ny))).not.toContain("dateModified");
  });
});

describe("the list of all guides", () => {
  it("shows a flag for a country code", () => {
    expect(countryFlag("US")).toBe("🇺🇸");
    expect(countryFlag("")).toBe("");
  });

  it("uses the first sentence of the introduction on a guide's card", () => {
    const d = readDestination("x", { name: "X", intro: "Huge parks and pretzels. Here's what it's like." });
    expect(shortIntro(d)).toBe("Huge parks and pretzels.");
    expect(shortIntro(readDestination("y", { name: "Y", intro: "No full stop" }))).toBe("No full stop");
  });

  it("gives the flight in whole hours, the same as the guide", () => {
    const ny = findDestination("new-york")!;
    expect(flightHoursTo(LONDON, ny)).toBe(8);
    expect(flightTime(LONDON, ny)).toBe("About 8 hrs");
  });
});
