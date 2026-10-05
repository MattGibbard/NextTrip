// How each Places stamp looks: varied by country, but always the same for a given country.

const SHAPES = ["rounded", "square", "circle", "oval", "octagon", "ticket"] as const;
const BORDERS = ["single", "double", "inner"] as const;
const TRIMS = ["plain", "stars", "rules"] as const;
const LABELS = ["ARRIVED", "ENTRY", "ADMITTED", "IMMIGRATION"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2019-04-12" → "12 APR 2019", the way entry stamps print it. */
export function stampDate(date: string | null): string {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "UNDATED";
}

/**
 * Picks a stamp's shape, border, trim, label and tilt from its key (trip and
 * country), so each stamp keeps the same look. Round shapes only take names
 * short enough to fit.
 */
export function stampLook(key: string, name: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const roll = (n: number) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return ((h ^ (h >>> 15)) >>> 0) % n;
  };
  let shape: (typeof SHAPES)[number] = SHAPES[roll(SHAPES.length)];
  if ((shape === "circle" && name.length > 11) || (shape === "oval" && name.length > 16)) shape = "rounded";
  // Octagons and tickets draw their own outline, which has no room for a second line.
  const border = shape === "octagon" || shape === "ticket" ? "single" : BORDERS[roll(BORDERS.length)];
  const trim = TRIMS[roll(TRIMS.length)];
  const label = LABELS[roll(LABELS.length)];
  // Anywhere from 4° left to 4° right, whichever column the stamp lands in.
  const tilt = (roll(81) - 40) / 10;
  return { shape, border, trim, label, tilt };
}
