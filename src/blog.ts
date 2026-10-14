// The blog: articles about deciding where to go, at /blog/<slug>. Each post is a JSON file in
// content/blog, written in the editor at /admin. Like the guides, every page knows enough about each
// post to link to it (scripts/destination-cards.mjs), and a post's words load on its own page.
import { PAGES, SITE, postPath } from "../shared/seo";
import type { Meta } from "../shared/seo";
import { plainText } from "./infoPages";
import { imageUrl } from "./photos";
import { BLOG_TAGS, TAG_INDEX_MIN, isBlogTag, tagInSentence, tagPath } from "./blogTags";
import type { BlogTag } from "./blogTags";

/** The people who write the posts. */
export const AUTHORS = ["Matt", "Brogan"] as const;

/** A post's cover photo: a guide's photo, with the guide it came from. */
export interface Cover {
  guide: string;
  image: string;
  alt: string;
  size?: [number, number];
}

/** What every page knows about each post: enough to link to it, find related posts and show its photo. */
export interface PostCard {
  slug: string;
  published: boolean;
  title: string;
  /** When it was first published, as YYYY-MM-DD. Newest posts come first. */
  date: string;
  /** When its advice was last checked or changed in a way readers should know about, as YYYY-MM-DD, if it has been. */
  updated: string;
  /** One or two sentences under the heading, on the blog's front page and in search results. */
  intro: string;
  seo_title: string;
  /** Who wrote it, one of AUTHORS, or empty for the site itself. */
  author: string;
  tags: BlogTag[];
  /** The guides and hubs it links to, by slug (worked out by scripts/destination-cards.mjs). */
  guides: string[];
  hubs: string[];
  cover?: Cover;
}

