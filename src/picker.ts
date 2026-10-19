// The holiday picker at /holiday-picker: four questions narrow the destination guides to the places
// that fit, then one is drawn at random. Visitors don't need an account, so the answers and the draw
// live in the address (?t=city,beach&m=sep&b=2&n=week&from=LGW&also=palma,nice), which makes every
// result a link that can be sent to the family.
import { HOLIDAY_TYPES } from "../shared/ideaDetails";
import type { HolidayType, TripLength } from "../shared/ideaDetails";
import { stayDates } from "../shared/tripDates";
import type { StayDates } from "../shared/tripDates";
import { PAGES, pickPath } from "../shared/seo";
import type { Meta } from "../shared/seo";
import { MONTHS, imageUrl } from "./destinations";
import type { DestinationCard } from "./destinations";

/** Where "Save to my ideas" leaves the guide for the signed-in app to add once they're in (SignedIn.tsx). */
export const PICKED_IDEA = "pickedIdea";

export type Month = (typeof MONTHS)[number];
/** How long for: a long weekend, about a week, or two weeks or more. */
export type Length = "weekend" | "week" | "long";

export interface Answers {
  /** Any of these; none means any kind of holiday. */
  types: HolidayType[];
  /** null: any time of year. */
  month: Month | null;
  /** The most they want to spend, 1 to 3; null: any budget. */
  budget: 1 | 2 | 3 | null;
  length: Length | null;
  /** The airport code they fly from. Only the booking links and flight times use it. */
  from: string;
}

/** The kinds of holiday on offer. */
export const PICKER_TYPES = HOLIDAY_TYPES;

export const BUDGET_CHOICES = [
  { key: 1, label: "£", title: "Keep it cheap", hint: "Short hops and simple stays" },
  { key: 2, label: "££", title: "Somewhere in the middle", hint: "Most of Europe, most of the year" },
  { key: 3, label: "£££", title: "Treat yourselves", hint: "Long haul and big trips" },
] as const;

export const LENGTH_CHOICES: { key: Length; title: string; hint: string }[] = [
  { key: "weekend", title: "A long weekend", hint: "Three or four nights" },
  { key: "week", title: "About a week", hint: "Five to eight nights" },
  { key: "long", title: "Two weeks or more", hint: "Far away, or a proper rest" },
];

const LENGTH_FITS: Record<Length, TripLength[]> = { weekend: ["weekend"], week: ["week"], long: ["two-weeks", "longer"] };
const LENGTH_NIGHTS: Record<Length, TripLength> = { weekend: "weekend", week: "week", long: "two-weeks" };

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Airports to fly from. "LON" is any London airport, which the flight search understands. Positions
 * give rough flight times. A short list rather than a search, as the airport search needs a sign-in.
 */
export const FROM_AIRPORTS: { code: string; name: string; lat: number; lon: number }[] = [
  { code: "LON", name: "Any London airport", lat: 51.47, lon: -0.4543 },
  { code: "LHR", name: "London Heathrow", lat: 51.47, lon: -0.4543 },
  { code: "LGW", name: "London Gatwick", lat: 51.1481, lon: -0.1903 },
  { code: "STN", name: "London Stansted", lat: 51.885, lon: 0.235 },
  { code: "LTN", name: "London Luton", lat: 51.8747, lon: -0.3683 },
  { code: "MAN", name: "Manchester", lat: 53.3537, lon: -2.275 },
  { code: "BHX", name: "Birmingham", lat: 52.4539, lon: -1.748 },
  { code: "BRS", name: "Bristol", lat: 51.3827, lon: -2.7191 },
  { code: "EMA", name: "East Midlands", lat: 52.8311, lon: -1.3281 },
  { code: "LBA", name: "Leeds Bradford", lat: 53.8659, lon: -1.6606 },
  { code: "NCL", name: "Newcastle", lat: 55.0375, lon: -1.6917 },
  { code: "LPL", name: "Liverpool", lat: 53.3336, lon: -2.8497 },
  { code: "EDI", name: "Edinburgh", lat: 55.95, lon: -3.3725 },
  { code: "GLA", name: "Glasgow", lat: 55.8719, lon: -4.4331 },
  { code: "BHD", name: "Belfast City", lat: 54.6181, lon: -5.8725 },
  { code: "BFS", name: "Belfast International", lat: 54.6575, lon: -6.2158 },
  { code: "CWL", name: "Cardiff", lat: 51.3967, lon: -3.3433 },
  { code: "SOU", name: "Southampton", lat: 50.9503, lon: -1.3568 },
  { code: "EXT", name: "Exeter", lat: 50.7344, lon: -3.4139 },
  { code: "DUB", name: "Dublin", lat: 53.4213, lon: -6.2701 },
];

