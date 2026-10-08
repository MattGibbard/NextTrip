// The pieces of a Been postcard that are worked out rather than drawn: its tilt and postmark.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A slight tilt, from about 1.6° left to 1.6° right, that stays the same for a trip. */
export function postcardTilt(id: number): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((((h ^ (h >>> 16)) >>> 0) % 33) - 16) / 10;
}

/** "2026-09-15" → { month: "SEP", year: "2026" }, for the round postmark. */
export function postmarkDate(date: string | null): { month: string; year: string } | null {
  const m = date?.match(/^(\d{4})-(\d{2})/);
  return m ? { month: MONTHS[Number(m[2]) - 1], year: m[1] } : null;
}
