// A Vite plugin for the list of guides. Importing a guide's JSON with `?card` gives only what its card
// on the Inspire page needs, so that list can hold every guide without carrying every guide's full
// text. The full guide loads on its own page (src/destinations.ts). Hubs (content/hubs) work the same
// way: every page knows enough to link to them, and their words load on their own page (src/hubs.ts).
// So do blog posts (content/blog, src/blog.ts).
import { readFile, readdir } from "node:fs/promises";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };

countries.registerLocale(en);

/** The fields a card, the departures board, the filters and "Add to ideas" read. */
const CARD_FIELDS = [
  "name",
  "published",
  "country",
  "country_code",
  "lat",
  "lon",
  "intro",
  "seo_title",
  "image",
  "image_alt",
  "to_code",
  "holiday_types",
  "nights",
  "trip_length",
  "budget",
];

/** The fields links to a hub need. */
const HUB_CARD_FIELDS = ["published", "kind", "holiday_type", "country", "month", "guides", "icon", "name", "title", "seo_title"];

/** The fields links to a blog post need. */
const POST_CARD_FIELDS = ["published", "title", "date", "updated", "intro", "seo_title", "author", "tags"];

/** The fields links to an airport page need. */
const AIRPORT_CARD_FIELDS = ["published", "code", "name"];

const GUIDES = new URL("../content/destinations/", import.meta.url);
const BLOG = new URL("../content/blog/", import.meta.url);
const HUBS = new URL("../content/hubs/", import.meta.url);
const IMAGE_SIZES = new URL("../content/destination-images.json", import.meta.url);
const POSITIONS = new URL("../content/destinations-geo.json", import.meta.url);
const COUNTRY_NAMES = new URL("../shared/countryNames.json", import.meta.url);
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** How many of a post's places its page gets: enough for its booking tiles and departures board. */
const POST_PLACES = 8;
/** How many places an airport page's departures board can show. */
const AIRPORT_PLACES = 12;

/** Reads a JSON file, or undefined when it isn't there. */
async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * A blog post's card fields, plus the guides and hubs it links to (for "From the blog" on their pages
 * and for related posts) and its cover photo: its own photo if it has one, else the guide picked in the
 * editor, or else the first guide it links to that has a photo.
 */
export async function postCard(raw) {
  const card = Object.fromEntries(POST_CARD_FIELDS.filter((k) => k in raw).map((k) => [k, raw[k]]));
  const text = [...(Array.isArray(raw.sections) ? raw.sections : []).map((s) => s?.text ?? ""), ...(Array.isArray(raw.faqs) ? raw.faqs : []).map((f) => f?.answer ?? "")].join("\n");
  const linked = [...new Set([...text.matchAll(/\]\(\/destinations\/([a-z0-9-]+)/g)].map((m) => m[1]))];
  const guides = [];
  const hubs = [];
  let cover;
  if (typeof raw.cover_image === "string" && raw.cover_image.trim()) {
    const image = raw.cover_image.trim();
    const size = (await readJson(IMAGE_SIZES))?.[image];
    cover = { guide: "", image, alt: typeof raw.cover_image_alt === "string" ? raw.cover_image_alt.trim() : "", ...(size ? { size } : {}) };
  }
  for (const slug of [...new Set([typeof raw.cover === "string" ? raw.cover.trim() : "", ...linked].filter(Boolean))]) {
    const guide = await readJson(new URL(`${slug}.json`, GUIDES));
    if (guide) {
      if (linked.includes(slug)) guides.push(slug);
      if (!cover && guide.published === true && typeof guide.image === "string" && guide.image) {
        const size = (await readJson(IMAGE_SIZES))?.[guide.image];
        cover = { guide: slug, image: guide.image, alt: typeof guide.image_alt === "string" ? guide.image_alt : "", ...(size ? { size } : {}) };
      }
    } else if (linked.includes(slug) && (await readJson(new URL(`${slug}.json`, HUBS)))) hubs.push(slug);
  }
  return { ...card, guides, hubs, ...(cover ? { cover } : {}) };
}

