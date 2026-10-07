import { describe, expect, it } from "vitest";
import { cleanCredit, mixPhotos, parseCommons, parseCredit, parseUnsplash, photoQueries, stripHtml } from "../shared/photos";
import type { PhotoSuggestion } from "../shared/photos";

const place = (name: string, country = "Portugal") => ({ name, country, country_code: "PT", lat: 0, lon: 0 });

describe("photoQueries", () => {
  it("looks up the first three places, once each", () => {
    expect(photoQueries([place("Lisbon"), place("Porto"), place("Lisbon"), place("Faro"), place("Lagos")])).toEqual(["Lisbon Portugal", "Porto Portugal", "Faro Portugal"]);
  });
  it("doesn't repeat a country named after itself", () => {
    expect(photoQueries([place("Singapore", "Singapore")])).toEqual(["Singapore"]);
  });
});

describe("parseUnsplash", () => {
  it("keeps the photo, a thumbnail and who took it", () => {
    const data = {
      results: [
        {
          alt_description: "yellow tram on a hill",
          urls: { regular: "https://images.unsplash.com/photo-1?w=1080", small: "https://images.unsplash.com/photo-1?w=400" },
          links: { download_location: "https://api.unsplash.com/photos/abc/download?ixid=1" },
          user: { name: "Jane Doe", links: { html: "https://unsplash.com/@jane" } },
        },
        { urls: { regular: "http://insecure" }, user: { name: "X" } },
        { urls: { regular: "https://images.unsplash.com/photo-2" } },
      ],
    };
    expect(parseUnsplash(data)).toEqual([
      {
        url: "https://images.unsplash.com/photo-1?w=1080",
        thumb: "https://images.unsplash.com/photo-1?w=400",
        alt: "yellow tram on a hill",
        credit: { name: "Jane Doe", url: "https://unsplash.com/@jane?utm_source=nexttrip&utm_medium=referral", source: "Unsplash", license: null },
        download: "https://api.unsplash.com/photos/abc/download?ixid=1",
      },
    ]);
  });
  it("copes with an error response", () => {
    expect(parseUnsplash({ errors: ["Rate Limit Exceeded"] })).toEqual([]);
    expect(parseUnsplash(null)).toEqual([]);
  });
});

describe("parseCommons", () => {
  const page = (index: number, title: string, info: Record<string, unknown>) => ({
    index,
    title,
    imageinfo: [
      {
        thumburl: `https://upload.wikimedia.org/thumb/a/ab/${index}.jpg/1280px-${index}.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
        width: 4000,
        height: 3000,
        mime: "image/jpeg",
        extmetadata: { Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Bob">Bob &amp; Sue</a>' }, LicenseShortName: { value: "CC BY-SA 4.0" } },
        ...info,
      },
    ],
  });

  it("keeps big landscape photos in search order, with credit and licence", () => {
    const data = {
      query: {
        pages: [
          page(2, "File:Porto bridge.jpg", {}),
          page(1, "File:Lisbon at dusk.jpg", {}),
          page(3, "File:Portrait.jpg", { width: 2000, height: 3000 }),
          page(4, "File:Tiny.jpg", { width: 640, height: 480 }),
          page(5, "File:Map.png", { mime: "image/png" }),
        ],
      },
    };
    const out = parseCommons(data);
    expect(out.map((p) => p.alt)).toEqual(["Lisbon at dusk", "Porto bridge"]);
    expect(out[0]).toEqual({
      url: "https://upload.wikimedia.org/thumb/a/ab/1.jpg/1280px-1.jpg",
      thumb: "https://upload.wikimedia.org/thumb/a/ab/1.jpg/500px-1.jpg",
      alt: "Lisbon at dusk",
      credit: { name: "Bob & Sue", url: "https://commons.wikimedia.org/wiki/File:Lisbon at dusk.jpg", source: "Wikimedia Commons", license: "CC BY-SA 4.0" },
      download: null,
    });
  });
  it("copes with no results", () => {
    expect(parseCommons({ batchcomplete: true })).toEqual([]);
  });
});

it("strips HTML from credits", () => {
  expect(stripHtml('<span class="x">Photo by <b>Ana</b>&nbsp;Lopes</span>')).toBe("Photo by Ana Lopes");
});

describe("mixPhotos", () => {
  const p = (url: string) => ({ url }) as PhotoSuggestion;
  it("takes turns between places and skips repeats", () => {
    const out = mixPhotos([[p("a1"), p("a2"), p("a3"), p("a4")], [p("b1"), p("a2")], [p("c1")]], 6);
    expect(out.map((x) => x.url)).toEqual(["a1", "b1", "c1", "a2", "a3", "a4"]);
  });
  it("stops at the count", () => {
    expect(mixPhotos([[p("a"), p("b"), p("c")]], 2)).toHaveLength(2);
  });
});

describe("cleanCredit", () => {
  it("keeps a good credit and drops anything odd", () => {
    expect(cleanCredit({ name: " Jane ", url: "javascript:alert(1)", source: "Unsplash", license: "", extra: 1 })).toEqual({ name: "Jane", url: null, source: "Unsplash", license: null });
    expect(cleanCredit({ name: "Jane", source: "Flickr" })).toBeNull();
    expect(cleanCredit("Jane")).toBeNull();
  });
  it("reads a saved credit back", () => {
    expect(parseCredit('{"name":"Bob","url":"https://commons.wikimedia.org/x","source":"Wikimedia Commons","license":"CC0"}')).toEqual({
      name: "Bob",
      url: "https://commons.wikimedia.org/x",
      source: "Wikimedia Commons",
      license: "CC0",
    });
    expect(parseCredit("not json")).toBeNull();
    expect(parseCredit(null)).toBeNull();
  });
});
