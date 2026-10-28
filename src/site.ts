// Site-wide words edited at /admin: the home page (content/site/home.json), the announcement
// banner (content/site/banner.json), the welcome steps (content/site/onboarding.json), the creators
// page (content/site/creators.json), the creators featured on the home page (content/site/featured-creators.json)
// the How it works page (content/site/how-it-works.json) and the popular guides on the home page
// (content/site/popular-guides.json).
// Bundled at build time like the destination guides.
import homeFile from "../content/site/home.json";
import bannerFile from "../content/site/banner.json";
import onboardingFile from "../content/site/onboarding.json";
import creatorsFile from "../content/site/creators.json";
import featuredFile from "../content/site/featured-creators.json";
import howFile from "../content/site/how-it-works.json";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);

export interface HomeContent {
  seo_title: string;
  seo_description: string;
  hero: { kicker: string; heading: string; lead: string; button: string; note: string };
  journey: { kicker: string; heading: string } & Record<ChapterKey, { title: string; text: string }>;
  postcards: { kicker: string; heading: string; text: string };
  faq: { heading: string; questions: { question: string; answer: string }[] };
  cta: { heading: string; button: string };
}

/** The home page's four chapters. Fixed, because each one is tied to its own picture. */
export const CHAPTER_KEYS = ["standby", "points", "draw", "plan"] as const;
export type ChapterKey = (typeof CHAPTER_KEYS)[number];

/** Reads the home page file, so a field left empty in the editor just drops out instead of breaking the build. */
export function readHome(raw: unknown): HomeContent {
  const r = obj(raw);
  const hero = obj(r.hero);
  const journey = obj(r.journey);
  const postcards = obj(r.postcards);
  const faq = obj(r.faq);
  const cta = obj(r.cta);
  const chapter = (k: ChapterKey) => ({ title: str(obj(journey[k]).title), text: str(obj(journey[k]).text) });
  return {
    seo_title: str(r.seo_title),
    seo_description: str(r.seo_description),
    hero: { kicker: str(hero.kicker), heading: str(hero.heading), lead: str(hero.lead), button: str(hero.button), note: str(hero.note) },
    journey: {
      kicker: str(journey.kicker),
      heading: str(journey.heading),
      standby: chapter("standby"),
      points: chapter("points"),
      draw: chapter("draw"),
      plan: chapter("plan"),
    },
    postcards: { kicker: str(postcards.kicker), heading: str(postcards.heading), text: str(postcards.text) },
    faq: {
      heading: str(faq.heading),
      questions: list(faq.questions)
        .map((q) => ({ question: str(q.question), answer: str(q.answer) }))
        .filter((q) => q.question && q.answer),
    },
    cta: { heading: str(cta.heading), button: str(cta.button) },
  };
}

export const HOME = readHome(homeFile);

export interface Banner {
  text: string;
  link_text: string;
  link_url: string;
  style: "news" | "celebrate" | "warning";
  /** YYYY-MM-DD. The banner hides itself after this day, even before the site is next rebuilt. */
  ends: string;
}

/** The announcement, or null when it's switched off or empty. */
export function readBanner(raw: unknown): Banner | null {
  const r = obj(raw);
  const text = str(r.text);
  if (r.show !== true || !text) return null;
  const style = r.style === "celebrate" || r.style === "warning" ? r.style : "news";
  const ends = /^\d{4}-\d{2}-\d{2}/.test(str(r.ends)) ? str(r.ends).slice(0, 10) : "";
  // Only web addresses and the site's own pages, never anything a browser would run.
  const url = str(r.link_url);
  const link_url = /^(https?:\/\/|\/)/i.test(url) ? url : "";
  return { text, link_text: str(r.link_text), link_url, style, ends };
}

export const BANNER = readBanner(bannerFile);

