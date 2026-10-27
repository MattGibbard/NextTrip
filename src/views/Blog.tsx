import { useEffect, useState } from "react";
import { isShortAnswer, listingPath, postDate, relatedPosts, sectionPhotos, usedTags } from "../blog";
import type { Listing, Post, PostPhoto, Section } from "../blog";
import { BLOG_TAGS, tagInSentence, tagPath } from "../blogTags";
import type { BlogTag } from "../blogTags";
import { photoProps } from "../photos";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";
import { PostCards, PostLink } from "../components/PostCards";
import { Inline, RichText, anchor } from "./InfoPage";
import { PostBoxes } from "../components/PostBoxes";
import { INFO } from "../infoPages";
import { INFO_PAGES, destinationPath } from "../../shared/seo";

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

/** The how-to-decide guide, the blog's main article, at the top of the blog and its deciding posts. */
function StartHere() {
  const { hero } = INFO.decide;
  return (
    <section className="lp-wrap bl-start-wrap" aria-label="Start here">
      <article className="bl-card bl-start">
        <span className="bl-date">Start here · Guide</span>
        <h2>
          <a href={INFO_PAGES.decide.path}>{hero.heading}</a>
        </h2>
        {hero.lead && <p className="muted">{hero.lead}</p>}
      </article>
    </section>
  );
}

/** The blog's front page or a tag's page: a page of posts, newest first, with links to the other pages. */
export function BlogList({ listing: l }: { listing: Listing }) {
  const label = l.tag ? BLOG_TAGS[l.tag] : null;
  const pageOf = l.page > 1 ? ` Page ${l.page} of ${l.pages}.` : "";
  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader current="blog" exact={!l.tag && l.page === 1} />

      <main>
        <header className="lp-wrap lp-info-head">
          {(l.tag || l.page > 1) && (
            <nav aria-label="Breadcrumb" className="bl-crumbs">
              <a href="/">Home</a>
              <span aria-hidden>›</span>
              <a href="/blog">Blog</a>
            </nav>
          )}
          {!l.tag && <div className="lp-kicker">Blog</div>}
          <h1>{label ?? "Holiday ideas and advice"}</h1>
          {l.tag ? (
            <p className="lp-lead">
              {l.total} {l.total === 1 ? "article" : "articles"} about {tagInSentence(l.tag)}, with ideas and advice for choosing where to go and planning the trip.{pageOf}
            </p>
          ) : (
            <p className="lp-lead">Ideas and advice for choosing your next holiday, and for agreeing on it, whether it's the two of you, the whole family or a group of friends.{pageOf}</p>
          )}
        </header>

        <TagLinks current={l.tag ?? undefined} />

        {l.page === 1 && (!l.tag || l.tag === "deciding-where-to-go") && <StartHere />}

        <section className="lp-wrap bl-list" aria-label="Posts">
          {l.posts.length === 0 ? <p className="muted">Nothing here yet. Come back soon.</p> : l.posts.map((p, i) => <PostLink key={p.slug} post={p} eager={i < 3} />)}
        </section>

        <Pager listing={l} />
      </main>

      <SiteFooter />
    </div>
  );
}

