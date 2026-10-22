import { OLD_HOST, SITE, isPrivatePath } from "../shared/seo";
import { redirectFor } from "../shared/redirects";
import type { Env } from "./env";
import { personalise, visitorFrom, visitorTag } from "./visitor";

/**
 * Everything that isn't the API. The public pages, built files and the 404 page come straight from
 * the build (see scripts/prerender.mjs). Family links get the bare app shell, kept out of search.
 * The content editor at /admin is kept out of search too.
 * The old workers.dev address sends visitors to the site's own domain so search engines see one site,
 * and pages that are gone but have moved (Site > Redirects at /admin) send visitors on to where they are now.
 */
export async function servePage(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (url.hostname === OLD_HOST && (req.method === "GET" || req.method === "HEAD")) {
    return Response.redirect(SITE + url.pathname + url.search, 301);
  }
  if (isPrivatePath(url.pathname)) {
    const shell = await env.ASSETS.fetch(new Request(new URL("/shell", url), req));
    const res = new Response(shell.body, shell);
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  if (/^\/admin(\/|$)/.test(url.pathname)) {
    // The content editor: never in search results.
    const page = await env.ASSETS.fetch(req);
    const res = new Response(page.body, page);
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  const cache = cacheFor(url.pathname);
  const from = cache ? null : visitorFrom(req);
  const tag = visitorTag(from);
  const asked = cache ? { req, tagged: false } : withBaseTag(req, tag);
  const res = await env.ASSETS.fetch(asked.req);
  // Pages are made out for the visitor. A "not changed" answer may not say it's a page, but one to a visitor's own ETag is.
  if (!cache && ((res.status === 200 && isHtml(res)) || (res.status === 304 && (asked.tagged || isHtml(res))))) return forVisitor(res, from, tag);
  // A page that's gone may have moved. Only missing pages are redirected, so a redirect never hides a live one.
  const moved = res.status === 404 && (req.method === "GET" || req.method === "HEAD") ? redirectFor(url.pathname) : null;
  if (moved) return Response.redirect(/^https?:/.test(moved) ? moved : url.origin + moved + url.search, 301);
  if (!cache || !res.ok) return res;
  const cached = new Response(res.body, res);
  cached.headers.set("Cache-Control", cache);
  return cached;
}

function isHtml(res: Response): boolean {
  return (res.headers.get("Content-Type") ?? "").startsWith("text/html");
}

/**
 * A page made out for whoever's looking (worker/visitor.ts). Each visitor's version has its own ETag, so
 * a browser checking back gets "not changed" only for the version it has: someone who has since picked
 * another "Flying from" airport gets the page again. Personal versions are for that browser alone.
 */
function forVisitor(res: Response, from: ReturnType<typeof visitorFrom>, tag: string): Response {
  const page = from && res.status === 200 ? personalise(res, from) : res;
  const out = new Response(res.status === 304 ? null : page.body, res);
  const etag = res.headers.get("ETag");
  if (etag) out.headers.set("ETag", etag.replace(/"$/, `-${tag}"`));
  if (from) {
    out.headers.set("Cache-Control", "private, max-age=0, must-revalidate");
    out.headers.delete("Content-Length");
  }
  return out;
}

/** The request with the browser's saved ETag put back as the built file's, when it's for this visitor's version; otherwise without it. */
function withBaseTag(req: Request, tag: string): { req: Request; tagged: boolean } {
  const saved = req.headers.get("If-None-Match");
  if (!saved || !/-(?:[A-Z]{3}-[A-Z]{3}|built)"$/.test(saved)) return { req, tagged: false };
  const headers = new Headers(req.headers);
  if (saved.endsWith(`-${tag}"`)) headers.set("If-None-Match", saved.slice(0, -(tag.length + 2)) + '"');
  else headers.delete("If-None-Match");
  return { req: new Request(req, { headers }), tagged: true };
}

/**
 * How long browsers may keep a built file without checking back. Built code and styles have the
 * content in their names, so a change is a new address and they can be kept for good; fonts are
 * renamed if they ever change. Guide photos keep their names when edited, so they're kept a week.
 * Pages aren't listed: they always check for the latest.
 */
export function cacheFor(pathname: string): string | null {
  if (pathname.startsWith("/assets/") || pathname.startsWith("/fonts/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/images/")) return "public, max-age=604800";
  return null;
}
