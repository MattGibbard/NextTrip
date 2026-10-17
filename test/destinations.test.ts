import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESTINATIONS, LONDON, bestMonths, countryFlag, destinationCountry, destinationMeta, findDestination, flightHoursTo, loadDestination, loadedDestination, flightTime, photoProps, ideaFromDestination, readDestination, shortIntro } from "../src/destinations";
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
    // When it was added and last changed, for the editor's list (public/admin/config.yml). UTC, to the second.
    const when = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    expect(raw.date, "set date to when the guide was added, e.g. 2026-10-16T06:42:00Z").toMatch(when);
    expect(raw.updated, "set updated to when the guide was last changed (the same as date for a new guide)").toMatch(when);
    expect(raw.updated >= raw.date).toBe(true);
  });
});

describe("readDestination", () => {
  it("fills gaps instead of failing on a half-written guide", () => {
    const d = readDestination("somewhere", { name: "Somewhere", budget: 7, holiday_types: ["city", "moon"], months: { jan: { rating: "best", note: "Lovely", temp: 21.6 } } });
    expect(d.published).toBe(false);
    expect(d.title).toBe("Holidays in Somewhere");
    expect(d.budget).toBeNull();
    expect(d.holiday_types).toEqual(["city"]);
    expect(d.months[0]).toEqual({ code: "JAN", rating: "best", note: "Lovely", temp: 22 });
    expect(d.months[1].temp).toBeNull();
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
    expect(destinationMeta(readDestination("x", { name: "Lisbon" })).title).toBe("Lisbon holidays: best time to go and things to do | somewhere🎉");
    const own = readDestination("x", { name: "Lisbon", intro: "Hills and trams.", seo_title: "Lisbon city breaks", seo_description: "Seven hills." });
    expect(destinationMeta(own)).toMatchObject({ title: "Lisbon city breaks | somewhere🎉", description: "Seven hills." });
    expect(destinationMeta(readDestination("x", { name: "Lisbon", intro: "Hills and trams." })).description).toBe("Hills and trams.");
  });

  it("says when the guide was published and last changed, when the build knows", () => {
    const tags = metaTags(destinationMeta(ny, { updated: "2026-10-08", published: "2026-10-01" }));
    expect(tags).toContain('"dateModified":"2026-10-08"');
    expect(tags).toContain('"datePublished":"2026-10-01"');
    expect(tags).toContain('<meta property="article:modified_time" content="2026-10-08" />');
    expect(metaTags(destinationMeta(ny))).not.toContain("dateModified");
  });

  it("marks the guide up as an article by the site, about the place", async () => {
    const d = (await loadDestination("new-york"))!;
    const meta = destinationMeta(d);
    const [place, article, crumbs] = meta.jsonLd as Record<string, any>[];
    expect(place.sameAs).toEqual(["https://en.wikipedia.org/wiki/New_York_City"]);
    expect(article).toMatchObject({ "@type": "Article", headline: "Holidays in New York", about: { "@id": place["@id"] } });
    expect(article.author.name).toBe("somewhere🎉");
    expect(article.image).toMatchObject({ url: place.image, width: d.image_size![0], height: d.image_size![1] });
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Home", "Destinations", "New York"]);
    const tags = metaTags(meta);
    expect(tags).toContain('<meta property="og:type" content="article" />');
    expect(tags).toContain(`<meta property="og:image:width" content="${d.image_size![0]}" />`);
  });

  it("only takes a Wikipedia address as its Wikipedia page", () => {
    expect(readDestination("x", { name: "X", wikipedia: "https://en.wikipedia.org/wiki/Lisbon" }).wikipedia).toBe("https://en.wikipedia.org/wiki/Lisbon");
    expect(readDestination("x", { name: "X", wikipedia: "https://example.com/wiki/Lisbon" }).wikipedia).toBe("");
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

describe("photoProps", () => {
  it("offers the smaller copies the build makes, up to the photo's own width", () => {
    expect(photoProps("/images/destinations/a_1280.webp", [1280, 854], "100vw")).toEqual({
      src: "/images/destinations/a_1280.webp",
      srcSet: "/images/sized/480/a_1280.webp 480w, /images/sized/800/a_1280.webp 800w, /images/destinations/a_1280.webp 1280w",
      sizes: "100vw",
    });
    expect(photoProps("images/destinations/b.jpg", [600, 400], "100vw").srcSet).toBe("/images/sized/480/b.webp 480w, /images/destinations/b.jpg 600w");
  });

  it("uses other photos as they are", () => {
    expect(photoProps("https://example.com/x.jpg", [1280, 854], "100vw")).toEqual({ src: "https://example.com/x.jpg" });
    expect(photoProps("/images/destinations/a.webp", null, "100vw")).toEqual({ src: "https://somewhere.party/images/destinations/a.webp" });
  });
});

describe("guide temperatures", () => {
  it("gives every published guide a daytime high for every month", () => {
    for (const d of DESTINATIONS) {
      for (const m of d.months) {
        expect(m.temp, `${d.slug} ${m.code}`).not.toBeNull();
        expect(m.temp!, `${d.slug} ${m.code}`).toBeGreaterThanOrEqual(-30);
        expect(m.temp!, `${d.slug} ${m.code}`).toBeLessThanOrEqual(50);
      }
    }
  });
});