export function fromAirport(code: string) {
  return FROM_AIRPORTS.find((a) => a.code === code) ?? FROM_AIRPORTS[0];
}

export const NO_ANSWERS: Answers = { types: [], month: null, budget: null, length: null, from: "LON" };

const SKI_SEASON: Record<"north" | "south", Month[]> = {
  north: ["dec", "jan", "feb", "mar", "apr"],
  south: ["jun", "jul", "aug", "sep"],
};

/** Whether a guide fits the answers. A guide that doesn't say its budget or trip length fits any. */
export function fits(d: DestinationCard, a: Answers): boolean {
  const kinds = a.types.filter((t) => d.holiday_types.includes(t));
  if (a.types.length && !kinds.length) return false;
  if (a.month) {
    const m = d.months[MONTHS.indexOf(a.month)];
    if (!m || (m.rating !== "best" && m.rating !== "good")) return false;
    // Ski resorts rate their summers well for walking, so someone who's only after skiing gets
    // them in the ski season alone.
    if (kinds.length === 1 && kinds[0] === "ski" && !SKI_SEASON[(d.lat ?? 0) < 0 ? "south" : "north"].includes(a.month)) return false;
  }
  if (a.budget && d.budget !== null && d.budget > a.budget) return false;
  if (a.length && d.trip_length !== null && !LENGTH_FITS[a.length].includes(d.trip_length)) return false;
  return true;
}

export function matches(all: DestinationCard[], a: Answers): DestinationCard[] {
  return all.filter((d) => fits(d, a));
}

/** The most places the board shows. The winner is drawn from every match; the board shows it among a few others. */
export const BOARD_SIZE = 8;

/** A copy of the list in a random order (Fisher-Yates). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Draws one place at random from the matches, plus a few others that were on the board with it. Null when nothing fits. */
export function draw(fitting: DestinationCard[], random: () => number = Math.random): { winner: DestinationCard; also: DestinationCard[] } | null {
  if (!fitting.length) return null;
  const winner = fitting[Math.floor(random() * fitting.length)];
  const also = shuffled(
    fitting.filter((d) => d !== winner),
    random,
  ).slice(0, BOARD_SIZE - 1);
  return { winner, also };
}

/**
 * When nothing fits, the answers that would let the most places back in if they were dropped, best first.
 * Each says which question to change and how many places it brings back.
 */
export function loosen(all: DestinationCard[], a: Answers): { question: Question; label: string; answers: Answers; count: number }[] {
  const options: { question: Question; label: string; answers: Answers }[] = [];
  if (a.types.length) options.push({ question: "types", label: "Any kind of holiday", answers: { ...a, types: [] } });
  if (a.month) options.push({ question: "month", label: "Any time of year", answers: { ...a, month: null } });
  if (a.budget && a.budget < 3) options.push({ question: "budget", label: "A bigger budget", answers: { ...a, budget: (a.budget + 1) as 2 | 3 } });
  if (a.length) options.push({ question: "length", label: "Any length of trip", answers: { ...a, length: null } });
  return options
    .map((o) => ({ ...o, count: matches(all, o.answers).length }))
    .filter((o) => o.count > 0)
    .sort((x, y) => y.count - x.count);
}

export type Question = "types" | "month" | "budget" | "length";
export const QUESTIONS: Question[] = ["types", "month", "budget", "length"];

/** The answers as query-string values. Empty answers are left out. */
export function answersQuery(a: Answers): URLSearchParams {
  const q = new URLSearchParams();
  if (a.types.length) q.set("t", a.types.join(","));
  if (a.month) q.set("m", a.month);
  if (a.budget) q.set("b", String(a.budget));
  if (a.length) q.set("n", a.length);
  if (a.from !== NO_ANSWERS.from) q.set("from", a.from);
  return q;
}

