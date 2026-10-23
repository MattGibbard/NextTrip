import { describe, expect, it, vi } from "vitest";
import { MAIN_AIRPORTS, airportFrom, mainAirport, nearestMainAirport } from "../shared/mainAirports";
import { LONDON, budgetText, geoText, readHint, writeHint } from "../shared/visitor";
import type { From } from "../shared/visitor";
import { geoFor, visitorFrom, visitorTag } from "../worker/visitor";
import { servePage } from "../worker/pages";
import type { Env } from "../worker/env";
import { answersSummary, fromAirport, NO_ANSWERS, readAnswers } from "../src/picker";

const at = (code: string) => airportFrom(mainAirport(code)!);
const asked = (cf: object | undefined, headers: Record<string, string> = {}) => {
  const req = new Request("https://somewhere.party/destinations/lisbon", { headers: { "User-Agent": "Mozilla/5.0 Safari/605.1.15", ...headers } });
  if (cf) Object.defineProperty(req, "cf", { value: cf });
  return req;
};

describe("the main airports", () => {
  it("are listed once each, with real positions", () => {
    expect(new Set(MAIN_AIRPORTS.map((r) => r[0])).size).toBe(MAIN_AIRPORTS.length);
    for (const [code, name, country, lat, lon] of MAIN_AIRPORTS) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(name).not.toMatch(/\|/);
      expect(country).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    }
  });

  it("measures London from where the guides always have", () => {
    expect(at("LON")).toEqual(LONDON);
  });

  it("picks the nearest main airport in the visitor's own country", () => {
    expect(nearestMainAirport("GB", 51.51, -0.13)?.[0]).toBe("LON");
    expect(nearestMainAirport("GB", 53.48, -2.24)?.[0]).toBe("MAN");
    expect(nearestMainAirport("US", 40.65, -73.95)?.[0]).toBe("NYC");
    expect(nearestMainAirport("AU", -37.81, 144.96)?.[0]).toBe("MEL");
    // Strasbourg is nearer Frankfurt and Zurich, but French visitors get a French airport.
    expect(nearestMainAirport("FR", 48.57, 7.75)?.[2]).toBe("FR");
  });

  it("falls back to the nearest anywhere, or the country's main airport without a position", () => {
    expect(nearestMainAirport("NP", 27.7, 85.32)?.[0]).toBe("CCU");
    expect(nearestMainAirport("US", null, null)?.[0]).toBe("NYC");
    expect(nearestMainAirport("NP", null, null)).toBeUndefined();
  });

  it("never picks a single London airport, which LON covers", () => {
    expect(nearestMainAirport("GB", 51.47, -0.46)?.[0]).toBe("LON");
    expect(nearestMainAirport("GB", 51.15, -0.19)?.[0]).toBe("LON");
  });
});

describe("where a visitor flies from", () => {
  it("uses Cloudflare's place for them, with their country's currency", () => {
    expect(visitorFrom(asked({ country: "US", latitude: "47.6", longitude: "-122.33" }))).toEqual({ ...at("SEA"), currency: "USD" });
    expect(visitorFrom(asked({ country: "IE", latitude: "53.35", longitude: "-6.26" }))?.currency).toBe("EUR");
    // Their own country's money even when the nearest airport is over the border.
    expect(visitorFrom(asked({ country: "NP", latitude: "27.7", longitude: "85.32" }))).toMatchObject({ code: "CCU", currency: "USD" });
  });

  it("puts their own choice first", () => {
    expect(visitorFrom(asked({ country: "US", latitude: "47.6", longitude: "-122.33" }, { Cookie: "a=1; from=man" }))).toEqual(at("MAN"));
    expect(visitorFrom(asked({ country: "US", latitude: "47.6", longitude: "-122.33" }, { Cookie: "from=XYZ" }))?.code).toBe("SEA");
  });

  it("gives search engines and unplaced visitors the page as it's built", () => {
    expect(visitorFrom(asked({ country: "US", latitude: "37.4", longitude: "-122.1" }, { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }))).toBeNull();
    expect(visitorFrom(asked({ country: "US" }, { "User-Agent": "Mozilla/5.0 (compatible; bingbot/2.0)" }))).toBeNull();
    expect(visitorFrom(asked({ country: "XX" }))).toBeNull();
    expect(visitorFrom(asked({ country: "T1" }))).toBeNull();
    expect(visitorFrom(asked(undefined))).toBeNull();
  });

  it("travels in the page as a short hint", () => {
    const sea = at("SEA");
    expect(readHint(writeHint(sea))).toEqual(sea);
    expect(readHint("")).toBeNull();
    expect(readHint("SEA|Seattle|x|y|USD")).toBeNull();
    expect(readHint("<b>|Seattle|1|2|USD")).toBeNull();
  });

  it("writes budgets in the visitor's money", () => {
    expect(budgetText(2, "GBP")).toBe("££");
    expect(budgetText(3, "EUR")).toBe("€€€");
    expect(budgetText(1, "AUD")).toBe("$");
    expect(budgetText(2, "CHF")).toBe("$$");
  });

  it("writes each kind of mark", () => {
    const sea = at("SEA");
    const lisbon = { lat: 38.72, lon: -9.14 };
    expect(geoText({ geo: "code" }, sea)).toBe("SEA");
    expect(geoText({ geo: "label" }, sea)).toBe("FROM SEA");
    expect(geoText({ geo: "label" }, LONDON)).toBe("FROM THE UK");
    expect(geoText({ geo: "fact-label" }, sea)).toBe("FLIGHT FROM SEATTLE");
    expect(geoText({ geo: "hours", to: lisbon, fmt: "route" }, LONDON)).toBe("ABOUT 3 HRS ✈️");
    expect(geoText({ geo: "hours", to: lisbon, fmt: "pill" }, sea)).toBe("✈️ 11h");
    expect(geoText({ geo: "hours", to: null, fmt: "pill" }, sea)).toBeNull();
    expect(geoText({ geo: "nonsense" }, sea)).toBeNull();
  });
});