/** Whether a banner's last day has gone, by the visitor's own calendar. */
export function bannerEnded(b: Banner, today: Date): boolean {
  if (!b.ends) return false;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}` > b.ends;
}

/** A short fingerprint of a banner's words, so closing one announcement doesn't hide the next. */
export function bannerKey(b: Banner): string {
  let h = 0;
  for (const ch of b.text + b.link_url) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

/** The welcome steps' words. Each part is a set of named fields, as edited at /admin. */
const ONBOARDING_FIELDS = {
  welcome: ["eyebrow", "heading", "lead", "board_label", "bonus_label", "bonus", "note_organiser", "note_member", "button"],
  airport: ["eyebrow", "heading", "lead", "label", "placeholder", "pass_label", "pass_note", "button", "skip"],
  idea: ["eyebrow", "heading", "lead", "preview_note", "button", "skip"],
  done: ["heading", "organiser_text", "member_text", "invite_label", "invite_heading", "invite_text", "share_button", "ideas_button"],
} as const;

type Words<K extends readonly string[]> = Record<K[number], string>;
export interface OnboardingContent {
  welcome: Words<(typeof ONBOARDING_FIELDS)["welcome"]> & { steps: { icon: string; title: string; text: string }[] };
  airport: Words<(typeof ONBOARDING_FIELDS)["airport"]>;
  idea: Words<(typeof ONBOARDING_FIELDS)["idea"]>;
  done: Words<(typeof ONBOARDING_FIELDS)["done"]>;
}

/**
 * Reads the welcome steps' file. Unlike the home page, every field is needed on screen, so one left
 * empty in the editor keeps the words that shipped with the site rather than leaving a gap.
 */
export function readOnboarding(raw: unknown, fallback: OnboardingContent = ONBOARDING_DEFAULTS): OnboardingContent {
  const r = obj(raw);
  const part = <P extends keyof typeof ONBOARDING_FIELDS>(p: P) => {
    const o = obj(r[p]);
    return Object.fromEntries(ONBOARDING_FIELDS[p].map((k) => [k, str(o[k]) || (fallback[p] as Record<string, string>)[k]])) as OnboardingContent[P];
  };
  const steps = list(obj(r.welcome).steps)
    .map((s) => ({ icon: str(s.icon), title: str(s.title), text: str(s.text) }))
    .filter((s) => s.title);
  return {
    welcome: { ...part("welcome"), steps: steps.length ? steps : fallback.welcome.steps },
    airport: part("airport"),
    idea: part("idea"),
    done: part("done"),
  };
}

// The words as they shipped, kept in code so an emptied field always has something to fall back on.
const ONBOARDING_DEFAULTS: OnboardingContent = {
  welcome: {
    eyebrow: "WELCOME ABOARD",
    heading: "Find your next holiday, together",
    lead: "Here's how it works. It takes about a minute to get going.",
    board_label: "HOW IT WORKS",
    steps: [
      { icon: "💡", title: "DISCOVER AND ADD IDEAS", text: "Find places you'd love to go and put them on standby. Everyone in the family can add their own." },
      { icon: "🎟️", title: "DRAW AS A FAMILY", text: "Everyone spreads their points in secret, gets one veto, and the draw picks where you go." },
      { icon: "✈️", title: "PLAN THE TRIP", text: "Your winner gets a trip plan for the days, costs, packing and jobs before you go, shared with everyone." },
    ],
    bonus_label: "BONUS",
    bonus: "Log the holidays you've already been on to fill in your map.",
    note_organiser: "First, two quick things: where you fly from, and one place you'd love to go.",
    note_member: "First, one quick thing: a place you'd love to go.",
    button: "Let's get started",
  },
  airport: {
    eyebrow: "CHECK-IN",
    heading: "Which airport do you fly from?",
    lead: "Pick the one closest to home. We use it to work out travel time to your ideas.",
    label: "Closest airport",
    placeholder: "Town, airport or code",
    pass_label: "EVERY TRIP STARTS HERE",
    pass_note: "You can change this any time in Settings.",
    button: "Continue",
    skip: "We don't fly. Skip this",
  },
  idea: {
    eyebrow: "YOUR FIRST IDEA",
    heading: "Where would you love to go next?",
    lead: "Just one for now. Everyone can add more later.",
    preview_note: "This is how it'll look in your ideas.",
    button: "Put it on standby",
    skip: "I'll add one later",
  },
  done: {
    heading: "You're checked in",
    organiser_text: "A draw needs a few ideas, so bring the rest of the family in.",
    member_text: "Add more any time on Next, then draw together when everyone's ready.",
    invite_label: "PASSENGERS",
    invite_heading: "Invite your family",
    invite_text: "Send them this link. They don't need an email, they just pick their name and colour.",
    share_button: "Share link",
    ideas_button: "Go to my ideas",
  },
};

export const ONBOARDING = readOnboarding(onboardingFile);

/** The creators page at /creators: who we'd like to work with, how, and the terms. */
export interface CreatorsContent {
  seo_title: string;
  seo_description: string;
  hero: { kicker: string; heading: string; lead: string; button: string };
  look_for: { kicker: string; heading: string; reasons: { title: string; text: string }[] };
  how: { label: string; heading: string; steps: { title: string; text: string; status: string }[] };
  cta: { strip: string; heading: string; lead: string; button: string };
  terms: { heading: string; lead: string; updated: string; items: { title: string; text: string }[] };
}

/** Reads the creators page file. Like the home page, a field left empty just drops out. */
export function readCreators(raw: unknown): CreatorsContent {
  const r = obj(raw);
  const hero = obj(r.hero);
  const look = obj(r.look_for);
  const how = obj(r.how);
  const cta = obj(r.cta);
  const terms = obj(r.terms);
  return {
    seo_title: str(r.seo_title),
    seo_description: str(r.seo_description),
    hero: { kicker: str(hero.kicker), heading: str(hero.heading), lead: str(hero.lead), button: str(hero.button) || "Message us on Instagram" },
    look_for: {
      kicker: str(look.kicker),
      heading: str(look.heading),
      reasons: list(look.reasons).map((x) => ({ title: str(x.title), text: str(x.text) })).filter((x) => x.title),
    },
    how: {
      label: str(how.label),
      heading: str(how.heading),
      steps: list(how.steps).map((s) => ({ title: str(s.title), text: str(s.text), status: str(s.status) })).filter((s) => s.title),
    },
    cta: { strip: str(cta.strip), heading: str(cta.heading), lead: str(cta.lead), button: str(cta.button) || "Message us on Instagram" },
    terms: {
      heading: str(terms.heading),
      lead: str(terms.lead),
      updated: str(terms.updated),
      items: list(terms.items).map((x) => ({ title: str(x.title), text: str(x.text) })).filter((x) => x.title && x.text),
    },
  };
}

export const CREATORS = readCreators(creatorsFile);

/** The How it works page at /how-it-works: one animation per step, each beside its own words. */
export interface HowContent {
  seo_title: string;
  seo_description: string;
  hero: { kicker: string; heading: string; lead: string };
  steps: Record<HowStep, { kicker: string; title: string; text: string }>;
}

/** The page's steps, in order. Each has its own animation, so they're fixed rather than a list. */
export const HOW_STEPS = ["ideas", "points", "draw", "departure", "plan"] as const;
export type HowStep = (typeof HOW_STEPS)[number];

/** Reads the How it works page file. Like the home page, a field left empty just drops out. */
export function readHow(raw: unknown): HowContent {
  const r = obj(raw);
  const hero = obj(r.hero);
  const steps = obj(r.steps);
  const step = (k: HowStep) => {
    const s = obj(steps[k]);
    return { kicker: str(s.kicker), title: str(s.title), text: str(s.text) };
  };
  return {
    seo_title: str(r.seo_title),
    seo_description: str(r.seo_description),
    hero: { kicker: str(hero.kicker), heading: str(hero.heading), lead: str(hero.lead) },
    steps: { ideas: step("ideas"), points: step("points"), draw: step("draw"), departure: step("departure"), plan: step("plan") },
  };
}

export const HOW = readHow(howFile);

export interface FeaturedCreator {
  name: string;
  /** Instagram handle, without the @. */
  handle: string;
  /** Where their name links to: a post or profile, or their Instagram profile when none is given. */
  url: string;
  /** A photo uploaded in the editor, as a path on the site. */
  photo: string;
  quote: string;
}

export interface FeaturedCreators {
  kicker: string;
  heading: string;
  link_text: string;
  creators: FeaturedCreator[];
}

/** Reads the featured creators. Anyone switched off, or without a name and handle, is left out. */
export function readFeatured(raw: unknown): FeaturedCreators {
  const r = obj(raw);
  const creators = list(r.creators)
    .filter((c) => c.show !== false)
    .map((c) => {
      const handle = str(c.handle).replace(/^@/, "");
      const url = str(c.url);
      const photo = str(c.photo);
      return {
        name: str(c.name),
        handle: /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : "",
        // Only web addresses, never anything a browser would run.
        url: /^https:\/\//i.test(url) ? url : "",
        photo: /^\/images\//.test(photo) ? photo : "",
        quote: str(c.quote),
      };
    })
    .filter((c) => c.name && c.handle)
    .map((c) => ({ ...c, url: c.url || `https://instagram.com/${c.handle}` }));
  return { kicker: str(r.kicker), heading: str(r.heading), link_text: str(r.link_text), creators };
}

