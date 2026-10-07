import { OLD_HOST, SITE, isPrivatePath } from "../shared/seo";
import type { Env } from "./env";

/**
 * Everything that isn't the API. The public pages, built files and the 404 page come straight from
 * the build (see scripts/prerender.mjs). Family links get the bare app shell, kept out of search.
 * The old workers.dev address sends visitors to the site's own domain so search engines see one site.
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
  return env.ASSETS.fetch(req);
}
