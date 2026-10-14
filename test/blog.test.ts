import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTHORS, POSTS, blogJsonLd, findPost, loadPost, postDate, postMeta, postTitle, postsAboutGuide, postsAboutHub, postsTagged, readPost, relatedPosts, tagMeta, usedTags } from "../src/blog";
import { BLOG_TAGS, TAG_INDEX_MIN, isBlogTag } from "../src/blogTags";
import { feedXml } from "../src/feed";
import { publicPage } from "../shared/seo";
import { DESTINATIONS } from "../src/destinations";
import { HUBS } from "../src/hubs";

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
    expect((blogJsonLd()[0] as Record<string, any>).blogPost).toHaveLength(POSTS.length);
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
      const meta = tagMeta(tag);
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
    expect(postsAboutGuide("lisbon", 3)).toContainEqual(lisbon);
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