/**
 * A post in full, with the guides it's about: the guide its cover photo came from, then the guides it
 * links to. Each comes as a guide's page would read it (src/destinations.ts readDestination, which a test
 * holds this to), so the post's page can show booking links and flight times for them without
 * carrying the list of every guide.
 */
export async function fullPost(raw) {
  const text = [...(Array.isArray(raw.sections) ? raw.sections : []).map((s) => s?.text ?? ""), ...(Array.isArray(raw.faqs) ? raw.faqs : []).map((f) => f?.answer ?? "")].join("\n");
  const linked = [...text.matchAll(/\]\(\/destinations\/([a-z0-9-]+)/g)].map((m) => m[1]);
  const cover = typeof raw.cover === "string" && !(typeof raw.cover_image === "string" && raw.cover_image.trim()) ? raw.cover.trim() : "";
  const [places, sizes] = await Promise.all([placesFor([cover, ...linked], POST_PLACES), readJson(IMAGE_SIZES)]);
  // Sections' own photos, with their sizes like the cover's.
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((s) => (s && typeof s.image === "string" && s.image.trim() && sizes?.[s.image.trim()] ? { ...s, image_size: sizes[s.image.trim()] } : s))
    : raw.sections;
  return { ...raw, sections, places };
}

/**
 * Published guides by slug, each as a guide's page would read it (src/destinations.ts readDestination,
 * which a test holds this to), skipping any that are missing or unpublished, at most `max` of them.
 */
async function placesFor(slugs, max) {
  const [sizes, positions, everyday] = await Promise.all([readJson(IMAGE_SIZES), readJson(POSITIONS), readJson(COUNTRY_NAMES)]);
  const places = [];
  for (const slug of [...new Set(slugs.filter(Boolean))]) {
    if (places.length >= max) break;
    const g = await readJson(new URL(`${slug}.json`, GUIDES));
    if (!g || g.published !== true) continue;
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const name = str(g.name) || slug;
    const code = (/^[A-Za-z]{2}$/.test(str(g.country)) ? str(g.country) : str(g.country_code)).toUpperCase();
    const position = positions?.[slug]?.query === `${name}|${code}` ? positions[slug] : undefined;
    const image = str(g.image);
    places.push({
      slug,
      name,
      country: code ? (everyday?.[code] ?? countries.getName(code, "en") ?? code) : str(g.country),
      country_code: code,
      lat: position?.lat ?? num(g.lat),
      lon: position?.lon ?? num(g.lon),
      to_code: str(g.to_code).toUpperCase(),
      image,
      image_alt: str(g.image_alt),
      image_size: sizes?.[image] ?? null,
      months: MONTHS.map((m) => {
        const rating = g.months?.[m]?.rating;
        return { code: m.toUpperCase(), rating: rating === "best" || rating === "good" ? rating : "quiet" };
      }),
    });
  }
  return places;
}

/**
 * An airport page in full (content/airports), with the blog posts about that airport (by their
 * `airport` field) and the places those posts link to, for its departures board. Direct-flights posts
 * come first, as their places are the ones you can fly to without changing.
 */
