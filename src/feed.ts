// The blog's RSS feed at /blog/feed.xml, written at build time by scripts/prerender.mjs. Feed readers
// pick up new posts from it, and search engines can use it to find them sooner (it can be added in
// Search Console as well as the sitemap).
import { escapeHtml } from "../shared/html";
import { FEED_PATH, PAGES, SITE, postPath } from "../shared/seo";
import { POSTS } from "./blog";
import { BLOG_TAGS } from "./blogTags";
import { imageUrl } from "./photos";

/** How many of the newest posts the feed lists. */
const FEED_SIZE = 50;

/** "Wed, 14 Oct 2026 07:00:00 GMT", as RSS wants dates. Posts go out in the morning, UK time. */
function rssDate(date: string): string {
  return new Date(`${date}T07:00:00Z`).toUTCString();
}

export function feedXml(): string {
  const posts = POSTS.filter((p) => p.date).slice(0, FEED_SIZE);
  const items = posts.map((p) => {
    const url = SITE + postPath(p.slug);
    return [
      "    <item>",
      `      <title>${escapeHtml(p.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${rssDate(p.date)}</pubDate>`,
      ...(p.author ? [`      <dc:creator>${escapeHtml(p.author)}</dc:creator>`] : []),
      ...p.tags.map((t) => `      <category>${escapeHtml(BLOG_TAGS[t])}</category>`),
      `      <description>${escapeHtml(p.intro)}</description>`,
      ...(p.cover ? [`      <media:content url="${escapeHtml(imageUrl(p.cover.image))}" medium="image"${p.cover.size ? ` width="${p.cover.size[0]}" height="${p.cover.size[1]}"` : ""} />`] : []),
      "    </item>",
    ].join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>somewhere🎉 blog</title>
    <link>${SITE}${PAGES.blog.path}</link>
    <atom:link href="${SITE}${FEED_PATH}" rel="self" type="application/rss+xml" />
    <description>${escapeHtml(PAGES.blog.description)}</description>
    <language>en-gb</language>
${posts.length ? `    <lastBuildDate>${rssDate(posts[0].date)}</lastBuildDate>\n` : ""}    <image>
      <url>${SITE}/icon-512.png</url>
      <title>somewhere🎉 blog</title>
      <link>${SITE}${PAGES.blog.path}</link>
    </image>
${items.join("\n")}
  </channel>
</rss>
`;
}
