import { postPath } from "../../shared/seo";
import { postDate } from "../blog";
import type { PostCard } from "../blog";
import { photoProps } from "../photos";

/** A post's card: its photo, date and author, title and introduction. The whole card is the link. `eager` for cards near the top of the page, whose photos are seen straight away. */
export function PostLink({ post, heading: H = "h2", eager = false }: { post: PostCard; heading?: "h2" | "h3"; eager?: boolean }) {
  return (
    <article className="bl-card">
      {post.cover && (
        <img className="bl-card-photo" {...photoProps(post.cover.image, post.cover.size, "(max-width: 720px) 100vw, 400px")} alt="" loading={eager ? "eager" : "lazy"} decoding="async" width={post.cover.size?.[0]} height={post.cover.size?.[1]} />
      )}
      {post.date && (
        <p className="bl-date">
          <time dateTime={post.date}>{postDate(post.date)}</time>
          {post.author && <> · {post.author}</>}
        </p>
      )}
      <H>
        <a href={postPath(post.slug)}>{post.title}</a>
      </H>
      {post.intro && <p className="muted">{post.intro}</p>}
    </article>
  );
}

/** A section of post cards, e.g. "From the blog" on a guide. */
export function PostCards({ posts, heading, id, className = "" }: { posts: PostCard[]; heading: string; id: string; className?: string }) {
  if (posts.length === 0) return null;
  return (
    <section className={`lp-wrap bl-more ${className}`} aria-labelledby={id}>
      <h2 id={id}>{heading}</h2>
      <div className="bl-list">
        {posts.map((p) => (
          <PostLink key={p.slug} post={p} heading="h3" />
        ))}
      </div>
    </section>
  );
}