export interface Post extends PostCard {
  seo_description: string;
  /** Each section's text is short paragraphs, "- " lists, **bold** and [links](/somewhere), as on the content pages. */
  sections: { heading: string; text: string }[];
  faqs: { question: string; answer: string }[];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
const strings = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
// The editor's date picker may add a time; only the day matters.
const day = (v: unknown) => {
  const d = str(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
};

function readCover(v: unknown): Cover | undefined {
  if (!v || typeof v !== "object") return undefined;
  const c = v as Record<string, unknown>;
  const size = Array.isArray(c.size) && c.size.length === 2 && c.size.every((n) => typeof n === "number") ? (c.size as [number, number]) : undefined;
  return str(c.image) ? { guide: str(c.guide), image: str(c.image), alt: str(c.alt), ...(size ? { size } : {}) } : undefined;
}

/**
 * Turns a file from the editor into a post, filling gaps rather than breaking the build over a missing
 * field. The guides it links to and its cover photo are only on its card (see withCard).
 */
export function readPost(slug: string, raw: Record<string, unknown>): Post {
  const date = day(raw.date);
  const updated = day(raw.updated);
  const author = str(raw.author);
  return {
    slug,
    published: raw.published === true,
    title: str(raw.title) || slug,
    date,
    updated: updated > date ? updated : "",
    intro: str(raw.intro),
    seo_title: str(raw.seo_title),
    author: (AUTHORS as readonly string[]).includes(author) ? author : "",
    tags: [...new Set(strings(raw.tags).filter(isBlogTag))],
    guides: strings(raw.guides),
    hubs: strings(raw.hubs),
    cover: readCover(raw.cover),
    seo_description: str(raw.seo_description),
    sections: list(raw.sections)
      .map((s) => ({ heading: str(s.heading), text: str(s.text) }))
      .filter((s) => s.heading || s.text),
    faqs: list(raw.faqs)
      .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
      .filter((f) => f.question && f.answer),
  };
}

/** A post in full, with what only its card knows: the guides it links to and its cover photo. */
export function withCard(p: Post): Post {
  const card = findPost(p.slug);
  return card ? { ...p, guides: card.guides, hubs: card.hubs, cover: card.cover } : p;
}

const slugOf = (path: string) => path.replace(/^.*\/|\.json(\?.*)?$/g, "");

const cards = import.meta.glob<Record<string, unknown>>("/content/blog/*.json", { eager: true, query: "?card", import: "default" });
const files = import.meta.glob<Record<string, unknown>>("/content/blog/*.json", { import: "default" });

/** Every published post, newest first. */
export const POSTS: PostCard[] = Object.entries(cards)
  .map(([path, raw]): PostCard => {
    const { seo_description: _d, sections: _s, faqs: _f, ...card } = readPost(slugOf(path), raw);
    return card;
  })
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
  const p = loaded.get(slug) ?? withCard(readPost(slug, await load()));
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

/** Who wrote a post, for search results: the person, or the site itself. */
function authorData(p: PostCard) {
  return p.author ? { "@type": "Person", name: p.author } : ORG;
}

/** The share image for a post: its cover photo, or the site's own. */
function postImage(p: PostCard): string {
  return p.cover ? imageUrl(p.cover.image) : `${SITE}/og.png`;
}

/** Title, description and search-result data for a post. `updated` is when its file last changed, as an ISO date, if known. */
export function postMeta(p: Post, updated?: string): Meta {
  const url = SITE + postPath(p.slug);
  const description = p.seo_description || p.intro;
  const modified = [p.date, p.updated, updated ?? ""].sort().pop() || undefined;
  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description,
      url,
      mainEntityOfPage: url,
      image: p.cover
        ? { "@type": "ImageObject", url: postImage(p), ...(p.cover.size ? { width: p.cover.size[0], height: p.cover.size[1] } : {}), ...(p.cover.alt ? { caption: p.cover.alt } : {}) }
        : postImage(p),
      ...(p.date ? { datePublished: p.date } : {}),
      ...(modified ? { dateModified: modified } : {}),
      ...(p.tags.length ? { keywords: p.tags.map((t) => BLOG_TAGS[t]).join(", "), articleSection: BLOG_TAGS[p.tags[0]] } : {}),
      inLanguage: "en-GB",
      author: authorData(p),
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
    updated: modified,
    image: postImage(p),
    ...(p.cover ? { imageAlt: p.cover.alt || undefined, imageSize: p.cover.size } : { imageSize: [1200, 630] as [number, number] }),
    jsonLd,
  };
}

/** A post as an item in a list, for search results. */
function postItem(p: PostCard) {
  return {
    "@type": "BlogPosting",
    headline: p.title,
    url: SITE + postPath(p.slug),
    ...(p.date ? { datePublished: p.date } : {}),
    image: postImage(p),
    author: authorData(p),
  };
}

// Tags

/** Posts with this tag, newest first. */
export function postsTagged(tag: BlogTag): PostCard[] {
  return POSTS.filter((p) => p.tags.includes(tag));
}

/** The tags in use, with how many posts have each, most used first. */
export function usedTags(): { tag: BlogTag; count: number }[] {
  const counts = new Map<BlogTag, number>();
  for (const p of POSTS) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || BLOG_TAGS[a.tag].localeCompare(BLOG_TAGS[b.tag], "en-GB"));
}

// Lists of posts: the blog's front page and each tag's page, a page of PAGE_SIZE posts at a time.

/** How many posts each page of the blog or a tag shows. */
export const PAGE_SIZE = 12;

/** One page of posts: all posts, or a tag's, newest first. */
export interface Listing {
  tag: BlogTag | null;
  /** Which page, from 1, and how many there are. */
  page: number;
  pages: number;
  posts: PostCard[];
  /** How many posts there are across every page. */
  total: number;
}

function makeListing(tag: BlogTag | null, page: number): Listing | null {
  const all = tag ? postsTagged(tag) : POSTS;
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pages || (tag && all.length === 0)) return null;
  return { tag, page, pages, posts: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: all.length };
}

/**
 * The page of posts a page name stands for: "blog" and "blog:2", or "tag:city-breaks" and
 * "tag:city-breaks:2". Null for anything else, a tag nobody uses, or a page past the end. Page 1
 * only has the short address, so "blog:1" isn't a page.
 */
export function listing(page: string | null | undefined): Listing | null {
  if (page === "blog") return makeListing(null, 1);
  const b = page?.match(/^blog:(\d+)$/);
  if (b) return Number(b[1]) > 1 ? makeListing(null, Number(b[1])) : null;
  const t = page?.match(/^tag:([a-z0-9-]+)(?::(\d+))?$/);
  if (!t || !isBlogTag(t[1])) return null;
  if (t[2] && Number(t[2]) < 2) return null;
  return makeListing(t[1], t[2] ? Number(t[2]) : 1);
}

