// Site-wide words edited at /admin: the home page (content/site/home.json), the announcement
// banner (content/site/banner.json), the welcome steps (content/site/onboarding.json), the creators
// page (content/site/creators.json) and the creators featured on the home page (content/site/featured-creators.json).
// Bundled at build time like the destination guides.
import homeFile from "../content/site/home.json";
import bannerFile from "../content/site/banner.json";
import onboardingFile from "../content/site/onboarding.json";
import creatorsFile from "../content/site/creators.json";
import featuredFile from "../content/site/featured-creators.json";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);

export interface HomeContent {
  seo_title: string;
  seo_description: string;
  hero: { kicker: string; heading: string; lead: string; perks: string[] };
  how: { label: string; heading: string; steps: { title: string; text: string; status: string }[] };
  features: { kicker: string; heading: string; lead: string } & Record<FeatureKey, { title: string; text: string }>;
  why: { kicker: string; heading: string; reasons: { title: string; text: string }[] };
  signup: { strip: string; heading: string; lead: string };
}

export const FEATURE_KEYS = ["been", "places", "next", "draw"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Reads the home page file, so a field left empty in the editor just drops out instead of breaking the build. */
export function readHome(raw: unknown): HomeContent {
  const r = obj(raw);
  const hero = obj(r.hero);
  const how = obj(r.how);
  const features = obj(r.features);
  const why = obj(r.why);
  const signup = obj(r.signup);
  const card = (k: FeatureKey) => ({ title: str(obj(features[k]).title), text: str(obj(features[k]).text) });
  return {
    seo_title: str(r.seo_title),
    seo_description: str(r.seo_description),
    hero: {
      kicker: str(hero.kicker),
      heading: str(hero.heading),
      lead: str(hero.lead),
      perks: (Array.isArray(hero.perks) ? hero.perks : []).map(str).filter(Boolean),
    },
    how: {
      label: str(how.label),
      heading: str(how.heading),
      steps: list(how.steps).map((s) => ({ title: str(s.title), text: str(s.text), status: str(s.status) })).filter((s) => s.title),
    },
    features: {
      kicker: str(features.kicker),
      heading: str(features.heading),
      lead: str(features.lead),
      been: card("been"),
      places: card("places"),
      next: card("next"),
      draw: card("draw"),
    },
    why: {
      kicker: str(why.kicker),
      heading: str(why.heading),
      reasons: list(why.reasons).map((x) => ({ title: str(x.title), text: str(x.text) })).filter((x) => x.title),
    },
    signup: { strip: str(signup.strip), heading: str(signup.heading), lead: str(signup.lead) },
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
      { icon: "✈️", title: "PLAN THE TRIP", text: "Your winner becomes your next departure, ready to plan together." },
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
