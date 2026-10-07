// Two families share one database. Each signs in, then one tries every API
// route against the other's ids, as someone guessing numbers in URLs would.
import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";

/** Just enough of D1 on top of SQLite to run the Worker for real. */
function sqliteD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const statement = (sql: string, params: unknown[] = []) => ({
    sql,
    params,
    bind: (...p: unknown[]) => statement(sql, p),
    async first<T>() {
      return (sqlite.prepare(sql).get(...(params as never[])) as T) ?? null;
    },
    async all<T>() {
      return { results: sqlite.prepare(sql).all(...(params as never[])) as T[], success: true, meta: {} };
    },
    async run() {
      return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...(params as never[])).changes) } };
    },
  });
  type Stmt = ReturnType<typeof statement>;
  return {
    prepare: (sql: string) => statement(sql),
    async batch(stmts: Stmt[]) {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) {
          const st = sqlite.prepare(s.sql);
          out.push(st.columns().length ? { results: st.all(...(s.params as never[])) } : { meta: { changes: Number(st.run(...(s.params as never[])).changes) } });
        }
        sqlite.exec("COMMIT");
        return out;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  } as unknown as D1Database;
}

const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1" } as Env;

async function call(cookie: string | null, method: string, path: string, json?: unknown, headers: Record<string, string> = {}) {
  const res = await worker.fetch(
    new Request(`https://somewhere.party/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: json === undefined ? undefined : JSON.stringify(json),
    }),
    env,
    {} as ExecutionContext,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.get("Set-Cookie") };
}

const cookieFrom = (setCookie: string | null) => setCookie!.split(";")[0];

async function signInOrganiser(email: string) {
  const { body } = await call(null, "POST", "/auth/email", { email });
  const token = new URL(body.dev_link).searchParams.get("token");
  return cookieFrom((await call(null, "POST", "/auth/verify", { token })).setCookie);
}

type Family = {
  owner: string;
  member: string;
  person: number;
  memberPerson: number;
  ideas: number[];
  trip: number;
  round: number;
};

const place = (name: string) => ({ name, country: "France", country_code: "FR", lat: 48.8, lon: 2.3 });

async function makeFamily(email: string, label: string): Promise<Family> {
  const owner = await signInOrganiser(email);
  const person = (await call(owner, "POST", "/people", { name: `${label} organiser` })).body.id;
  await call(owner, "PUT", "/home-ends", { airport: { kind: "airport", code: "LHR", name: `${label} airport`, lat: 51.47, lon: -0.45 } });
  const ideas = [];
  for (const n of [1, 2, 3]) {
    ideas.push((await call(owner, "POST", "/ideas", { title: `${label} idea ${n}`, places: [place(`${label} town ${n}`)] })).body.id);
  }
  const trip = (await call(owner, "POST", "/trips", { title: `${label} trip`, notes: `${label} secret notes`, places: [place(`${label} trip town`)] })).body.id;
  const round = (await call(owner, "POST", "/rounds", { points_per_person: 10 })).body.id;
  await call(owner, "PUT", `/rounds/${round}/allocations`, { allocations: [{ idea_id: ideas[0], points: 10 }] });
  await call(owner, "POST", `/rounds/${round}/veto`, { idea_id: ideas[1] });
  // A family member who joined through the family link.
  const share = (await call(owner, "GET", "/auth/me")).body.share_token;
  const member = cookieFrom((await call(null, "POST", "/auth/join", { token: share })).setCookie);
  const memberPerson = (await call(member, "POST", "/people", { name: `${label} member` })).body.id;
  return { owner, member, person, memberPerson, ideas, trip, round };
}

/** Everything family A can see, to check nothing changed after B's attempts. */
async function snapshot(f: Family) {
  const paths = ["/people", "/trips", "/ideas", "/rounds", "/home-ends"];
  return Object.fromEntries(await Promise.all(paths.map(async (p) => [p, (await call(f.owner, "GET", p)).body])));
}

let a: Family;
let b: Family;
let before: Awaited<ReturnType<typeof snapshot>>;

beforeAll(async () => {
  a = await makeFamily("alpha@example.com", "Alpha");
  b = await makeFamily("bravo@example.com", "Bravo");
  before = await snapshot(a);
});

it("sets both families up with their own data", () => {
  expect(before["/trips"]).toHaveLength(1);
  expect(before["/ideas"]).toHaveLength(3);
  expect(before["/people"]).toHaveLength(2);
  expect(before["/rounds"][0].allocations).toEqual([{ person_id: a.person, idea_id: a.ideas[0], points: 10 }]);
  expect(b.trip).not.toBe(a.trip);
});

it("refuses every API call without a sign-in", async () => {
  for (const path of ["/people", "/trips", "/ideas", "/rounds", "/home-ends", `/trips/${a.trip}`]) {
    expect((await call(null, "GET", path)).status).toBe(401);
  }
});

describe.each(["owner", "member"] as const)("a signed-in %s of another family", (role) => {
  const as = () => b[role];

  it("sees none of the other family's data in any list", async () => {
    const lists = await Promise.all(["/people", "/trips", "/ideas", "/rounds", "/home-ends"].map(async (p) => JSON.stringify((await call(as(), "GET", p)).body)));
    for (const text of lists) {
      expect(text).not.toContain("Alpha");
    }
  });

  it("can't change or delete the other family's trips, ideas, people or draws by id", async () => {
    const tries: [string, string, unknown?][] = [
      ["PUT", `/trips/${a.trip}`, { title: "Hijacked", places: [] }],
      ["DELETE", `/trips/${a.trip}`],
      ["PUT", `/ideas/${a.ideas[0]}`, { title: "Hijacked", places: [] }],
      ["DELETE", `/ideas/${a.ideas[0]}`],
      ["PUT", `/people/${a.person}`, { name: "Hijacked" }],
      ["DELETE", `/people/${a.person}`],
      ["POST", "/me", { person_id: a.person }],
      ["POST", `/family/people/${a.person}/link`],
      ["POST", `/family/people/${a.person}/sign-out`],
      ["DELETE", `/rounds/${a.round}`],
      ["PUT", `/rounds/${a.round}/allocations`, { allocations: [{ idea_id: a.ideas[0], points: 10 }] }],
      ["POST", `/rounds/${a.round}/lock`],
      ["DELETE", `/rounds/${a.round}/lock`],
      ["PUT", `/rounds/${a.round}/swipes`, { idea_id: a.ideas[0], liked: true }],
      ["POST", `/rounds/${a.round}/veto`, { idea_id: a.ideas[2] }],
      ["DELETE", `/rounds/${a.round}/veto`],
      ["POST", `/rounds/${a.round}/draw`],
    ];
    for (const [method, path, json] of tries) {
      const res = await call(as(), method, path, json);
      // Members are turned away from organiser-only routes before the id is even looked at.
      expect([403, 404], `${method} ${path} gave ${res.status}`).toContain(res.status);
    }
    expect(await snapshot(a)).toEqual(before);
  });

  it("can't attach the other family's ideas or people to its own trips, ideas and draws", async () => {
    const trip = (await call(as(), "POST", "/trips", { title: `${role} trip`, idea_id: a.ideas[0], created_by: a.person, places: [] })).body.id;
    const idea = (await call(as(), "POST", "/ideas", { title: `${role} idea`, created_by: a.person, places: [] })).body.id;
    const mine = role === "owner" ? b.person : b.memberPerson;
    const trips = (await call(as(), "GET", "/trips")).body;
    expect(trips.find((t: { id: number }) => t.id === trip)).toMatchObject({ idea_id: null, created_by: mine });
    const ideas = (await call(as(), "GET", "/ideas")).body;
    expect(ideas.find((i: { id: number }) => i.id === idea)).toMatchObject({ created_by: mine });

    // Their own open round won't take points, swipes or a veto on the other family's ideas.
    expect((await call(as(), "PUT", `/rounds/${b.round}/allocations`, { allocations: [{ idea_id: a.ideas[0], points: 10 }] })).status).toBe(400);
    await call(as(), "DELETE", `/rounds/${b.round}/veto`);
    expect((await call(as(), "POST", `/rounds/${b.round}/veto`, { idea_id: a.ideas[0] })).status).toBe(400);
    expect(await snapshot(a)).toEqual(before);
  });

  it("can't use the other family's family link or person ids to become one of them", async () => {
    // A guessed person id in the old header only counts for that session's own family.
    const me = await call(as(), "GET", "/auth/me", undefined, { "X-Person-Id": String(a.person) });
    expect(me.body.person_id).not.toBe(a.person);
    expect((await call(as(), "POST", "/auth/join", { token: "not-a-real-token" })).status).toBe(404);
    expect((await call(as(), "POST", "/auth/person-link", { token: "not-a-real-token" })).status).toBe(404);
  });
});

it("keeps a legacy session's picked person inside its own family", async () => {
  // Sessions from before people were tied to browsers trust X-Person-Id once, but only within their family.
  await env.DB.prepare("UPDATE sessions SET person_id = NULL, legacy = 1 WHERE role = 'member' AND family_id = (SELECT family_id FROM people WHERE id = ?)").bind(b.memberPerson).run();
  const me = await call(b.member, "GET", "/auth/me", undefined, { "X-Person-Id": String(a.memberPerson) });
  expect(me.body.person_id).toBeNull();
  expect(await snapshot(a)).toEqual(before);
});

it("still lets each family change its own things", async () => {
  expect((await call(a.owner, "PUT", `/trips/${a.trip}`, { title: "Alpha trip renamed", places: [] })).status).toBe(200);
  expect((await call(b.owner, "DELETE", `/ideas/${b.ideas[2]}`)).status).toBe(200);
});
