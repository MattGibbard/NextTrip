const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });

function parse(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function dateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && !end) return fmt.format(parse(start));
  if (!start && end) return fmt.format(parse(end));
  const a = parse(start!);
  const b = parse(end!);
  const nights = Math.round((b.getTime() - a.getTime()) / 86400000);
  const label = nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : "";
  return `${fmt.format(a)} – ${fmt.format(b)}${label}`;
}

export function monthYear(d: string): string {
  return fmtMonth.format(parse(d));
}

export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

/** A link as a CSS background-image value. */
export function cssUrl(url: string) {
  return `url("${url.replace(/"/g, "%22")}")`;
}

/** Nights between two dates, or null without both. */
export function nights(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const n = Math.round((parse(end).getTime() - parse(start).getTime()) / 86400000);
  return n > 0 ? n : null;
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short" });

/** Compact dates for a ticket: "2–14 Apr 2026", "28 Mar – 3 Apr 2026", "30 Dec 2025 – 2 Jan 2026". */
export function shortRange(start: string | null, end: string | null): string | null {
  if (!start || !end || start === end) return start || end ? fmt.format(parse((start || end)!)) : null;
  const a = parse(start);
  const b = parse(end);
  if (a.getFullYear() !== b.getFullYear()) return `${fmt.format(a)} – ${fmt.format(b)}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MONTH.format(a)} – ${fmt.format(b)}`;
  return `${a.getDate()}–${fmt.format(b)}`;
}
