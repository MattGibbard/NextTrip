// The tags a blog post can have, each with its own page at /blog/tag/<slug>. The editor offers the same
// list (public/admin/config.yml, checked by test/blog.test.ts). Kept broad, so new posts fit one or more.

export const BLOG_TAGS = {
  "deciding-where-to-go": "Deciding where to go",
  "holiday-ideas": "Holiday ideas",
  "comparisons": "Comparisons",
  "planning": "Planning",
  "travel-tips": "Travel tips",
  "flights": "Flights",
  "airports": "Airports",
  "train-travel": "Train travel",
  "road-trips": "Road trips",
  "cruises": "Cruises",
  "weather": "Weather",
  "winter-sun": "Winter sun",
  "christmas": "Christmas",
  "spring": "Spring",
  "summer": "Summer",
  "autumn": "Autumn",
  "winter": "Winter",
  "school-holidays": "School holidays",
  "city-breaks": "City breaks",
  "short-breaks": "Short breaks",
  "beach-holidays": "Beach holidays",
  "ski-and-snow": "Ski and snow",
  "nature-and-outdoors": "Nature and outdoors",
  "adventure": "Adventure",
  "food-and-drink": "Food and drink",
  "culture-and-history": "Culture and history",
  "family-holidays": "Family holidays",
  "couples": "Couples",
  "group-trips": "Group trips",
  "budget-travel": "Budget travel",
  "europe": "Europe",
  "long-haul": "Long haul",
} as const;

export type BlogTag = keyof typeof BLOG_TAGS;

export function isBlogTag(slug: string): slug is BlogTag {
  return Object.hasOwn(BLOG_TAGS, slug);
}

/** A tag's name in the middle of a sentence: "city breaks", but "Christmas". */
export function tagInSentence(slug: BlogTag): string {
  const label: string = BLOG_TAGS[slug];
  return /^(Christmas|Europe)/.test(label) ? label : label.toLowerCase();
}

/** A tag page's address, or the address of one of its later pages. */
export function tagPath(slug: BlogTag, page = 1): string {
  return page > 1 ? `/blog/tag/${slug}/page/${page}` : `/blog/tag/${slug}`;
}

/** Tag pages with fewer posts than this stay out of search results until they fill up. */
export const TAG_INDEX_MIN = 3;
