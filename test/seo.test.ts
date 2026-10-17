import { describe, expect, it } from "vitest";
import { OLD_HOST, headTags, isPrivatePath, publicPage } from "../shared/seo";
import { servePage } from "../worker/pages";
import type { Env } from "../worker/env";

describe("publicPage", () => {
  it("knows the prerendered pages", () => {
    expect(publicPage("/")).toBe("home");
    expect(publicPage("/privacy")).toBe("privacy");
    expect(publicPage("/terms/")).toBe("terms");
    expect(publicPage("/f/abc")).toBeNull();
    expect(publicPage("/nope")).toBeNull();
    expect(publicPage("/destinations")).toBe("destinations");
    expect(publicPage("/creators")).toBe("creators");
    expect(publicPage("/how-it-works")).toBe("how");
    expect(publicPage("/how-it-works/")).toBe("how");
    expect(publicPage("/destinations/new-york")).toBe("destination:new-york");
    expect(publicPage("/destinations/New York")).toBeNull();
  });
});

describe("isPrivatePath", () => {
  it("covers family, person and sign-in links only", () => {
    expect(isPrivatePath("/f/abc-123")).toBe(true);
    expect(isPrivatePath("/p/abc_123/")).toBe(true);
    expect(isPrivatePath("/signin")).toBe(true);
    expect(isPrivatePath("/")).toBe(false);
    expect(isPrivatePath("/privacy")).toBe(false);
    expect(isPrivatePath("/f/abc/extra")).toBe(false);
  });
});

describe("headTags", () => {
  it("gives public pages a canonical address and share tags", () => {
    const tags = headTags("privacy");
    expect(tags).toContain('<link rel="canonical" href="https://somewhere.party/privacy" />');
    expect(tags).toContain('property="og:image" content="https://somewhere.party/og.png"');
    expect(tags).not.toContain("noindex");
  });

  it("describes the home page as an app", () => {
    const tags = headTags("home");
    expect(tags).toContain("application/ld+json");
    expect(tags).toContain("<title>Decide where to go on holiday, together | somewhere🎉</title>");
    expect(tags).toContain('"@type":"WebSite"');
    expect(tags).toContain('"@type":"Organization"');
  });

  it("keeps the 404 page out of search", () => {
    expect(headTags("notfound")).toContain('<meta name="robots" content="noindex" />');
    expect(headTags("notfound")).not.toContain("canonical");
  });
});

describe("servePage", () => {
  const asked: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (req: Request) => {
        asked.push(new URL(req.url).pathname);
        return new Response("page", { headers: { "Content-Type": "text/html" } });
      },
    },
  } as unknown as Env;

  it("sends the old address to the site's own domain, keeping the path", async () => {
    const res = await servePage(new Request(`https://${OLD_HOST}/f/abc?x=1`), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://somewhere.party/f/abc?x=1");
  });

  it("sends a moved page on to where it is now, keeping the query", async () => {
    const gone = { ASSETS: { fetch: async () => new Response("not found", { status: 404 }) } } as unknown as Env;
    const res = await servePage(new Request("https://somewhere.party/blog/where-is-hot-at-christmas/?utm_source=x"), gone);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://somewhere.party/destinations/where-to-go-in-december?utm_source=x");
    expect((await servePage(new Request("https://somewhere.party/blog/nothing-here"), gone)).status).toBe(404);
  });

  it("never redirects away from a page that's still there", async () => {
    const res = await servePage(new Request("https://somewhere.party/blog/where-is-hot-at-christmas"), env);
    expect(res.status).toBe(200);
  });

  it("serves family links the app shell with noindex", async () => {
    asked.length = 0;
    const res = await servePage(new Request("https://somewhere.party/f/abc"), env);
    expect(asked).toEqual(["/shell"]);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await res.text()).toBe("page");
  });

  it("keeps the content editor out of search", async () => {
    const res = await servePage(new Request("https://somewhere.party/admin/"), env);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("hands everything else to the built site", async () => {
    asked.length = 0;
    const res = await servePage(new Request("https://somewhere.party/privacy"), env);
    expect(asked).toEqual(["/privacy"]);
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("lets browsers keep built files, fonts and photos", async () => {
    const cache = async (path: string) => (await servePage(new Request(`https://somewhere.party${path}`), env)).headers.get("Cache-Control");
    expect(await cache("/assets/index-abc123.js")).toBe("public, max-age=31536000, immutable");
    expect(await cache("/fonts/inter-var-latin.woff2")).toBe("public, max-age=31536000, immutable");
    expect(await cache("/images/destinations/x.webp")).toBe("public, max-age=604800");
    expect(await cache("/destinations/levi")).toBeNull();
  });
});
