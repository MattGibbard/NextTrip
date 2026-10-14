// A Vite plugin for the list of guides. Importing a guide's JSON with `?card` gives only what its card
// on the Inspire page needs, so that list can hold every guide without carrying every guide's full
// text. The full guide loads on its own page (src/destinations.ts). Hubs (content/hubs) work the same
// way: every page knows enough to link to them, and their words load on their own page (src/hubs.ts).
// So do blog posts (content/blog, src/blog.ts).
import { readFile } from "node:fs/promises";

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

const GUIDES = new URL("../content/destinations/", import.meta.url);
const HUBS = new URL("../content/hubs/", import.meta.url);
const IMAGE_SIZES = new URL("../content/destination-images.json", import.meta.url);

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
 * and for related posts) and its cover photo: the guide picked in the editor, or else the first guide
 * it links to that has a photo.
 */
export async function postCard(raw) {
  const card = Object.fromEntries(POST_CARD_FIELDS.filter((k) => k in raw).map((k) => [k, raw[k]]));
  const text = [...(Array.isArray(raw.sections) ? raw.sections : []).map((s) => s?.text ?? ""), ...(Array.isArray(raw.faqs) ? raw.faqs : []).map((f) => f?.answer ?? "")].join("\n");
  const linked = [...new Set([...text.matchAll(/\]\(\/destinations\/([a-z0-9-]+)/g)].map((m) => m[1]))];
  const guides = [];
  const hubs = [];
  let cover;
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

/** A hub's card fields. */
export function hubCard(raw) {
  return Object.fromEntries(HUB_CARD_FIELDS.filter((k) => k in raw).map((k) => [k, raw[k]]));
}

/** A guide's card fields, with each month's rating but not its note. */
export function guideCard(raw) {
  const card = Object.fromEntries(CARD_FIELDS.filter((k) => k in raw).map((k) => [k, raw[k]]));
  if (raw.months && typeof raw.months === "object") {
    card.months = Object.fromEntries(Object.entries(raw.months).map(([code, m]) => [code, { rating: m?.rating }]));
  }
  return card;
}

export function destinationCards() {
  return {
    name: "destination-cards",
    enforce: "pre",
    async load(id) {
      const [file, query] = id.split("?");
      if (query !== "card" || !file.endsWith(".json")) return null;
      this.addWatchFile(file);
      const raw = JSON.parse(await readFile(file, "utf8"));
      const card = /[\\/]content[\\/]hubs[\\/]/.test(file) ? hubCard(raw) : /[\\/]content[\\/]blog[\\/]/.test(file) ? await postCard(raw) : guideCard(raw);
      return { code: `export default ${JSON.stringify(card)};`, moduleType: "js" };
    },
  };
}