export async function fullAirport(raw) {
  const code = typeof raw.code === "string" ? raw.code.trim().toUpperCase() : "";
  const posts = [];
  const linked = [];
  const files = code ? (await readdir(BLOG)).filter((f) => f.endsWith(".json")).sort() : [];
  for (const file of files) {
    const p = await readJson(new URL(file, BLOG));
    if (!p || p.published !== true || typeof p.airport !== "string" || p.airport.trim().toUpperCase() !== code) continue;
    const slug = file.replace(/\.json$/, "");
    const direct = /direct/.test(slug);
    posts.push({ slug, title: p.title ?? slug, intro: p.intro ?? "", direct });
    const text = [...(Array.isArray(p.sections) ? p.sections : []).map((s) => s?.text ?? ""), ...(Array.isArray(p.faqs) ? p.faqs : []).map((f) => f?.answer ?? "")].join("\n");
    const slugs = [...text.matchAll(/\]\(\/destinations\/([a-z0-9-]+)/g)].map((m) => m[1]);
    if (direct) linked.unshift(...slugs);
    else linked.push(...slugs);
  }
  posts.sort((a, b) => Number(b.direct) - Number(a.direct) || a.slug.localeCompare(b.slug));
  return { ...raw, posts: posts.map(({ direct: _d, ...p }) => p), places: await placesFor(linked, AIRPORT_PLACES) };
}

/** An airport page's card fields: enough to link to it. */
export function airportCard(raw) {
  return Object.fromEntries(AIRPORT_CARD_FIELDS.filter((k) => k in raw).map((k) => [k, raw[k]]));
}

/** A hub's card fields. */
export function hubCard(raw) {
  return Object.fromEntries(HUB_CARD_FIELDS.filter((k) => k in raw).map((k) => [k, raw[k]]));
}

/** A guide's card fields, with each month's rating and temperature but not its note. */
export function guideCard(raw) {
  const card = Object.fromEntries(CARD_FIELDS.filter((k) => k in raw).map((k) => [k, raw[k]]));
  if (raw.months && typeof raw.months === "object") {
    card.months = Object.fromEntries(Object.entries(raw.months).map(([code, m]) => [code, { rating: m?.rating, temp: m?.temp }]));
  }
  return card;
}

/**
 * The home page's popular guides (content/site/popular-guides.json), with what each card shows filled
 * in from its guide, so the home page doesn't carry the list of every guide. Guides that are missing
 * or unpublished drop out.
 */
export async function popularGuides(raw) {
  const sizes = (await readJson(IMAGE_SIZES)) ?? {};
  const guides = [];
  for (const slug of Array.isArray(raw.guides) ? raw.guides : []) {
    if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) continue;
    const g = await readJson(new URL(`${slug}.json`, GUIDES));
    if (!g || g.published !== true) continue;
    const image = typeof g.image === "string" ? g.image : "";
    guides.push({
      slug,
      name: g.name,
      country_code: typeof g.country === "string" ? g.country : "",
      intro: typeof g.intro === "string" ? g.intro : "",
      image,
      image_alt: typeof g.image_alt === "string" ? g.image_alt : "",
      ...(image && sizes[image] ? { image_size: sizes[image] } : {}),
    });
  }
  return { kicker: raw.kicker ?? "", heading: raw.heading ?? "", link_text: raw.link_text ?? "", guides };
}

export function destinationCards() {
  return {
    name: "destination-cards",
    enforce: "pre",
    async load(id) {
      const [file, query] = id.split("?");
      if ((query !== "card" && query !== "post" && query !== "airport") || !file.endsWith(".json")) return null;
      this.addWatchFile(file);
      const raw = JSON.parse(await readFile(file, "utf8"));
      if (query === "post") return { code: `export default ${JSON.stringify(await fullPost(raw))};`, moduleType: "js" };
      if (query === "airport") return { code: `export default ${JSON.stringify(await fullAirport(raw))};`, moduleType: "js" };
      const card = /[\\/]content[\\/]site[\\/]popular-guides\.json$/.test(file)
        ? await popularGuides(raw)
        : /[\\/]content[\\/]hubs[\\/]/.test(file) ? hubCard(raw) : /[\\/]content[\\/]airports[\\/]/.test(file) ? airportCard(raw) : /[\\/]content[\\/]blog[\\/]/.test(file) ? await postCard(raw) : guideCard(raw);
      return { code: `export default ${JSON.stringify(card)};`, moduleType: "js" };
    },
  };
}
