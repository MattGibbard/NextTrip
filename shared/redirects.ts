// Old addresses that now live somewhere else, edited at /admin (Site > Redirects, content/site/redirects.json).
// The Worker answers them with a permanent redirect, so visitors and search engines follow on to the new page.
// test/redirects.test.ts checks each one lands on a real page and doesn't hide a page that's still live.
import file from "../content/site/redirects.json";

export interface Redirect {
  from: string;
  to: string;
}

/** An address as the site compares them: no domain, query or trailing slash. */
export function cleanPath(path: string): string {
  const p = path.trim().replace(/^https?:\/\/(www\.)?somewhere\.party/i, "").replace(/[?#].*$/, "");
  return p === "/" ? p : `/${p.replace(/^\/+|\/+$/g, "")}`;
}

/** A full address on another site, which is kept as it is. */
const isOtherSite = (to: string) => /^https?:\/\//i.test(to) && !/^https?:\/\/(www\.)?somewhere\.party/i.test(to);

/** Every redirect from the editor, tidied, skipping blank rows and ones that go nowhere. */
export function readRedirects(raw: unknown): Redirect[] {
  const rows = raw && typeof raw === "object" && Array.isArray((raw as { redirects?: unknown }).redirects) ? (raw as { redirects: unknown[] }).redirects : [];
  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({ from: String(r.from ?? "").trim(), to: String(r.to ?? "").trim() }))
    .filter((r) => r.from && r.to)
    .map((r) => ({ from: cleanPath(r.from), to: isOtherSite(r.to) ? r.to : cleanPath(r.to) }))
    .filter((r) => r.from !== "/" && r.from !== r.to);
}

export const REDIRECTS: Redirect[] = readRedirects(file);

const BY_FROM = new Map(REDIRECTS.map((r) => [r.from, r.to]));

/** Where an old address now lives, if it has moved. */
export function redirectFor(pathname: string): string | null {
  return BY_FROM.get(cleanPath(pathname)) ?? null;
}
