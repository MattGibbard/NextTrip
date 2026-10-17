// The plain content pages (About, FAQ, Contact, How we make money and the how-to-decide guide).
// Their words are edited at /admin and live in content/pages, bundled at build time like the rest
// of the site's words.
import { INFO_PAGES, PAGES, SITE } from "../shared/seo";
import type { InfoPage } from "../shared/seo";
import about from "../content/pages/about.json";
import faq from "../content/pages/faq.json";
import contact from "../content/pages/contact.json";
import money from "../content/pages/how-we-make-money.json";
import decide from "../content/pages/how-to-decide.json";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);

export interface InfoContent {
  seo_title: string;
  seo_description: string;
  hero: { kicker: string; heading: string; lead: string; button_label: string; button_url: string };
  /** Each section's text is short paragraphs, "- " lists, **bold** and [links](/somewhere). See RichText. */
  sections: { heading: string; text: string }[];
  board: { label: string; heading: string; steps: { title: string; text: string; status: string }[] };
  faqs: { heading: string; items: { question: string; answer: string }[] };
}

/** Only the site's own pages, web addresses and email addresses, never anything a browser would run. */
export function safeUrl(url: string): string {
  return /^(https:\/\/|\/(?!\/)|mailto:[^\s@]+@[^\s@]+$)/i.test(url) ? url : "";
}

/** Reads a content page's file. Like the home page, a field left empty in the editor just drops out. */
export function readInfo(raw: unknown): InfoContent {
  const r = obj(raw);
  const hero = obj(r.hero);
  const board = obj(r.board);
  const faqs = obj(r.faqs);
  const button_url = safeUrl(str(hero.button_url));
  return {
    seo_title: str(r.seo_title),
    seo_description: str(r.seo_description),
    hero: {
      kicker: str(hero.kicker),
      heading: str(hero.heading),
      lead: str(hero.lead),
      button_label: button_url ? str(hero.button_label) : "",
      button_url,
    },
    sections: list(r.sections).map((s) => ({ heading: str(s.heading), text: str(s.text) })).filter((s) => s.heading || s.text),
    board: {
      label: str(board.label),
      heading: str(board.heading),
      steps: list(board.steps).map((s) => ({ title: str(s.title), text: str(s.text), status: str(s.status) })).filter((s) => s.title),
    },
    faqs: {
      heading: str(faqs.heading),
      items: list(faqs.items).map((x) => ({ question: str(x.question), answer: str(x.answer) })).filter((x) => x.question && x.answer),
    },
  };
}

export const INFO: Record<InfoPage, InfoContent> = {
  about: readInfo(about),
  faq: readInfo(faq),
  contact: readInfo(contact),
  money: readInfo(money),
  decide: readInfo(decide),
};

/** The content file a page's words come from, so the build can tell when it last changed. */
export function infoSource(page: InfoPage): string {
  return `content/pages/${INFO_PAGES[page].file}.json`;
}

/** The text as search engines should read it: no stars, links as their words. */
export function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The page's title in search results and browser tabs. */
export function infoTitle(page: InfoPage): string {
  return INFO[page].seo_title || PAGES[page].title;
}

/** schema.org data: the questions on any page that has them, and the guide as an article. */
export function infoJsonLd(page: InfoPage, updated?: string): unknown[] {
  const c = INFO[page];
  const url = SITE + INFO_PAGES[page].path;
  const data: unknown[] = [];
  if (page === "decide") {
    data.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: c.hero.heading || infoTitle(page),
      description: c.seo_description || PAGES[page].description,
      url,
      mainEntityOfPage: url,
      image: `${SITE}/og.png`,
      ...(updated ? { dateModified: updated } : {}),
      author: { "@type": "Organization", name: "somewhere🎉", url: `${SITE}/` },
      publisher: { "@type": "Organization", name: "somewhere🎉", url: `${SITE}/`, logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
    });
    // It's the blog's main article, so it sits under the blog.
    data.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: c.hero.heading || infoTitle(page), item: url },
      ],
    });
  }
  if (c.faqs.items.length) {
    data.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: c.faqs.items.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: plainText(q.answer) },
      })),
    });
  }
  return data;
}
