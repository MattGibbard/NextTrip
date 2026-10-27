import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTHORS, PAGE_SIZE, POSTS, findPost, listing, listingMeta, listingPath, listings, loadPost, postDate, postMeta, postTitle, postsAboutGuide, postsAboutHub, postsTagged, readPost, relatedPosts, sectionPhotos, usedTags } from "../src/blog";
import { calloutOf, tableRows } from "../src/views/InfoPage";
import { BLOG_TAGS, TAG_INDEX_MIN, isBlogTag } from "../src/blogTags";
import { feedXml } from "../src/feed";
import { publicPage } from "../shared/seo";
import { DESTINATIONS } from "../src/destinations";
import { HUBS } from "../src/hubs";
import { bestMonths } from "../src/months";
import { mainAirport } from "../shared/mainAirports";
import { postBoxes } from "../src/components/PostBoxes";

const dir = new URL("../content/blog/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

/** Every address a post links to on the site itself. */
function links(text: string): string[] {
  return [...text.matchAll(/\]\((\/[^)\s#]*)/g)].map((m) => m[1]);
}

const pages = new Set(["/", "/destinations", "/blog", "/how-to-decide-where-to-go-on-holiday", ...DESTINATIONS.map((d) => `/destinations/${d.slug}`), ...HUBS.map((h) => `/destinations/${h.slug}`), ...files.map((f) => `/blog/${f.replace(/\.json$/, "")}`)]);

describe("blog files", () => {
  it.each(files)("%s is a usable post", (file) => {
    const slug = file.replace(/\.json$/, "");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    const p = readPost(slug, JSON.parse(readFileSync(new URL(file, dir), "utf8")));
    expect(p.title).not.toBe(slug);
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.intro).not.toBe("");
    expect(p.sections.length).toBeGreaterThan(0);
    if (p.published) expect(publicPage(`/blog/${slug}`)).toBe(`post:${slug}`);
    const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    expect(AUTHORS, `${slug} needs an author`).toContain(raw.author);
    expect(raw.tags?.length, `${slug} needs at least one tag`).toBeGreaterThan(0);
    for (const t of raw.tags) expect(isBlogTag(t), `${slug} has an unknown tag ${t}`).toBe(true);
    for (const href of links([...p.sections.map((s) => s.text), ...p.faqs.map((f) => f.answer)].join("\n"))) {
      expect(pages.has(href), `${slug} links to ${href}, which isn't a page`).toBe(true);
    }
  });
});

describe("readPost", () => {
  it("fills gaps instead of failing on a half-written post", () => {
    const p = readPost("x", { title: " Hello ", date: "2026-10-12T00:00:00Z", sections: [{ heading: "", text: "" }, { text: "Hi" }, "nope"], faqs: [{ question: "Q?" }] });
    expect(p).toMatchObject({ published: false, title: "Hello", date: "2026-10-12", sections: [{ heading: "", text: "Hi" }], faqs: [] });
    expect(readPost("x", { date: "soon" }).date).toBe("");
  });
});

describe("the blog", () => {
  it("lists published posts, newest first", () => {
    expect(POSTS.length).toBeGreaterThan(0);
    expect(POSTS.every((p) => p.published)).toBe(true);
    const dates = POSTS.map((p) => p.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(publicPage("/blog")).toBe("blog");
    expect(publicPage("/blog/")).toBe("blog");
  });

  it("tells search engines about each post", async () => {
    const slug = POSTS[0].slug;
    const p = (await loadPost(slug))!;
    expect(findPost(slug)).toBeDefined();
    const meta = postMeta(p, "2099-01-01");
    expect(meta).toMatchObject({ path: `/blog/${slug}`, type: "article", title: postTitle(p), published: p.date, updated: "2099-01-01" });
    const [article, crumbs] = meta.jsonLd as Record<string, any>[];
    expect(article["@type"]).toBe("BlogPosting");
    expect(article.datePublished).toBe(p.date);
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Home", "Blog", p.title]);
    // A date from before the post was published (an older file history) never goes backwards.
    expect(postMeta(p, "2000-01-01").updated).toBe(p.date);
    expect((listingMeta(listing("blog")!).jsonLd![0] as Record<string, any>).blogPost).toHaveLength(Math.min(PAGE_SIZE, POSTS.length));
  });

  it("writes dates out in full", () => {
    expect(postDate("2026-10-02")).toBe("2 October 2026");
    expect(postDate("")).toBe("");
  });
});

describe("tags", () => {
  it("offers the same tags in the editor as on the site", () => {
    const config = readFileSync(new URL("../public/admin/config.yml", import.meta.url), "utf8");
    const blog = config.slice(config.indexOf("  - name: blog"), config.indexOf("  - name: site"));
    const values = [...blog.matchAll(/\{ label: ([^,]+), value: ([a-z-]+) \}/g)].map((m) => [m[2], m[1]]);
    expect(Object.fromEntries(values)).toEqual(BLOG_TAGS);
  });

  it("gives each tag in use a page, kept out of search until it has a few posts", () => {
    const used = usedTags();
    expect(used.length).toBeGreaterThan(0);
    for (const { tag, count } of used) {
      expect(publicPage(`/blog/tag/${tag}`)).toBe(`tag:${tag}`);
      expect(postsTagged(tag)).toHaveLength(count);
      const meta = listingMeta(listing(`tag:${tag}`)!);
      expect(meta.index).toBe(count >= TAG_INDEX_MIN);
      expect(meta.path).toBe(`/blog/tag/${tag}`);
    }
  });
});

describe("links between posts and guides", () => {
  it("knows which guides each post links to, and picks a cover photo from one", () => {
    const lisbon = findPost("lisbon-or-porto")!;
    expect(lisbon.guides).toEqual(expect.arrayContaining(["lisbon", "porto"]));
    expect(lisbon.cover?.image).toMatch(/^\/images\/destinations\//);
    expect(postsAboutGuide("lisbon", POSTS.length)).toContainEqual(lisbon);
  });

  it("uses a post's own photo instead of a guide's when it has one", () => {
    const p = findPost("how-early-should-you-arrive-at-gatwick-airport")!;
    expect(p.cover).toMatchObject({ guide: "", image: expect.stringMatching(/^\/images\/blog\//), alt: expect.any(String), size: [expect.any(Number), expect.any(Number)] });
    expect(p.cover!.alt).not.toBe("");
  });

  it("only points own photos at files that are there", () => {
    for (const f of files) {
      const raw = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      if (raw.cover_image) expect(readdirSync(new URL("../public/images/blog/", import.meta.url)), f).toContain(raw.cover_image.replace("/images/blog/", ""));
    }
  });

  it("suggests related posts first, then the newest", () => {
    for (const p of POSTS) {
      const more = relatedPosts(p, 3);
      expect(more).toHaveLength(Math.min(3, POSTS.length - 1));
      expect(more).not.toContainEqual(p);
    }
  });

  it("lists posts on a hub that link to it or to two of its guides", () => {
    const p = POSTS.find((x) => x.guides.length >= 2)!;
    expect(postsAboutHub("anything", p.guides.slice(0, 2), 3)).toContainEqual(p);
    expect(postsAboutHub("anything", p.guides.slice(0, 1), 3).every((x) => x.guides.includes(p.guides[0]) || x.hubs.includes("anything"))).toBe(true);
  });
});

describe("the post page's data", () => {
  it("names the writer and uses the cover photo", async () => {
    const card = POSTS.find((p) => p.cover)!;
    const p = (await loadPost(card.slug))!;
    const [article] = postMeta(p).jsonLd as Record<string, any>[];
    expect(article.author).toEqual({ "@type": "Person", name: p.author });
    expect(article.image.url).toContain(card.cover!.image);
    expect(postMeta(p).image).toContain(card.cover!.image);
  });

  it("shows Updated only when it's later than the date", () => {
    expect(readPost("x", { date: "2026-10-12", updated: "2026-10-20" }).updated).toBe("2026-10-20");
    expect(readPost("x", { date: "2026-10-12", updated: "2026-10-01" }).updated).toBe("");
    expect(postMeta(readPost("x", { date: "2026-10-12", updated: "2026-10-20" }), "2026-10-15").updated).toBe("2026-10-20");
  });
});

describe("the feed", () => {
  it("lists the newest posts as RSS", () => {
    const xml = feedXml();
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain(`<link>https://somewhere.party/blog/${POSTS[0].slug}</link>`);
    expect(xml.match(/<item>/g)).toHaveLength(Math.min(50, POSTS.length));
    expect(publicPage("/blog/feed.xml")).toBeNull();
  });
});

describe("pages of posts", () => {
  it("splits the blog into pages with their own addresses", () => {
    const pages = Math.ceil(POSTS.length / PAGE_SIZE);
    const blog = listings().filter((l) => !l.tag);
    expect(blog).toHaveLength(pages);
    expect(blog.flatMap((l) => l.posts)).toEqual(POSTS);
    expect(blog.map((l) => l.id)).toEqual(["blog", ...Array.from({ length: pages - 1 }, (_, i) => `blog:${i + 2}`)]);
    for (const l of blog) {
      expect(l.posts.length).toBeLessThanOrEqual(PAGE_SIZE);
      expect(publicPage(listingPath(null, l.page))).toBe(l.id);
      expect(listingMeta(l).index).toBe(true);
    }
  });

  it("does the same for each tag", () => {
    for (const { tag, count } of usedTags()) {
      const pages = listings().filter((l) => l.tag === tag);
      expect(pages).toHaveLength(Math.ceil(count / PAGE_SIZE));
      expect(pages.flatMap((l) => l.posts)).toEqual(postsTagged(tag));
      for (const l of pages) expect(publicPage(listingPath(tag, l.page))).toBe(l.id);
    }
    expect(publicPage("/blog/tag/europe/page/2")).toBe("tag:europe:2");
    expect(listingPath("europe", 3)).toBe("/blog/tag/europe/page/3");
  });

  it("has no page 1 address, nothing past the last page and nothing for unused tags", () => {
    expect(publicPage("/blog/page/2")).toBe("blog:2");
    expect(listing("blog:1")).toBeNull();
    expect(listing("tag:europe:1")).toBeNull();
    expect(listing(`blog:${Math.ceil(POSTS.length / PAGE_SIZE) + 1}`)).toBeNull();
    expect(listing("tag:not-a-tag")).toBeNull();
    const unused = (Object.keys(BLOG_TAGS) as (keyof typeof BLOG_TAGS)[]).find((t) => postsTagged(t).length === 0);
    if (unused) expect(listing(`tag:${unused}`)).toBeNull();
  });

  it("names later pages in their titles", () => {
    expect(listingMeta({ tag: null, page: 2, pages: 3, posts: [], total: 30 }).title).toContain("page 2");
    expect(listingMeta({ tag: "europe", page: 2, pages: 2, posts: [], total: 20 }).title).toContain("page 2");
  });
});

describe("what comes after a post", () => {
  const options = [...readFileSync(new URL("../public/admin/config.yml", import.meta.url), "utf8").matchAll(/\{ label: "[^"]+ \(([A-Z]{3})\)", value: ([A-Z]{3}) \}/g)];

  it("knows each place it's about as its guide does", async () => {
    for (const card of POSTS) {
      const p = (await loadPost(card.slug))!;
      for (const place of p.places) {
        const d = DESTINATIONS.find((x) => x.slug === place.slug);
        expect(d, `${card.slug}: ${place.slug} isn't a published guide`).toBeDefined();
        expect({ ...place, best: bestMonths(place) }).toMatchObject({
          name: d!.name,
          country: d!.country,
          country_code: d!.country_code,
          lat: d!.lat,
          lon: d!.lon,
          to_code: d!.to_code,
          image: d!.image,
          image_size: d!.image_size,
          best: bestMonths(d!),
        });
      }
    }
  });

  it("starts with the place the cover photo comes from, then the guides it links to", async () => {
    const p = (await loadPost("seville-in-3-days"))!;
    expect(p.places[0].slug).toBe("seville");
    expect(p.places.map((x) => x.slug)).toEqual(expect.arrayContaining(p.guides.slice(0, 4)));
  });

  it("gives every airport post a departures board from its own airport", async () => {
    for (const card of POSTS.filter((c) => /^(how-early-should-you-arrive-at|where-can-you-fly-direct-from)-/.test(c.slug))) {
      const p = (await loadPost(card.slug))!;
      expect(mainAirport(p.airport), `${card.slug} needs its airport`).toBeDefined();
      expect(postBoxes(p).board).toBe("airport");
    }
  });

  it("offers the editor every main UK and Irish airport, and only those", () => {
    expect(options.length).toBeGreaterThan(10);
    for (const [, label, value] of options) {
      expect(label).toBe(value);
      expect(mainAirport(value)?.[2], value).toMatch(/^(GB|IE)$/);
    }
  });

  it("books the places a post is about, or the one place, and ends with the picker or the draw", async () => {
    const at = async (slug: string) => postBoxes((await loadPost(slug))!);
    expect(await at("lisbon-or-porto")).toEqual({ board: null, book: "tiles", end: "picker" });
    expect(await at("tivoli-gardens-at-christmas")).toEqual({ board: null, book: "card", end: "picker" });
    expect(await at("fair-ways-to-pick-a-holiday")).toEqual({ board: null, book: null, end: "draw" });
    expect(await at("which-side-of-the-plane-to-sit-on")).toEqual({ board: "visitor", book: null, end: null });
    expect(await at("which-side-of-the-plane-to-sit-on-flying-to-madeira")).toEqual({ board: null, book: "card", end: "picker" });
  });
});

describe("breaking up a post", () => {
  it("reads Tip, Watch out and Local knowledge paragraphs as boxes", () => {
    expect(calloutOf("Tip: book early.")).toEqual({ kind: "tip", text: "Book early." });
    expect(calloutOf("**Watch out:** queues")).toEqual({ kind: "warn", text: "Queues" });
    expect(calloutOf("Local knowledge: go at noon")).toMatchObject({ kind: "local" });
    expect(calloutOf("Tipping is optional.")).toBeNull();
    expect(calloutOf("Tip:")).toBeNull();
  });

  it("reads | rows as a table, skipping a Markdown divider row", () => {
    expect(tableRows(["| Trip | Arrive |", "| --- | --- |", "| City break | 2 hours |"])).toEqual([
      ["Trip", "Arrive"],
      ["City break", "2 hours"],
    ]);
    expect(tableRows(["| Just a heading |"])).toBeNull();
    expect(tableRows(["| a | b |", "not a row"])).toBeNull();
  });

  it("every table in a post has the same number of cells in each row", () => {
    for (const f of files) {
      const raw = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      for (const s of readPost(f, raw).sections) {
        for (const block of s.text.split(/\n\s*\n/)) {
          const rows = tableRows(block.split("\n").map((l) => l.trim()).filter(Boolean));
          if (rows) for (const r of rows) expect(r.length, `${f}: ${s.heading}`).toBe(rows[0].length);
        }
      }
    }
  });

  it("shows guide photos through a post, never twice, never after two sections running", () => {
    const place = (slug: string) => ({ slug, name: slug, country: "", country_code: "", lat: null, lon: null, to_code: "", image: `/images/destinations/${slug}.webp`, image_alt: slug, image_size: null, months: [] });
    const section = (heading: string, text: string, image = "") => ({ heading, text, image, image_alt: "", image_caption: "", image_size: null });
    const post = {
      ...readPost("x", {}),
      cover: { guide: "lisbon", image: "/images/destinations/lisbon.webp", alt: "" },
      places: ["lisbon", "porto", "faro", "evora"].map(place),
      sections: [
        section("The short answer", "- [Lisbon](/destinations/lisbon) or [Porto](/destinations/porto)"),
        section("One", "Text"),
        section("Two", "[Faro](/destinations/faro)"),
        section("Three", "[Evora](/destinations/evora)"),
        section("Four", "[Porto](/destinations/porto) and [Evora](/destinations/evora)", "/images/blog/own.webp"),
        section("Five", "[Evora](/destinations/evora)"),
      ],
    };
    const photos = sectionPhotos(post).map((p) => p.map((x) => x.guide || x.image));
    expect(photos).toEqual([[], ["porto"], [], ["evora"], ["/images/blog/own.webp"], []]);
  });
});
