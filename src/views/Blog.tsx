import { postDate, POSTS, postsTagged, relatedPosts, usedTags } from "../blog";
import type { Post } from "../blog";
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
      <a href="/blog" aria-current={current ? undefined : "page"}>
        All
      </a>
      {tags.map(({ tag, count }) => (
        <a key={tag} href={tagPath(tag)} aria-current={tag === current ? "page" : undefined}>
          {BLOG_TAGS[tag]} <span className="bl-tag-count">{count}</span>
        </a>
      ))}
    </nav>
  );
}

/** The blog's front page: every post, newest first. */
export function BlogIndex() {
  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader current="blog" exact />

      <header className="lp-wrap lp-info-head">
        <div className="lp-kicker">Blog</div>
        <h1>Deciding where to go</h1>
        <p className="lp-lead">Ideas and advice for choosing your next holiday, and for agreeing on it, whether it's the two of you, the whole family or a group of friends.</p>
      </header>

      <TagLinks />

      <section className="lp-wrap bl-list" aria-label="Posts">
        {POSTS.length === 0 ? <p className="muted">Nothing here yet. Come back soon.</p> : POSTS.map((p) => <PostLink key={p.slug} post={p} />)}
      </section>

      <SiteFooter />
    </div>
  );
}

/** A tag's page: its posts, newest first. */
export function BlogTagPage({ tag }: { tag: BlogTag }) {
  const posts = postsTagged(tag);
  const label = BLOG_TAGS[tag];
  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader current="blog" />

      <header className="lp-wrap lp-info-head">
        <nav aria-label="Breadcrumb" className="bl-crumbs">
          <a href="/">Home</a>
          <span aria-hidden>›</span>
          <a href="/blog">Blog</a>
        </nav>
        <h1>{label}</h1>
        <p className="lp-lead">
          {posts.length} {posts.length === 1 ? "article" : "articles"} about {tagInSentence(tag)}, with ideas and advice for choosing where to go and planning the trip.
        </p>
      </header>

      <TagLinks current={tag} />

      <section className="lp-wrap bl-list" aria-label="Posts">
        {posts.map((p) => (
          <PostLink key={p.slug} post={p} />
        ))}
      </section>

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
