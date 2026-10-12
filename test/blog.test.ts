import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POSTS, blogJsonLd, findPost, loadPost, postDate, postMeta, postTitle, readPost } from "../src/blog";
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