/** Every page of posts, with its page name, for the build to write. */
export function listings(): (Listing & { id: string })[] {
  const out: (Listing & { id: string })[] = [];
  for (const tag of [null, ...usedTags().map((t) => t.tag)]) {
    const first = makeListing(tag, 1)!;
    for (let page = 1; page <= first.pages; page++) {
      const id = tag ? (page > 1 ? `tag:${tag}:${page}` : `tag:${tag}`) : page > 1 ? `blog:${page}` : "blog";
      out.push({ ...makeListing(tag, page)!, id });
    }
  }
  return out;
}

/** The address of a page of posts. */
export function listingPath(tag: BlogTag | null, page: number): string {
  if (tag) return tagPath(tag, page);
  return page > 1 ? `${PAGES.blog.path}/page/${page}` : PAGES.blog.path;
}

/** A page of posts' title in search results and the browser tab. */
export function listingTitle(l: Pick<Listing, "tag" | "page">): string {
  if (!l.tag) return l.page > 1 ? `Blog: deciding where to go on holiday, page ${l.page} | somewhere🎉` : PAGES.blog.title;
  return `${BLOG_TAGS[l.tag]}: articles and advice${l.page > 1 ? `, page ${l.page}` : ""} | somewhere🎉`;
}

/**
 * Title, description and search-result data for a page of posts. Every page has its own address, so
 * search engines can follow the Older links to every post. A tag with only a couple of posts stays
 * out of search results until it fills up.
 */
export function listingMeta(l: Listing): Meta {
  const path = listingPath(l.tag, l.page);
  const url = SITE + path;
  const pageNote = l.page > 1 ? ` Page ${l.page} of ${l.pages}.` : "";
  const crumbs = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Blog", item: SITE + PAGES.blog.path },
    ...(l.tag ? [{ "@type": "ListItem", position: 3, name: BLOG_TAGS[l.tag], item: SITE + tagPath(l.tag) }] : []),
  ];
  if (!l.tag) {
    return {
      ...PAGES.blog,
      path,
      title: listingTitle(l),
      description: PAGES.blog.description + pageNote,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "somewhere🎉 blog",
          description: PAGES.blog.description,
          url: SITE + PAGES.blog.path,
          inLanguage: "en-GB",
          publisher: ORG,
          blogPost: l.posts.map(postItem),
        },
        ...(l.page > 1 ? [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs }] : []),
      ],
    };
  }
  const label = BLOG_TAGS[l.tag];
  const first = (l.page - 1) * PAGE_SIZE;
  return {
    path,
    title: listingTitle(l),
    description: `Articles about ${tagInSentence(l.tag)} from the somewhere🎉 blog: ideas and advice for choosing where to go on holiday and planning the trip.${pageNote}`,
    index: l.total >= TAG_INDEX_MIN,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${label} articles`,
        url,
        inLanguage: "en-GB",
        isPartOf: { "@type": "Blog", name: "somewhere🎉 blog", url: SITE + PAGES.blog.path },
        mainEntity: { "@type": "ItemList", itemListElement: l.posts.map((p, i) => ({ "@type": "ListItem", position: first + i + 1, url: SITE + postPath(p.slug), name: p.title })) },
      },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs },
    ],
  };
}

// Links between posts, guides and hubs

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

/** Other posts on the same subject: sharing guides counts most, then tags. Newest posts fill any gaps. */
export function relatedPosts(post: PostCard, n: number): PostCard[] {
  const others = POSTS.filter((p) => p.slug !== post.slug);
  const score = (p: PostCard) => 2 * overlap(p.guides, post.guides) + 2 * overlap(p.hubs, post.hubs) + overlap(p.tags, post.tags);
  const ranked = others
    .map((p, i) => ({ p, i, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
  return [...ranked, ...others.filter((p) => !ranked.includes(p))].slice(0, n);
}

/** Posts that link to a guide, newest first. */
export function postsAboutGuide(slug: string, n: number): PostCard[] {
  return POSTS.filter((p) => p.guides.includes(slug)).slice(0, n);
}

/** Posts for a hub page: ones that link to it, then ones that link to two or more of its guides. */
export function postsAboutHub(slug: string, guides: string[], n: number): PostCard[] {
  return POSTS.map((p, i) => ({ p, i, s: (p.hubs.includes(slug) ? 10 : 0) + overlap(p.guides, guides) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map((x) => x.p);
}