/** One blog post: heading and introduction, its photo, its sections, its places and a way on (PostBoxes), its questions and related posts. */
export function BlogPost({ post }: { post: Post }) {
  const contents = post.sections.length >= 5 ? post.sections.filter((s) => s.heading) : [];
  const photos = sectionPhotos(post);

  return (
    <div className="lp lp-home lp-info bl">
      <SiteHeader current="blog" />

      <main>
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

        <div className="lp-wrap lp-info-body bl-body">
          {contents.length > 0 && <PostContents sections={contents} />}
          <div className="bl-main">
            <article className="lp-article">
              {post.sections.map((s, i) => {
                const id = s.heading ? anchor(s.heading) : undefined;
                if (i === 0 && isShortAnswer(s)) return <ShortAnswer key={i} section={s} id={id} code={post.airport} />;
                return (
                  <section key={i} id={id}>
                    {s.heading && <h2>{s.heading}</h2>}
                    <RichText text={s.text} />
                    {photos[i].length > 0 && <PostPhotos photos={photos[i]} />}
                  </section>
                );
              })}
            </article>

            <PostBoxes post={post} />
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
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * A post's opening "The short answer" as a box: a departures-board strip, then a row for each point.
 * A point written "**Label:** short value" puts the value in a chip on the right, so the numbers stand out.
 */
function ShortAnswer({ section, id, code }: { section: Section; id?: string; code: string }) {
  const blocks = section.text.split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean));
  const items = blocks.flat().filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  const notes = blocks.map((b) => b.filter((l) => !l.startsWith("- ")).join(" ")).filter(Boolean);
  // Values go in chips only when every point has a short one, so the rows line up.
  const chips = items.every((i) => CHIP.test(i));
  if (items.length === 0) {
    return (
      <section id={id} className="bl-answer">
        <AnswerHead heading={section.heading} code={code} />
        <div className="bl-answer-foot">
          <RichText text={section.text} />
        </div>
      </section>
    );
  }
  return (
    <section id={id} className="bl-answer">
      <AnswerHead heading={section.heading} code={code} />
      <ul className="bl-answer-rows">
        {items.map((item, j) => {
          const m = chips ? item.match(CHIP) : null;
          const chip = !!m;
          return (
            <li key={j} className={chip ? "chip" : undefined}>
              {chip ? (
                <>
                  <strong>
                    <Inline text={m[1]} />
                  </strong>
                  <span className="bl-answer-value">
                    <Inline text={m[2]} />
                  </span>
                </>
              ) : (
                <span>
                  <Inline text={item} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {notes.length > 0 && (
        <div className="bl-answer-foot">
          {notes.map((n, j) => (
            <p key={j}>
              <Inline text={n} />
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** A short-answer point written "**Label:** short value", e.g. "**Long-haul:** 3 hours". */
const CHIP = /^\*\*([^*]+?):\*\*\s*([^*[\]]{1,28}?)\.?$/;

function AnswerHead({ heading, code }: { heading: string; code: string }) {
  return (
    <div className="bl-answer-head">
      <h2>{heading}</h2>
      {code && <span aria-hidden>{code}</span>}
    </div>
  );
}

/** A section's photo, or two guides' photos side by side, with a caption linking the guides. */
function PostPhotos({ photos }: { photos: PostPhoto[] }) {
  const guides = photos.filter((p) => p.guide);
  const caption = photos.length === 1 && photos[0].caption ? photos[0].caption : "";
  return (
    <figure className={`bl-photo ${photos.length > 1 ? "pair" : ""}`}>
      <div className="bl-photo-imgs">
        {photos.map((p) => (
          <img key={p.image} {...photoProps(p.image, p.size, photos.length > 1 ? "(max-width: 760px) 50vw, 360px" : "(max-width: 760px) 100vw, 720px")} alt={p.alt} width={p.size?.[0]} height={p.size?.[1]} loading="lazy" decoding="async" />
        ))}
      </div>
      {(caption || guides.length > 0) && (
        <figcaption>
          {caption && <Inline text={caption} />}
          {guides.map((p, j) => (
            <span key={p.guide}>
              {(caption || j > 0) && " · "}
              <a href={destinationPath(p.guide)}>{p.name} guide</a>
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * "In this post": a box above the words on phones, and a column beside them on wide screens that stays
 * in view, marks the section you're reading and shows how far through the post you are.
 */
function PostContents({ sections }: { sections: Section[] }) {
  const [current, setCurrent] = useState("");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const ids = sections.map((s) => anchor(s.heading));
    let frame = 0;
    const update = () => {
      frame = 0;
      const article = document.querySelector(".bl-main .lp-article");
      if (!article) return;
      const box = article.getBoundingClientRect();
      const seen = window.innerHeight * 0.6 - box.top;
      setProgress(Math.max(0, Math.min(1, seen / box.height)));
      let on = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.3) on = id;
      }
      setCurrent(on);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <aside className="bl-side">
      <nav className="lp-info-contents" aria-label="In this post">
        <span className="lp-kicker">In this post</span>
        <div className="bl-progress" aria-hidden>
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
        <ul>
          {sections.map((s) => {
            const id = anchor(s.heading);
            return (
              <li key={s.heading}>
                <a href={`#${id}`} aria-current={id === current ? "location" : undefined}>
                  {s.heading}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
