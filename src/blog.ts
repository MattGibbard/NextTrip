// The blog: articles about deciding where to go, at /blog/<slug>. Each post is a JSON file in
// content/blog, written in the editor at /admin. Like the guides, every page knows enough about each
// post to link to it (scripts/destination-cards.mjs), and a post's words load on its own page.
import { PAGES, SITE, postPath } from "../shared/seo";
import type { Meta } from "../shared/seo";
import { plainText } from "./infoPages";

export interface Post {
  slug: string;
  published: boolean;
  title: string;
  /** When it was first published, as YYYY-MM-DD. Newest posts come first. */
  date: string;
  /** One or two sentences under the heading, on the blog's front page and in search results. */
  intro: string;
  seo_title: string;
  seo_description: string;
  /** Each section's text is short paragraphs, "- " lists, **bold** and [links](/somewhere), as on the content pages. */
  sections: { heading: string; text: string }[];
  faqs: { question: string; answer: string }[];
}

/** What every page knows about each post: enough to link to it. */
export type PostCard = Pick<Post, "slug" | "published" | "title" | "date" | "intro" | "seo_title">;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** Turns a file from the editor into a post, filling gaps rather than breaking the build over a missing field. */
export function readPost(slug: string, raw: Record<string, unknown>): Post {
  // The editor's date picker may add a time; only the day matters.
  const date = str(raw.date).slice(0, 10);
  return {
    slug,
    published: raw.published === true,
    title: str(raw.title) || slug,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    intro: str(raw.intro),
    seo_title: str(raw.seo_title),
    seo_description: str(raw.seo_description),
    sections: list(raw.sections)
      .map((s) => ({ heading: str(s.heading), text: str(s.text) }))
      .filter((s) => s.heading || s.text),
    faqs: list(raw.faqs)
      .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
      .filter((f) => f.question && f.answer),
  };
}

const slugOf = (path: string) => path.replace(/^.*\/|\.json(\?.*)?$/g, "");

const cards = import.meta.glob<Record<string, unknown>>("/content/blog/*.json", { eager: true, query: "?card", import: "default" });
const files = import.meta.glob<Record<string, unknown>>("/content/blog/*.json", { import: "default" });

/** Every published post, newest first. */
export const POSTS: PostCard[] = Object.entries(cards)
  .map(([path, raw]) => readPost(slugOf(path), raw))
  .filter((p) => p.published)
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "en-GB"));

export function findPost(slug: string): PostCard | undefined {
  return POSTS.find((p) => p.slug === slug);
}

const loaded = new Map<string, Post>();

/** A published post in full, once loadPost() has fetched it. */
export function loadedPost(slug: string): Post | undefined {
  return loaded.get(slug);
}

/** Fetches a published post in full. Undefined when there's no such post. */
export async function loadPost(slug: string): Promise<Post | undefined> {
  const load = findPost(slug) && files[`/content/blog/${slug}.json`];
  if (!load) return undefined;
  const p = loaded.get(slug) ?? readPost(slug, await load());
  loaded.set(slug, p);
  return p;
}

/** A post's title in search results and the browser tab. */
export function postTitle(p: PostCard): string {
  return `${p.seo_title || p.title} | somewhere🎉`;
}

/** "12 October 2026". */
export function postDate(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const ORG = { "@type": "Organization", name: "somewhere🎉", url: `${SITE}/` };

/** Title, description and search-result data for a post. `updated` is when its words last changed, as an ISO date, if known. */
export function postMeta(p: Post, updated?: string): Meta {
  const url = SITE + postPath(p.slug);
  const description = p.seo_description || p.intro;
  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description,
      url,
      mainEntityOfPage: url,
      image: `${SITE}/og.png`,
      ...(p.date ? { datePublished: p.date } : {}),
      ...(updated || p.date ? { dateModified: updated && updated > p.date ? updated : p.date } : {}),
      author: ORG,
      publisher: { ...ORG, logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
      isPartOf: { "@type": "Blog", name: "somewhere🎉 blog", url: SITE + PAGES.blog.path },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: SITE + PAGES.blog.path },
        { "@type": "ListItem", position: 3, name: p.title, item: url },
      ],
    },
  ];
  if (p.faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: plainText(f.answer) } })),
    });
  }
  return {
    path: postPath(p.slug),
    title: postTitle(p),
    description,
    index: true,
    type: "article",
    published: p.date || undefined,
    updated: updated && updated > p.date ? updated : p.date || undefined,
    jsonLd,
  };
}

/** The blog's front page data for search results: the blog and the posts on it. */
export function blogJsonLd(): unknown[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "somewhere🎉 blog",
      description: PAGES.blog.description,
      url: SITE + PAGES.blog.path,
      publisher: ORG,
      blogPost: POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: SITE + postPath(p.slug), ...(p.date ? { datePublished: p.date } : {}) })),
    },
  ];
}
