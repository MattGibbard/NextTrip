// Site-wide words edited at /admin: the home page (content/site/home.json) and the announcement
// banner (content/site/banner.json). Bundled at build time like the destination guides.
import homeFile from "../content/site/home.json";
import bannerFile from "../content/site/banner.json";

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
