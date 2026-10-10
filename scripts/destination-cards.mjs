// A Vite plugin for the list of guides. Importing a guide's JSON with `?card` gives only what its card
// on the Inspire page needs, so that list can hold every guide without carrying every guide's full
// text. The full guide loads on its own page (src/destinations.ts).
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
      return { code: `export default ${JSON.stringify(guideCard(JSON.parse(await readFile(file, "utf8"))))};`, moduleType: "js" };
    },
  };
}
