import { currencyFor } from "../shared/currency";
import { FROM_COOKIE, geoText, writeHint } from "../shared/visitor";
import type { From } from "../shared/visitor";
import { airportFrom, mainAirport, nearestMainAirport } from "../shared/mainAirports";

/**
 * Search engines and link previews get the pages as they're built, flying from London: the site is
 * written for UK families, so that's what search results should show. Matched loosely, as anything
 * that says it's a bot or crawler is better off with the plain page.
 */
const BOTS = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless|curl|wget|python|go-http/i;

/**
 * Where this visitor flies from: their own "Flying from" choice if they've made one, otherwise the
 * main airport nearest where Cloudflare places them, with prices in their country's currency. Null
 * for bots, and for visitors Cloudflare can't place (Tor, unknown), who get the page as it's built.
 */
export function visitorFrom(req: Request): From | null {
  if (BOTS.test(req.headers.get("User-Agent") ?? "")) return null;
  const chosen = mainAirport(cookie(req, FROM_COOKIE)?.toUpperCase());
  if (chosen) return airportFrom(chosen);
  const cf = (req as { cf?: IncomingRequestCfProperties }).cf;
  // Cloudflare says XX when it doesn't know, and T1 for Tor.
  const code: string | undefined = cf?.country;
  const country = code && /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
  const lat = cf?.latitude !== undefined ? Number(cf.latitude) : NaN;
  const lon = cf?.longitude !== undefined ? Number(cf.longitude) : NaN;
  const placed = Number.isFinite(lat) && Number.isFinite(lon);
  if (!country && !placed) return null;
  const row = nearestMainAirport(country, placed ? lat : null, placed ? lon : null);
  if (!row) return null;
  return airportFrom(row, country ? currencyFor(country) : undefined);
}

function cookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("Cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * A built page, made out for this visitor as it streams past: the hint goes on the page's root for its
 * code to read, and every piece marked data-geo is rewritten with the same words the code draws
 * (shared/visitor.ts geoText), so the page arrives right with nothing to swap once it loads.
 */
export function personalise(res: Response, from: From): Response {
  const rewritten = new HTMLRewriter()
    .on("#root", {
      element(el) {
        el.setAttribute("data-visitor", writeHint(from));
      },
    })
    .on("[data-geo]", {
      element(el) {
        const text = geoFor((name) => el.getAttribute(name), from);
        if (text !== null) el.setInnerContent(text);
      },
    })
    .transform(res);
  return rewritten;
}

/** The words for one data-geo mark, from its attributes (see src/components/Geo.tsx). */
export function geoFor(attr: (name: string) => string | null, from: From): string | null {
  const to = attr("data-to")?.split(",").map(Number);
  return geoText(
    {
      geo: attr("data-geo") ?? "",
      to: to?.length === 2 && to.every(Number.isFinite) ? { lat: to[0], lon: to[1] } : null,
      fmt: attr("data-fmt"),
      level: Number(attr("data-level")) || null,
    },
    from,
  );
}

/** A short tag for one visitor's version of a page, so a browser's saved copy is only reused for the same one. */
export function visitorTag(from: From | null): string {
  return from ? `${from.code}-${from.currency}` : "built";
}
