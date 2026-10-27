// Months as the guides rate them. Kept apart from src/destinations.ts so pages that only need a few
// guides (a blog post's places) don't carry the list of every guide.

export const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
export type MonthRating = "best" | "good" | "quiet";

/** The best months to go, from the month-by-month ratings: "Apr–Jun, Sep–Oct". Runs can wrap past December. */
export function bestMonths(d: { months: { code: string; rating: MonthRating }[] }): string {
  const best = d.months.map((m) => m.rating === "best");
  if (!best.some(Boolean)) return "";
  if (best.every(Boolean)) return "All year";
  const label = (i: number) => d.months[i].code.charAt(0) + d.months[i].code.slice(1).toLowerCase();
  // Start just after a month that isn't "best", so a run like Nov–Feb stays in one piece.
  const start = (best.indexOf(false) + 1) % 12;
  const runs: [number, number][] = [];
  for (let k = 0; k < 12; k++) {
    const i = (start + k) % 12;
    if (!best[i]) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === (i + 11) % 12) last[1] = i;
    else runs.push([i, i]);
  }
  runs.sort((a, b) => a[0] - b[0]);
  return runs.map(([a, b]) => (a === b ? label(a) : `${label(a)}–${label(b)}`)).join(", ");
}