/** Reads answers back from a query string, dropping anything that isn't a real choice. */
export function readAnswers(q: URLSearchParams): Answers {
  const types = (q.get("t") ?? "").split(",").filter((t): t is HolidayType => PICKER_TYPES.some((x) => x.key === t));
  const m = q.get("m");
  const b = Number(q.get("b"));
  const n = q.get("n");
  const from = q.get("from") ?? "";
  return {
    types: [...new Set(types)],
    month: MONTHS.find((x) => x === m) ?? null,
    budget: b === 1 || b === 2 || b === 3 ? b : null,
    length: LENGTH_CHOICES.find((x) => x.key === n)?.key ?? null,
    from: FROM_AIRPORTS.some((x) => x.code === from) ? from : NO_ANSWERS.from,
  };
}

/** The result's address: the guide drawn, the answers it was drawn for, and the others on the board. */
export function resultHref(slug: string, a: Answers, also: string[]): string {
  const q = answersQuery(a);
  if (also.length) q.set("also", also.join(","));
  const s = q.toString().replace(/%2C/g, ",");
  return `/holiday-picker/${slug}${s ? `?${s}` : ""}`;
}

/**
 * The link the Share button sends: it plays the draw before showing the result. The winner rides along
 * lightly disguised (w=, base64) and the board is in alphabetical order, so neither the link nor its
 * preview gives the place away.
 */
export function revealHref(slug: string, a: Answers, also: string[]): string {
  const q = answersQuery(a);
  q.set("also", [...new Set([...also, slug])].sort().join(","));
  q.set("w", btoa(slug).replace(/=+$/, ""));
  return `${PAGES.reveal.path}?${q.toString().replace(/%2C/g, ",")}`;
}

/** The winner a reveal link is for, if it names a real guide. */
export function readWinner(q: URLSearchParams, all: DestinationCard[]): DestinationCard | undefined {
  let slug = "";
  try {
    slug = atob(q.get("w") ?? "");
  } catch {
    return undefined;
  }
  return all.find((d) => d.slug === slug);
}

/** The other guides that were on the board, from a result's address. */
export function readAlso(q: URLSearchParams, all: DestinationCard[], winner: string): DestinationCard[] {
  const slugs = [...new Set((q.get("also") ?? "").split(","))].filter((s) => s && s !== winner).slice(0, BOARD_SIZE - 1);
  return slugs.map((s) => all.find((d) => d.slug === s)).filter((d): d is DestinationCard => !!d);
}

/** The next time this month comes round, as YYYY-MM: this year if it's still ahead, else next year. */
export function nextMonth(month: Month, today = new Date()): string {
  const i = MONTHS.indexOf(month);
  const year = today.getFullYear() + (i <= today.getMonth() ? 1 : 0);
  return `${year}-${String(i + 1).padStart(2, "0")}`;
}

/** Dates for the booking links: the 1st of the month for the length of trip picked, or none without a month. */
export function pickerStay(a: Answers, today = new Date()): StayDates | null {
  if (!a.month) return null;
  return stayDates({ kind: "month", month: nextMonth(a.month, today) }, a.length ? LENGTH_NIGHTS[a.length] : null);
}

/** The answers in a few words each, for the result page: "city break or beach", "September", "about a week", "££ budget". */
export function answersSummary(a: Answers): string[] {
  const types = a.types.map((t) => PICKER_TYPES.find((x) => x.key === t)!.label.toLowerCase());
  return [
    types.length ? (types.length > 1 ? `${types.slice(0, -1).join(", ")} or ${types[types.length - 1]}` : types[0]) : "",
    a.month ? MONTH_NAMES[MONTHS.indexOf(a.month)] : "",
    a.length ? LENGTH_CHOICES.find((x) => x.key === a.length)!.title.replace(/^A /, "a ").replace(/^About/, "about").replace(/^Two/, "two") : "",
    a.budget ? `${BUDGET_CHOICES[a.budget - 1].label} budget` : "",
  ].filter(Boolean);
}

/** Board lettering for an airport code; guides without one get a code from their name. */
export function boardCode(d: DestinationCard): string {
  return d.to_code || d.name.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

/**
 * A result page's title and share preview. Results are kept out of search, as each is a guide
 * under another address, but they're made to be sent to the family, so links to them show the guide's photo.
 */
export function pickMeta(d: DestinationCard): Meta {
  return {
    path: pickPath(d.slug),
    title: `Our random holiday: ${d.name} | somewhere🎉`,
    description: `The somewhere🎉 holiday picker drew ${d.name}. ${d.intro}`.trim(),
    index: false,
    preview: true,
    ...(d.image ? { image: imageUrl(d.image), imageAlt: d.image_alt || undefined, imageSize: d.image_size ?? undefined } : {}),
  };
}
