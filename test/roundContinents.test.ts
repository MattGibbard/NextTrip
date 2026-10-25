// A round narrowed to continents: the server works out which ideas are in from their places.
import { beforeAll, describe, expect, it } from "vitest";
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

const place = (name: string, country: string, country_code: string) => ({ name, country, country_code, lat: 0, lon: 0 });

let owner: string;
const ideas: Record<string, number> = {};

beforeAll(async () => {
  const { body } = await call(null, "POST", "/auth/email", { email: "continents@example.com" });
  const token = new URL(body.dev_link).searchParams.get("token");
  owner = (await call(null, "POST", "/auth/verify", { token })).setCookie!.split(";")[0];
  await call(owner, "POST", "/people", { name: "Organiser" });
  const add = async (title: string, places: ReturnType<typeof place>[]) => (ideas[title] = (await call(owner, "POST", "/ideas", { title, places })).body.id);
  await add("Lisbon", [place("Lisbon", "Portugal", "PT")]);
  await add("Istanbul", [place("Istanbul", "Turkey", "TR")]);
  await add("Tokyo", [place("Tokyo", "Japan", "JP")]);
  await add("Somewhere", []);
});

describe("a round narrowed to Europe", () => {
  it("needs 2 ideas in the continents picked", async () => {
    const res = await call(owner, "POST", "/rounds", { points_per_person: 10, filters: { continents: ["oceania"] } });
    expect(res.status).toBe(400);
  });

  it("only lets points go on ideas in Europe", async () => {
    const round = (await call(owner, "POST", "/rounds", { points_per_person: 10, filters: { continents: ["europe", "atlantis"] } })).body.id;
    const rounds = (await call(owner, "GET", "/rounds")).body;
    expect(rounds[0].filters.continents).toEqual(["europe"]);
    expect((await call(owner, "PUT", `/rounds/${round}/allocations`, { allocations: [{ idea_id: ideas.Tokyo, points: 10 }] })).status).toBe(400);
    expect((await call(owner, "PUT", `/rounds/${round}/allocations`, { allocations: [{ idea_id: ideas.Somewhere, points: 10 }] })).status).toBe(400);
    const ok = await call(owner, "PUT", `/rounds/${round}/allocations`, { allocations: [{ idea_id: ideas.Lisbon, points: 4 }, { idea_id: ideas.Istanbul, points: 6 }] });
    expect(ok.status).toBe(200);
  });
});