/**
 * What the Worker does to a built page, done with a regular expression over the marks. React has to
 * find the same words when it picks the page up, or it throws the page away and draws it again.
 */
function rewrite(html: string, from: From): string {
  return html.replace(/<span (data-geo="[^"]*"[^>]*)>([^<]*)<\/span>/g, (all, attrs: string) => {
    const attr = (name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
    const text = geoFor(attr, from);
    return text === null ? all : `<span ${attrs}>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
  });
}

/** The pages' code as it runs in a browser given `hint` by the Worker, or as it's built without one. */
async function pagesFor(hint: string | null) {
  vi.resetModules();
  const g = globalThis as { document?: unknown };
  g.document = hint ? { getElementById: () => ({ dataset: { visitor: hint } }) } : undefined;
  try {
    const [{ createElement }, { renderToString }, views, hubView, destinations, hubs] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("../src/views/DestinationPage"),
      import("../src/views/HubPage"),
      import("../src/destinations"),
      import("../src/hubs"),
    ]);
    return {
      guide: async (slug: string) => renderToString(createElement(views.DestinationPage, { destination: (await destinations.loadDestination(slug))! })),
      index: () => renderToString(createElement(views.DestinationsIndex, {})),
      hub: async (slug: string) => renderToString(createElement(hubView.HubPage, { hub: (await hubs.loadHub(slug))! })),
      slugs: destinations.DESTINATIONS.map((d) => d.slug),
      hubSlugs: hubs.HUBS.map((h) => h.slug),
    };
  } finally {
    delete g.document;
  }
}

describe("pages made out for a visitor", () => {
  const sea = at("SEA");

  it("rewrite a guide to read exactly as its code draws it", async () => {
    const built = await pagesFor(null);
    const theirs = await pagesFor(writeHint(sea));
    const page = await built.guide("lisbon");
    expect(page).toContain("FLIGHT FROM LONDON");
    expect(page).not.toContain("SEATTLE");
    expect(await theirs.guide("lisbon")).toContain("FLIGHT FROM SEATTLE");
    expect(rewrite(page, sea)).toBe(await theirs.guide("lisbon"));
  });

  it("rewrite every guide, the list of guides and the hub pages", async () => {
    const built = await pagesFor(null);
    const theirs = await pagesFor(writeHint(sea));
    for (const slug of built.slugs) expect(rewrite(await built.guide(slug), sea)).toBe(await theirs.guide(slug));
    expect(rewrite(built.index(), sea)).toBe(theirs.index());
    for (const slug of built.hubSlugs) expect(rewrite(await built.hub(slug), sea)).toBe(await theirs.hub(slug));
  }, 30_000); // renders every guide and hub twice, so it grows with the content
});

describe("the holiday picker", () => {
  it("prices and books in the currency of where they fly from", () => {
    expect(fromAirport("JFK").code).toBe("LON");
    expect(fromAirport("NYC").currency).toBe("USD");
    expect(answersSummary({ ...NO_ANSWERS, budget: 2 })).toEqual(["££ budget"]);
    expect(answersSummary({ ...NO_ANSWERS, budget: 2, from: "PAR" })).toEqual(["€€ budget"]);
  });

  it("takes any main airport from a link", () => {
    expect(readAnswers(new URLSearchParams("from=SYD")).from).toBe("SYD");
  });
});

describe("serving pages", () => {
  const env = (res: () => Response, seen: Request[] = []) =>
    ({ ASSETS: { fetch: async (req: Request) => (seen.push(req), res()) } }) as unknown as Env;
  const page = () => new Response("<html>", { headers: { "Content-Type": "text/html", ETag: '"abc"' } });

  it("gives each visitor's version its own ETag", async () => {
    const res = await servePage(asked(undefined), env(page));
    expect(res.headers.get("ETag")).toBe('"abc-built"');
    expect(visitorTag(at("SEA"))).toBe("SEA-USD");
  });

  it("checks a saved copy against the built file only when it's this visitor's version", async () => {
    const seen: Request[] = [];
    const notChanged = () => new Response(null, { status: 304, headers: { ETag: '"abc"' } });
    const res = await servePage(asked(undefined, { "If-None-Match": '"abc-built"' }), env(notChanged, seen));
    expect(seen[0].headers.get("If-None-Match")).toBe('"abc"');
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe('"abc-built"');
    await servePage(asked(undefined, { "If-None-Match": '"abc-SEA-USD"' }), env(page, seen));
    expect(seen[1].headers.get("If-None-Match")).toBeNull();
  });
});
