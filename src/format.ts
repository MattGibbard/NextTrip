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
