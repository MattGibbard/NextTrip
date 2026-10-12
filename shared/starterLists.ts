// Ready-made packing and to-do lists for a family trip, so a new plan doesn't start from a blank page.
// They depend on the kind of holiday and how you get there, and jobs get due dates counted back from
// the day you leave.
import type { Mode } from "./travelMode";
import { addDays } from "./tripDates";

/** Everyone packs these in their own bag. */
const PERSONAL = ["Clothes for each day", "Pyjamas", "Toothbrush", "Comfy shoes", "Jumper or jacket", "Something to do on the journey"];

/** Extras for each person on some kinds of holiday. */
const PERSONAL_BY_TYPE: Record<string, string[]> = {
  beach: ["Swimwear", "Sunhat", "Sunglasses", "Flip-flops"],
  relax: ["Swimwear"],
  cruise: ["Swimwear", "Something smart for dinner"],
  nature: ["Walking boots", "Waterproof jacket", "Water bottle"],
  adventure: ["Walking boots", "Waterproof jacket", "Water bottle"],
  ski: ["Ski jacket and trousers", "Thermals", "Gloves", "Goggles", "Warm hat"],
  city: ["Day bag"],
};

/** One for the whole family. */
const SHARED = ["Passports", "Travel insurance details", "Bank cards and some cash", "Phone chargers", "First aid kit and medicines", "Snacks for the journey", "Headphones"];

const SHARED_BY_TYPE: Record<string, string[]> = {
  beach: ["Sun cream", "After-sun", "Beach towels", "Bucket and spade"],
  relax: ["Sun cream"],
  nature: ["Sun cream", "Insect repellent", "Plasters for blisters"],
  adventure: ["Sun cream", "Insect repellent", "Plasters for blisters"],
  ski: ["Lip balm with SPF", "Sun cream"],
  "road-trip": ["Driving licence", "Car phone holder", "Travel sickness tablets", "Playlist for the car"],
  cruise: ["Sun cream", "Travel sickness tablets"],
};

const SHARED_BY_MODE: Partial<Record<Mode, string[]>> = {
  flight: ["Plug adaptors", "Boarding passes"],
  train: ["Train tickets"],
};

export interface StarterPacking {
  /** Goes in everyone's own bag. */
  personal: string[];
  shared: string[];
}

const unique = (xs: string[]) => [...new Set(xs)];

export function starterPacking(holidayTypes: readonly string[], mode: Mode): StarterPacking {
  return {
    personal: unique([...PERSONAL, ...holidayTypes.flatMap((t) => PERSONAL_BY_TYPE[t] ?? [])]),
    shared: unique([...SHARED, ...(SHARED_BY_MODE[mode] ?? []), ...holidayTypes.flatMap((t) => SHARED_BY_TYPE[t] ?? [])]),
  };
}

/** A job and how many days before you leave it should be done by. */
interface StarterJob {
  label: string;
  before: number;
  modes?: Mode[];
  types?: string[];
}

const JOBS: StarterJob[] = [
  { label: "Check everyone's passports are in date", before: 90 },
  { label: "Buy travel insurance", before: 60 },
  { label: "Check if you need visas or entry forms", before: 45 },
  { label: "Book airport parking or a lift", before: 30, modes: ["flight", "road"] },
  { label: "Sort out the car: service, breakdown cover", before: 21, types: ["road-trip"] },
  { label: "Book ski lessons and hire", before: 30, types: ["ski"] },
  { label: "Arrange someone to look after pets and plants", before: 21 },
  { label: "Get travel money or a travel card", before: 14 },
  { label: "Download films, games and maps for the journey", before: 3 },
  { label: "Check in online and save boarding passes", before: 1, modes: ["flight"] },
  { label: "Pack!", before: 1 },
];

export interface StarterTodo {
  label: string;
  /** YYYY-MM-DD, or null when you haven't set dates or the date has already gone. */
  due: string | null;
}

/** The usual jobs before a family trip. With a leaving date, each gets a due date, but never one in the past. */
export function starterTodos(holidayTypes: readonly string[], mode: Mode, leave: string | null, today: string): StarterTodo[] {
  return JOBS.filter((j) => (!j.modes || j.modes.includes(mode)) && (!j.types || j.types.some((t) => holidayTypes.includes(t)))).map((j) => {
    const due = leave ? addDays(leave, -j.before) : null;
    return { label: j.label, due: due && due >= today ? due : due && leave! >= today ? today : null };
  });
}

/** Leaves out anything already on a list, ignoring case and spaces. */
export function notAlready<T>(items: T[], existing: string[], label: (t: T) => string): T[] {
  const have = new Set(existing.map((s) => s.trim().toLowerCase()));
  return items.filter((i) => !have.has(label(i).trim().toLowerCase()));
}
