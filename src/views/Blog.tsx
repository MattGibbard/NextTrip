import { listingPath, postDate, relatedPosts, usedTags } from "../blog";
import type { Listing, Post } from "../blog";
import { BLOG_TAGS, tagInSentence, tagPath } from "../blogTags";
import type { BlogTag } from "../blogTags";
import { photoProps } from "../photos";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";
import { PostCards, PostLink } from "../components/PostCards";
import { RichText, anchor } from "./InfoPage";

/** How many other posts a post suggests at the bottom. */
const MORE = 3;

/** The tags in use, as links to their pages, with `current` marked. */
function TagLinks({ current, label = "Topics" }: { current?: BlogTag; label?: string }) {
  const tags = usedTags();
  if (tags.length === 0) return null;
  return (
    <nav className="lp-wrap bl-tags" aria-label={label}>
      <a href="/blog" aria-current={current ? undefined : "true"}>
        All
      </a>
      {tags.map(({ tag, count }) => (
        <a key={tag} href={tagPath(tag)} aria-current={tag === current ? "true" : undefined}>
          {BLOG_TAGS[tag]} <span className="bl-tag-count">{count}</span>
        </a>
      ))}
    </nav>
  );
}

/** Newer and Older links, and a link to each page, under a page of posts. */
function Pager({ listing: l }: { listing: Listing }) {
  if (l.pages < 2) return null;
  const pages = Array.from({ length: l.pages }, (_, i) => i + 1);
  return (
    <nav className="lp-wrap bl-pager" aria-label="Pages">
      {l.page > 1 ? (
        <a href={listingPath(l.tag, l.page - 1)} rel="prev">
          ← Newer
        </a>
      ) : (
        <span aria-hidden className="bl-pager-off">
          ← Newer
        </span>
      )}
      <ol>
        {pages.map((n) => (
          <li key={n}>
            <a href={listingPath(l.tag, n)} aria-current={n === l.page ? "page" : undefined} aria-label={`Page ${n}`}>
              {n}
            </a>
          </li>
        ))}
      </ol>
      {l.page < l.pages ? (
        <a href={listingPath(l.tag, l.page + 1)} rel="next">
          Older →
        </a>
      ) : (
        <span aria-hidden className="bl-pager-off">
          Older →
        </span>
      )}
    </nav>
  );
}

/** The blog's front page or a tag's page: a page of posts, newest first, with links to the other pages. */
export function BlogList({ listing: l }: { listing: Listing }) {
  const label = l.tag ? BLOG_TAGS[l.tag] : null;
  const pageOf = l.page > 1 ? ` Page ${l.page} of ${l.pages}.` : "";
  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader current="blog" exact={!l.tag && l.page === 1} />

      <header className="lp-wrap lp-info-head">
        {(l.tag || l.page > 1) && (
          <nav aria-label="Breadcrumb" className="bl-crumbs">
            <a href="/">Home</a>
            <span aria-hidden>›</span>
            <a href="/blog">Blog</a>
          </nav>
        )}
        {!l.tag && <div className="lp-kicker">Blog</div>}
        <h1>{label ?? "Deciding where to go"}</h1>
        {l.tag ? (
          <p className="lp-lead">
            {l.total} {l.total === 1 ? "article" : "articles"} about {tagInSentence(l.tag)}, with ideas and advice for choosing where to go and planning the trip.{pageOf}
          </p>
        ) : (
          <p className="lp-lead">Ideas and advice for choosing your next holiday, and for agreeing on it, whether it's the two of you, the whole family or a group of friends.{pageOf}</p>
        )}
      </header>

      <TagLinks current={l.tag ?? undefined} />

      <section className="lp-wrap bl-list" aria-label="Posts">
        {l.posts.length === 0 ? <p className="muted">Nothing here yet. Come back soon.</p> : l.posts.map((p, i) => <PostLink key={p.slug} post={p} eager={i < 3} />)}
      </section>

      <Pager listing={l} />

      <SiteFooter />
    </div>
  );
}

/** One blog post: heading and introduction, its photo, its sections, a nudge to try the draw, its questions and related posts. */
export function BlogPost({ post }: { post: Post }) {
  const contents = post.sections.length >= 5 ? post.sections.filter((s) => s.heading) : [];

  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader current="blog" />

      <header className="lp-wrap lp-info-head">
        <nav aria-label="Breadcrumb" className="bl-crumbs">
          <a href="/">Home</a>
          <span aria-hidden>›</span>
          <a href="/blog">Blog</a>
        </nav>
        <h1>{post.title}</h1>
        {post.intro && <p className="lp-lead">{post.intro}</p>}
        {post.date && (
          <p className="bl-byline muted small">
            By {post.author || "somewhere🎉"} · <time dateTime={post.date}>{postDate(post.date)}</time>
            {post.updated && (
              <>
                {" "}
                · Updated <time dateTime={post.updated}>{postDate(post.updated)}</time>
              </>
            )}
          </p>
        )}
        {post.tags.length > 0 && (
          <ul className="bl-post-tags" aria-label="Topics">
            {post.tags.map((t) => (
              <li key={t}>
                <a href={tagPath(t)}>{BLOG_TAGS[t]}</a>
              </li>
            ))}
          </ul>
        )}
      </header>

      {post.cover && (
        <figure className="lp-wrap bl-cover">
          <img {...photoProps(post.cover.image, post.cover.size, "(max-width: 1100px) 100vw, 1060px")} alt={post.cover.alt} fetchPriority="high" decoding="async" width={post.cover.size?.[0]} height={post.cover.size?.[1]} />
        </figure>
      )}

      <div className="lp-wrap lp-info-body">
        {contents.length > 0 && (
          <nav className="lp-info-contents" aria-label="In this post">
            <span className="lp-kicker">In this post</span>
            <ul>
              {contents.map((s) => (
                <li key={s.heading}>
                  <a href={`#${anchor(s.heading)}`}>{s.heading}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <article className="lp-article">
          {post.sections.map((s, i) => (
            <section key={i} id={s.heading ? anchor(s.heading) : undefined}>
              {s.heading && <h2>{s.heading}</h2>}
              <RichText text={s.text} />
            </section>
          ))}
        </article>

        <div className="dx-cta bl-cta">
          <div>
            <span className="dx-cta-label">🎟️ CAN'T AGREE?</span>
            <h2>Let a fair draw decide</h2>
            <p className="muted">Everyone adds their ideas, spreads their points in secret and gets one veto. Then the draw picks where you go. It's free.</p>
          </div>
          <div className="dx-cta-actions">
            <a className="btn" href="/#signin">
              Start planning
            </a>
            <a href="/destinations">Find ideas</a>
          </div>
        </div>
      </div>

      {post.faqs.length > 0 && (
        <section className="lp-wrap lp-info-faqs" aria-labelledby="bl-faq">
          <div className="lp-info-faqs-inner">
            <h2 id="bl-faq">Common questions</h2>
            <div className="lp-accordion">
              {post.faqs.map((q) => (
                <details key={q.question}>
                  <summary>
                    {q.question}
                    <span aria-hidden>+</span>
                  </summary>
                  <RichText text={q.answer} />
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <PostCards posts={relatedPosts(post, MORE)} heading="More like this" id="bl-more" />

      <SiteFooter />
    </div>
  );
}