export const FEATURED = readFeatured(featuredFile);

export interface PopularGuide {
  slug: string;
  name: string;
  country_code: string;
  intro: string;
  image: string;
  image_alt: string;
  image_size: [number, number] | null;
}

export interface PopularGuides {
  kicker: string;
  heading: string;
  link_text: string;
  guides: PopularGuide[];
}

/** Reads the popular guides, which scripts/destination-cards.mjs has already filled in from each guide. */
export function readPopular(raw: unknown): PopularGuides {
  const r = obj(raw);
  const size = (v: unknown): [number, number] | null =>
    Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number") ? [v[0], v[1]] : null;
  return {
    kicker: str(r.kicker),
    heading: str(r.heading),
    link_text: str(r.link_text),
    guides: list(r.guides)
      .map((g) => ({ slug: str(g.slug), name: str(g.name), country_code: str(g.country_code), intro: str(g.intro), image: str(g.image), image_alt: str(g.image_alt), image_size: size(g.image_size) }))
      .filter((g) => g.slug && g.name),
  };
}

// Only the few cards the home page shows, not the list of every guide (see scripts/destination-cards.mjs).
const popularFile = Object.values(import.meta.glob<unknown>("/content/site/popular-guides.json", { eager: true, query: "?card", import: "default" }))[0];
export const POPULAR = readPopular(popularFile);
