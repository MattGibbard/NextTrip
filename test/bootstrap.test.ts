// The app opens with one request: who this browser is and everything the family has.
// It has to say exactly what the separate lists say, secret points and vetoes included.
import { beforeAll, expect, it } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { sqliteD1 } from "./sqliteD1";

const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1" } as Env;

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
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.get("Set-Cookie") };
}

const cookieFrom = (setCookie: string | null) => setCookie!.split(";")[0];
const place = (name: string) => ({ name, country: "France", country_code: "FR", lat: 48.8, lon: 2.3 });

let owner: string;
let member: string;
let other: string;

beforeAll(async () => {
  const signIn = async (email: string) => {
    const { body } = await call(null, "POST", "/auth/email", { email });
    const token = new URL(body.dev_link).searchParams.get("token");
    return cookieFrom((await call(null, "POST", "/auth/verify", { token })).setCookie);
  };
  owner = await signIn("boot@example.com");
  await call(owner, "POST", "/people", { name: "Organiser" });
  await call(owner, "PUT", "/home-ends", { airport: { kind: "airport", code: "LHR", name: "Heathrow", lat: 51.47, lon: -0.45 } });
  const ideas = [];
  for (const n of [1, 2, 3]) ideas.push((await call(owner, "POST", "/ideas", { title: `Idea ${n}`, places: [place(`Town ${n}`)] })).body.id);
  await call(owner, "POST", "/trips", { title: "Trip", places: [place("Trip town"), place("Second stop")] });
  const share = (await call(owner, "GET", "/auth/me")).body.share_token;
  member = cookieFrom((await call(null, "POST", "/auth/join", { token: share })).setCookie);
  await call(member, "POST", "/people", { name: "Member" });
  const round = (await call(owner, "POST", "/rounds", { points_per_person: 10 })).body.id;
  await call(owner, "PUT", `/rounds/${round}/allocations`, { allocations: [{ idea_id: ideas[0], points: 10 }] });
  await call(owner, "POST", `/rounds/${round}/veto`, { idea_id: ideas[1] });
  await call(member, "PUT", `/rounds/${round}/allocations`, { allocations: [{ idea_id: ideas[2], points: 10 }] });
  // Another family, whose things must never show up.
  other = await signIn("boot-other@example.com");
  await call(other, "POST", "/people", { name: "Stranger" });
  await call(other, "POST", "/ideas", { title: "Their idea", places: [place("Elsewhere")] });
});

it("tells a signed-out browser so, with nothing else", async () => {
  const { status, body } = await call(null, "GET", "/bootstrap");
  expect(status).toBe(200);
  expect(body).toEqual({ session: { signed_in: false }, data: null });
});

it("matches the separate lists for each person", async () => {
  for (const cookie of [owner, member]) {
    const { body } = await call(cookie, "GET", "/bootstrap");
    expect(body.session).toEqual((await call(cookie, "GET", "/auth/me")).body);
    expect(body.data).toEqual({
      people: (await call(cookie, "GET", "/people")).body,
      trips: (await call(cookie, "GET", "/trips")).body,
      ideas: (await call(cookie, "GET", "/ideas")).body,
      rounds: (await call(cookie, "GET", "/rounds")).body,
      home_ends: (await call(cookie, "GET", "/home-ends")).body,
    });
  }
});

it("keeps points and vetoes secret, and other families out", async () => {
  const { body } = await call(member, "GET", "/bootstrap");
  const [round] = body.data.rounds;
  expect(round.allocations.map((a: { idea_id: number }) => a.idea_id)).toHaveLength(1);
  expect(round.vetoes).toEqual([]);
  expect(body.session.share_token).toBeNull();
  expect(body.data.people.map((p: { name: string }) => p.name)).toEqual(["Organiser", "Member"]);
  expect(body.data.ideas.map((i: { title: string }) => i.title)).not.toContain("Their idea");
  expect(body.data.trips[0].places.map((p: { name: string }) => p.name)).toEqual(["Trip town", "Second stop"]);
});

it("fetches only the lists asked for", async () => {
  const { body } = await call(owner, "GET", "/bootstrap?only=rounds,home_ends,nonsense");
  expect(Object.keys(body.data).sort()).toEqual(["home_ends", "rounds"]);
  expect(body.data.home_ends.airport.code).toBe("LHR");
});
