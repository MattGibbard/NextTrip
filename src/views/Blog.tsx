import { postPath } from "../../shared/seo";
import { POSTS, postDate } from "../blog";
import type { Post, PostCard } from "../blog";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";
import { RichText, anchor } from "./InfoPage";

/** How many other posts a post suggests at the bottom. */
const MORE = 3;

/** The blog's front page: every post, newest first. */
export function BlogIndex() {
  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader />

      <header className="lp-wrap lp-info-head">
        <div className="lp-kicker">Blog</div>
        <h1>Deciding where to go</h1>
        <p className="lp-lead">Ideas and advice for choosing your next holiday, and for agreeing on it, whether it's the two of you, the whole family or a group of friends.</p>
      </header>

      <section className="lp-wrap bl-list" aria-label="Posts">
        {POSTS.length === 0 ? <p className="muted">Nothing here yet. Come back soon.</p> : POSTS.map((p) => <PostLink key={p.slug} post={p} />)}
      </section>

      <SiteFooter />
    </div>
  );
}

function PostLink({ post }: { post: PostCard }) {
  return (
    <article className="bl-card">
      {post.date && (
        <time className="bl-date" dateTime={post.date}>
          {postDate(post.date)}
        </time>
      )}
      <h2>
        <a href={postPath(post.slug)}>{post.title}</a>
      </h2>
      {post.intro && <p className="muted">{post.intro}</p>}
    </article>
  );
}

/** One blog post: heading and introduction, its sections, a nudge to try the draw, its questions and other posts. */
export function BlogPost({ post }: { post: Post }) {
  const contents = post.sections.length >= 5 ? post.sections.filter((s) => s.heading) : [];
  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, MORE);

  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader />

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
            By somewhere🎉 · <time dateTime={post.date}>{postDate(post.date)}</time>
          </p>
        )}
      </header>

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

      {more.length > 0 && (
        <section className="lp-wrap bl-more" aria-labelledby="bl-more">
          <h2 id="bl-more">More from the blog</h2>
          <div className="bl-list">
            {more.map((p) => (
              <PostLink key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
