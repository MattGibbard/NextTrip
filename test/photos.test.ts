import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { mixPhotos, parsePixabay, photoQueries, sized, splitQuery } from "../shared/photos";
import type { PhotoSuggestion } from "../shared/photos";
import { sqliteD1 } from "./sqliteD1";

const place = (name: string, country = "Portugal") => ({ name, country, country_code: "PT", lat: 38.7, lon: -9.1 });
const hit = (id: number, tags = "city") => ({ id, webformatURL: `https://pixabay.com/get/g${id}_640.jpg`, tags, previewURL: "x" });

describe("photo helpers", () => {
  it("looks up the first three places once each", () => {
    expect(photoQueries([place("Lisbon"), place("Porto"), place("Lisbon"), place("Faro"), place("Braga")])).toEqual(["Lisbon|Portugal", "Porto|Portugal", "Faro|Portugal"]);
    expect(splitQuery("Lisbon|Portugal")).toEqual({ name: "Lisbon", country: "Portugal" });
    expect(splitQuery("Singapore|Singapore")).toEqual({ name: "Singapore", country: null });
  });

  it("reads Pixabay hits and sizes their links", () => {
    expect(parsePixabay({ hits: [hit(1, "lisbon, tram"), { id: 2 }, { id: 3, webformatURL: "http://insecure/x_640.jpg" }] })).toEqual([
      { id: 1, thumb: "https://pixabay.com/get/g1_340.jpg", preview: "https://pixabay.com/get/g1_640.jpg", alt: "lisbon, tram" },
    ]);
    expect(parsePixabay(null)).toEqual([]);
    expect(sized("https://pixabay.com/get/abc_640.png", 960)).toBe("https://pixabay.com/get/abc_960.png");
  });

  it("takes turns between places and drops repeats", () => {
    const p = (id: number) => ({ id }) as PhotoSuggestion;
    expect(mixPhotos([[p(1), p(2), p(3)], [p(2), p(4)], []], 4).map((x) => x.id)).toEqual([1, 2, 4, 3]);
  });
});

describe("photo routes", () => {
  const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1", PIXABAY_API_KEY: "test-key" } as Env;
  const fetches: string[] = [];
  const realFetch = globalThis.fetch;

  async function call(cookie: string | null, method: string, path: string, json?: unknown) {
    const res = await worker.fetch(
      new Request(`https://somewhere.party/api${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: json === undefined ? undefined : JSON.stringify(json),
      }),
      env,
      {} as ExecutionContext,
    );
    return res;
  }
  async function signIn(email: string) {
    const body = await (await call(null, "POST", "/auth/email", { email })).json();
    const token = new URL(body.dev_link).searchParams.get("token");
    return (await call(null, "POST", "/auth/verify", { token })).headers.get("Set-Cookie")!.split(";")[0];
  }

  let a: string;
  let b: string;
  beforeAll(async () => {
    a = await signIn("a@example.com");
    b = await signIn("b@example.com");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetches.length = 0;
  });

  const stubPixabay = () =>
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      fetches.push(url.href);
      if (url.pathname === "/api/") {
        const id = url.searchParams.get("id");
        if (id) return Response.json({ hits: id === "404" ? [] : [hit(Number(id))] });
        const q = url.searchParams.get("q");
        return Response.json({ hits: q === "Tiny" ? [hit(90)] : q === "Portugal" ? [hit(91), hit(92)] : [hit(1), hit(2), hit(3), hit(4), hit(5)] });
      }
      if (url.pathname.endsWith("_960.jpg")) return new Response(new Uint8Array([0xff, 0xd8, 1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } });
      return realFetch(input);
    });

  it("needs a sign-in to search or save", async () => {
    expect((await call(null, "GET", "/photos?q=Lisbon")).status).toBe(401);
    expect((await call(null, "POST", "/photos", { id: 1 })).status).toBe(401);
  });

  it("searches Pixabay for each place, falling back to the country", async () => {
    stubPixabay();
    const res = await (await call(a, "GET", `/photos?q=${encodeURIComponent("Lisbon|Portugal")}&q=${encodeURIComponent("Tiny|Portugal")}`)).json();
    expect(res.enabled).toBe(true);
    expect(res.photos.map((p: PhotoSuggestion) => p.id)).toEqual([1, 90, 2, 91, 3, 92, 4, 5]);
    expect(fetches.every((f) => f.includes("key=test-key"))).toBe(true);
  });

  it("says when there's no key, without calling Pixabay", async () => {
    stubPixabay();
    const res = await worker.fetch(new Request("https://somewhere.party/api/photos?q=Lisbon", { headers: { Cookie: a } }), { ...env, PIXABAY_API_KEY: undefined }, {} as ExecutionContext);
    expect(await res.json()).toEqual({ enabled: false, photos: [] });
    expect(fetches).toEqual([]);
  });

  it("copies a picked photo, serves it, and lets it be a cover", async () => {
    stubPixabay();
    const { url } = await (await call(a, "POST", "/photos", { id: 7 })).json();
    expect(url).toMatch(/^\/api\/photos\/[0-9a-f]{32}$/);
    expect(fetches.some((f) => f.endsWith("g7_960.jpg"))).toBe(true);

    const img = await worker.fetch(new Request(`https://somewhere.party${url}`), env, {} as ExecutionContext);
    expect(img.status).toBe(200);
    expect(img.headers.get("Content-Type")).toBe("image/jpeg");
    expect([...new Uint8Array(await img.arrayBuffer())]).toEqual([0xff, 0xd8, 1, 2, 3]);

    // The same photo again reuses the copy; another family gets its own.
    expect((await (await call(a, "POST", "/photos", { id: 7 })).json()).url).toBe(url);
    expect((await (await call(b, "POST", "/photos", { id: 7 })).json()).url).not.toBe(url);

    const id = (await (await call(a, "POST", "/ideas", { title: "Lisbon", cover_url: url, places: [] })).json()).id;
    const ideas = await (await call(a, "GET", "/ideas")).json();
    expect(ideas.find((i: { id: number }) => i.id === id).cover_url).toBe(url);
  });

  it("only takes Pixabay ids, and only its own photo paths as covers", async () => {
    stubPixabay();
    expect((await call(a, "POST", "/photos", { id: "https://evil.example/x.jpg" })).status).toBe(400);
    expect((await call(a, "POST", "/photos", { id: 404 })).status).toBe(404);
    expect((await worker.fetch(new Request("https://somewhere.party/api/photos/nope"), env, {} as ExecutionContext)).status).toBe(404);
    const id = (await (await call(a, "POST", "/ideas", { title: "Odd", cover_url: "/api/people", places: [] })).json()).id;
    const ideas = await (await call(a, "GET", "/ideas")).json();
    expect(ideas.find((i: { id: number }) => i.id === id).cover_url).toBeNull();
  });
});
