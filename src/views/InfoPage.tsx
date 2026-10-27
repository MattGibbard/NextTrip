import type { ReactNode } from "react";
import { INFO, safeUrl } from "../infoPages";
import type { InfoPage as Page } from "../../shared/seo";
import { InstagramIcon, SiteFooter, SiteHeader } from "../components/SiteFrame";

/**
 * About, FAQ, Contact, How we make money and the how-to-decide guide: one layout, words edited at
 * /admin. A heading and introduction, then sections of text, an optional departures board of steps,
 * and optional questions and answers. The how-to-decide guide is the blog's main article, so it sits in the Blog section.
 */
export function InfoPage({ page }: { page: Page }) {
  const { hero, sections, board, faqs } = INFO[page];
  // Long pages get a list of their sections at the top to jump to.
  const contents = sections.length >= 5 ? sections.filter((s) => s.heading) : [];

  return (
    <div className="lp lp-home lp-info">
      <SiteHeader current={page === "decide" ? "blog" : undefined} />

      <main>
        <header className="lp-wrap lp-info-head">
          {page === "decide" && (
            <nav aria-label="Breadcrumb" className="bl-crumbs">
              <a href="/">Home</a>
              <span aria-hidden>›</span>
              <a href="/blog">Blog</a>
            </nav>
          )}
          {hero.kicker && <div className="lp-kicker">{hero.kicker}</div>}
          <h1>{hero.heading}</h1>
          {hero.lead && (
            <p className="lp-lead">
              <Inline text={hero.lead} />
            </p>
          )}
          {hero.button_label && <HeroButton label={hero.button_label} url={hero.button_url} />}
        </header>

        {(sections.length > 0 || contents.length > 0) && (
          <div className="lp-wrap lp-info-body">
            {contents.length > 0 && (
              <nav className="lp-info-contents" aria-label="On this page">
                <span className="lp-kicker">On this page</span>
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
              {sections.map((s, i) => (
                <section key={i} id={s.heading ? anchor(s.heading) : undefined}>
                  {s.heading && <h2>{s.heading}</h2>}
                  <RichText text={s.text} />
                </section>
              ))}
            </article>
          </div>
        )}

        {board.steps.length > 0 && (
          <section className="lp-wrap lp-section-how lp-info-board">
            <div className="lp-board">
              <div className="lp-board-head">
                {board.label && <span className="lp-board-label">{board.label}</span>}
                {board.heading && <h2>{board.heading}</h2>}
              </div>
              <div className="lp-board-rows" role="list">
                <div className="lp-board-row lp-board-cols" aria-hidden>
                  <span>Step</span>
                  <span>What happens</span>
                  <span>Status</span>
                </div>
                {board.steps.map((s, i) => (
                  <div key={s.title} className="lp-board-row" role="listitem">
                    <span className="lp-board-num">{String(i + 1).padStart(2, "0")}</span>
                    <div className="lp-board-what">
                      <strong>{s.title}</strong>
                      <span>{s.text}</span>
                    </div>
                    <span className={i === board.steps.length - 1 ? "lp-board-status lit" : "lp-board-status"}>{s.status}</span>
                  </div>
                ))}
              </div>
              <div className="lp-info-board-go">
                <a className="btn" href="/#signin">
                  Start planning, it's free
                </a>
              </div>
            </div>
          </section>
        )}

        {faqs.items.length > 0 && (
          <section className="lp-wrap lp-info-faqs" aria-label={faqs.heading || "Questions and answers"}>
            <div className="lp-info-faqs-inner">
              {faqs.heading && <h2>{faqs.heading}</h2>}
              <div className="lp-accordion">
                {faqs.items.map((q) => (
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
      </main>

      <SiteFooter />
    </div>
  );
}

function HeroButton({ label, url }: { label: string; url: string }) {
  const external = /^https:/i.test(url);
  const instagram = /instagram\.com\/somewhereparty/i.test(url);
  return (
    <div className="lp-creators-ig">
      <a className="btn large" href={url} {...(external ? { target: "_blank", rel: instagram ? "noopener me" : "noopener" } : {})}>
        {instagram && <InstagramIcon />} {label}
      </a>
      {instagram && <span className="muted small">@somewhereparty</span>}
      {url.startsWith("mailto:") && <span className="muted small">{url.slice("mailto:".length)}</span>}
    </div>
  );
}

/** A heading as an address to jump to, e.g. "1. Collect ideas" → "collect-ideas". */
export function anchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Text from the editor: paragraphs split by a blank line, lines starting "- " as a list,
 * **two stars** for bold and [words](/address) for links.
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const table = tableRows(lines);
        if (table) return <Table key={i} rows={table} />;
        const callout = calloutOf(lines.join(" "));
        if (callout) {
          return (
            <aside key={i} className={`rt-callout rt-${callout.kind}`}>
              <span className="rt-callout-icon" aria-hidden>
                {CALLOUTS[callout.kind].icon}
              </span>
              <span className="rt-callout-label">{CALLOUTS[callout.kind].label}</span>
              <p>
                <Inline text={callout.text} />
              </p>
            </aside>
          );
        }
        const items = lines.filter((l) => l.startsWith("- "));
        const intro = lines.filter((l) => !l.startsWith("- "));
        if (!items.length) {
          return (
            <p key={i}>
              <Inline text={lines.join(" ")} />
            </p>
          );
        }
        // A list, perhaps with a line introducing it.
        return (
          <div key={i}>
            {intro.length > 0 && (
              <p>
                <Inline text={intro.join(" ")} />
              </p>
            )}
            <ul>
              {items.map((l, j) => (
                <li key={j}>
                  <Inline text={l.slice(2)} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/** The boxes a paragraph becomes when it starts with "Tip:", "Watch out:" or "Local knowledge:". */
export const CALLOUTS = {
  tip: { prefix: "Tip:", label: "Tip", icon: "💡" },
  warn: { prefix: "Watch out:", label: "Watch out", icon: "⚠️" },
  local: { prefix: "Local knowledge:", label: "Local knowledge", icon: "📍" },
} as const;
type CalloutKind = keyof typeof CALLOUTS;

/** A paragraph's box, if it starts with one of the CALLOUTS (bold or not), and its words after that. */
export function calloutOf(paragraph: string): { kind: CalloutKind; text: string } | null {
  for (const kind of Object.keys(CALLOUTS) as CalloutKind[]) {
    const word = CALLOUTS[kind].prefix.slice(0, -1);
    const m = paragraph.match(new RegExp(`^(?:\\*\\*${word}:\\*\\*|\\*\\*${word}\\*\\*:|${word}:)\\s*`, "i"));
    if (m && paragraph.length > m[0].length) {
      const text = paragraph.slice(m[0].length);
      return { kind, text: text.charAt(0).toUpperCase() + text.slice(1) };
    }
  }
  return null;
}

/**
 * A block of lines that each start with "|" as a table's rows of cells, e.g. "| Trip | Arrive |".
 * The first row is the heading. A row of dashes under it ("|---|---|"), as in Markdown, is skipped.
 */
export function tableRows(lines: string[]): string[][] | null {
  if (lines.length < 2 || !lines.every((l) => l.startsWith("|"))) return null;
  const rows = lines
    .map((l) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)));
  return rows.length >= 2 ? rows : null;
}

function Table({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  return (
    <div className="rt-table" role="region" aria-label={head.join(", ")} tabIndex={0}>
      <table>
        <thead>
          <tr>
            {head.map((c, j) => (
              <th key={j} scope="col">
                <Inline text={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, k) => (
            <tr key={k}>
              {head.map((_, j) => (
                <td key={j}>
                  <Inline text={r[j] ?? ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One line of editor text: **bold** and [links](/address). Links go only to web addresses and the site's own pages. */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      // Bold words may hold a link, e.g. **Choose [Lisbon](/destinations/lisbon)**.
      out.push(
        <strong key={m.index}>
          <Inline text={m[1]} />
        </strong>,
      );
    } else {
      const href = safeUrl(m[3]);
      const external = /^https:/i.test(href);
      out.push(
        href ? (
          <a key={m.index} href={href} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
            {m[2]}
          </a>
        ) : (
          m[2]
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
