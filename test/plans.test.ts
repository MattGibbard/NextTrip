// The trip plan API: anyone in the family can plan a won idea, nobody else can touch it.
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

const cookieFrom = (setCookie: string | null) => setCookie!.split(";")[0];

interface Family {
  owner: string;
  member: string;
  person: number;
  memberPerson: number;
  won: number;
  pool: number;
}

async function makeFamily(email: string, label: string): Promise<Family> {
  const { body } = await call(null, "POST", "/auth/email", { email });
  const token = new URL(body.dev_link).searchParams.get("token");
  const owner = cookieFrom((await call(null, "POST", "/auth/verify", { token })).setCookie);
  const person = (await call(owner, "POST", "/people", { name: `${label} organiser` })).body.id;
  const share = (await call(owner, "GET", "/auth/me")).body.share_token;
  const member = cookieFrom((await call(null, "POST", "/auth/join", { token: share })).setCookie);
  const memberPerson = (await call(member, "POST", "/people", { name: `${label} member` })).body.id;
  const won = (await call(owner, "POST", "/ideas", { title: `${label} winner`, places: [], trip_length: "weekend" })).body.id;
  const pool = (await call(owner, "POST", "/ideas", { title: `${label} still in the pool`, places: [] })).body.id;
  // Winning a draw is tested elsewhere; here the idea just needs to have won.
  await env.DB.prepare("UPDATE ideas SET status = 'won' WHERE id = ?").bind(won).run();
  return { owner, member, person, memberPerson, won, pool };
}

let a: Family;
let b: Family;

beforeAll(async () => {
  a = await makeFamily("plan-a@example.com", "Alpha");
  b = await makeFamily("plan-b@example.com", "Bravo");
});

describe("a family planning its winner", () => {
  it("starts with an empty plan", async () => {
    const res = await call(a.member, "GET", `/plans/${a.won}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idea_id: a.won, budget: null, days: null, day_titles: {}, items: [], costs: [], settlements: [], packing: [], todos: [] });
  });

  it("only plans ideas that won a draw", async () => {
    expect((await call(a.owner, "GET", `/plans/${a.pool}`)).status).toBe(400);
    expect((await call(a.owner, "POST", `/plans/${a.pool}/todos`, { label: "Too soon" })).status).toBe(400);
  });

  it("sets a budget and the number of days, and names a day", async () => {
    expect((await call(a.member, "PUT", `/plans/${a.won}`, { budget: 600000 })).status).toBe(200);
    expect((await call(a.member, "PUT", `/plans/${a.won}`, { days: 9 })).status).toBe(200);
    expect((await call(a.member, "PUT", `/plans/${a.won}/days/1`, { title: "Fly out" })).status).toBe(200);
    const plan = (await call(a.owner, "GET", `/plans/${a.won}`)).body;
    expect(plan).toMatchObject({ budget: 600000, days: 9, day_titles: { 1: "Fly out" } });
    // An empty name clears it.
    await call(a.member, "PUT", `/plans/${a.won}/days/1`, { title: " " });
    expect((await call(a.owner, "GET", `/plans/${a.won}`)).body.day_titles).toEqual({});
  });

  it("adds, changes and deletes things on a day, in time order", async () => {
    const later = (await call(a.member, "POST", `/plans/${a.won}/items`, { day: 2, time: "15:00", title: "Check in", status: "booked" })).body.id;
    const sooner = (await call(a.member, "POST", `/plans/${a.won}/items`, { day: 2, time: "09:00", title: "Breakfast", status: "nonsense" })).body.id;
    let items = (await call(a.owner, "GET", `/plans/${a.won}`)).body.items;
    expect(items.map((i: { id: number }) => i.id)).toEqual([sooner, later]);
    expect(items[0].status).toBe("plan");
    expect((await call(a.member, "PUT", `/plans/${a.won}/items/${sooner}`, { day: 2, time: "09:00", title: "Brunch", status: "to_book" })).status).toBe(200);
    expect((await call(a.member, "POST", `/plans/${a.won}/items`, { day: 99, title: "Too far" })).status).toBe(400);
    expect((await call(a.member, "POST", `/plans/${a.won}/items`, { day: 2, title: "" })).status).toBe(400);
    // The itinerary can't be cut short of a day that has things on it.
    expect((await call(a.member, "PUT", `/plans/${a.won}`, { days: 1 })).status).toBe(409);
    // Anyone in the family can delete.
    expect((await call(a.member, "DELETE", `/plans/${a.won}/items/${later}`)).status).toBe(200);
    items = (await call(a.owner, "GET", `/plans/${a.won}`)).body.items;
    expect(items).toEqual([{ id: sooner, day: 2, time: "09:00", title: "Brunch", notes: null, status: "to_book" }]);
  });

  it("records costs and paying back, dropping the payer from an estimate", async () => {
    const flights = (await call(a.member, "POST", `/plans/${a.won}/costs`, { title: "Flights", amount: 184000, category: "travel", status: "booked", paid_by: a.person })).body.id;
    const hotel = (await call(a.member, "POST", `/plans/${a.won}/costs`, { title: "Hotel", amount: 52000, category: "stays", status: "estimate", paid_by: a.person, day: 3 })).body.id;
    expect((await call(a.member, "POST", `/plans/${a.won}/costs`, { title: "Free", amount: 0 })).status).toBe(400);
    expect((await call(a.member, "POST", `/plans/${a.won}/costs`, { title: "Pennies", amount: 1.5 })).status).toBe(400);
    const back = (await call(a.member, "POST", `/plans/${a.won}/settlements`, { from_person: a.memberPerson, to_person: a.person, amount: 92000 })).body.id;
    expect((await call(a.member, "POST", `/plans/${a.won}/settlements`, { from_person: a.person, to_person: a.person, amount: 100 })).status).toBe(400);
    const plan = (await call(a.owner, "GET", `/plans/${a.won}`)).body;
    expect(plan.costs).toEqual([
      { id: flights, title: "Flights", amount: 184000, category: "travel", status: "booked", day: null, paid_by: a.person },
      { id: hotel, title: "Hotel", amount: 52000, category: "stays", status: "estimate", day: 3, paid_by: null },
    ]);
    expect(plan.settlements).toMatchObject([{ id: back, from_person: a.memberPerson, to_person: a.person, amount: 92000 }]);
    expect((await call(a.member, "DELETE", `/plans/${a.won}/settlements/${back}`)).status).toBe(200);
    expect((await call(a.member, "DELETE", `/plans/${a.won}/costs/${hotel}`)).status).toBe(200);
  });

  it("keeps a packing list per person and ticks things off", async () => {
    const mine = (await call(a.member, "POST", `/plans/${a.won}/packing`, { label: "Passport", person_id: a.memberPerson })).body.id;
    const shared = (await call(a.member, "POST", `/plans/${a.won}/packing`, { label: "Plug adapters" })).body.id;
    expect((await call(a.member, "PUT", `/plans/${a.won}/packing/${mine}`, { label: "Passport", person_id: a.memberPerson, packed: true })).status).toBe(200);
    const plan = (await call(a.owner, "GET", `/plans/${a.won}`)).body;
    expect(plan.packing).toEqual([
      { id: mine, label: "Passport", person_id: a.memberPerson, packed: true },
      { id: shared, label: "Plug adapters", person_id: null, packed: false },
    ]);
  });

  it("adds a ready-made list in one go", async () => {
    const before = (await call(a.owner, "GET", `/plans/${a.won}`)).body;
    const packing = [
      { label: "Swimwear", person_id: a.person },
      { label: "Swimwear", person_id: a.memberPerson },
      { label: "Sun cream", person_id: null },
    ];
    expect((await call(a.member, "POST", `/plans/${a.won}/packing/many`, { items: packing })).body).toEqual({ added: 3 });
    const todos = [{ label: "Buy travel insurance", due: "2027-06-01" }, { label: "Pack!" }];
    expect((await call(a.member, "POST", `/plans/${a.won}/todos/many`, { items: todos })).body).toEqual({ added: 2 });
    const plan = (await call(a.owner, "GET", `/plans/${a.won}`)).body;
    expect(plan.packing.slice(before.packing.length)).toMatchObject(packing.map((p) => ({ ...p, packed: false })));
    expect(plan.todos.filter((t: { label: string }) => t.label === "Buy travel insurance")).toMatchObject([{ due: "2027-06-01", done: false }]);
    // Nothing is added when one of them is wrong, or the list isn't a list.
    expect((await call(a.member, "POST", `/plans/${a.won}/packing/many`, { items: [{ label: "Fine" }, { label: " " }] })).status).toBe(400);
    expect((await call(a.member, "POST", `/plans/${a.won}/todos/many`, { items: "Pack!" })).status).toBe(400);
    expect((await call(a.member, "POST", `/plans/${a.won}/todos/many`, { items: Array.from({ length: 301 }, () => ({ label: "x" })) })).status).toBe(400);
    expect((await call(a.owner, "GET", `/plans/${a.won}`)).body.packing.length).toBe(plan.packing.length);
    // Cleans up so the tests below see what they expect.
    for (const p of plan.packing.slice(before.packing.length)) await call(a.member, "DELETE", `/plans/${a.won}/packing/${p.id}`);
    for (const t of plan.todos) await call(a.member, "DELETE", `/plans/${a.won}/todos/${t.id}`);
  });

  it("lists jobs to do, soonest first and done last", async () => {
    const late = (await call(a.member, "POST", `/plans/${a.won}/todos`, { label: "Order dollars", person_id: a.person, due: "2027-08-07" })).body.id;
    const soon = (await call(a.member, "POST", `/plans/${a.won}/todos`, { label: "Apply for eTAs", due: "2027-07-01" })).body.id;
    const done = (await call(a.member, "POST", `/plans/${a.won}/todos`, { label: "Book flights", done: true, due: "not a date" })).body.id;
    const todos = (await call(a.owner, "GET", `/plans/${a.won}`)).body.todos;
    expect(todos.map((t: { id: number }) => t.id)).toEqual([soon, late, done]);
    expect(todos[2]).toMatchObject({ done: true, due: null });
    expect((await call(a.member, "PUT", `/plans/${a.won}/todos/${soon}`, { label: "Apply for eTAs", done: true })).status).toBe(200);
    expect((await call(a.member, "DELETE", `/plans/${a.won}/todos/${late}`)).status).toBe(200);
  });
});

describe("another family", () => {
  it("can't see, change or delete the plan by guessing ids", async () => {
    const before = (await call(a.owner, "GET", `/plans/${a.won}`)).body;
    const item = before.items[0].id;
    const cost = before.costs[0].id;
    const pack = before.packing[0].id;
    const todo = before.todos[0].id;
    const tries: [string, string, unknown?][] = [
      ["GET", `/plans/${a.won}`],
      ["PUT", `/plans/${a.won}`, { budget: 1 }],
      ["PUT", `/plans/${a.won}/days/1`, { title: "Hijacked" }],
      ["POST", `/plans/${a.won}/items`, { day: 1, title: "Hijacked" }],
      ["PUT", `/plans/${a.won}/items/${item}`, { day: 1, title: "Hijacked" }],
      ["DELETE", `/plans/${a.won}/items/${item}`],
      ["POST", `/plans/${a.won}/costs`, { title: "Hijacked", amount: 100 }],
      ["PUT", `/plans/${a.won}/costs/${cost}`, { title: "Hijacked", amount: 100 }],
      ["DELETE", `/plans/${a.won}/costs/${cost}`],
      ["POST", `/plans/${a.won}/settlements`, { from_person: a.person, to_person: a.memberPerson, amount: 100 }],
      ["POST", `/plans/${a.won}/packing`, { label: "Hijacked" }],
      ["POST", `/plans/${a.won}/packing/many`, { items: [{ label: "Hijacked" }] }],
      ["POST", `/plans/${a.won}/todos/many`, { items: [{ label: "Hijacked" }] }],
      ["PUT", `/plans/${a.won}/packing/${pack}`, { label: "Hijacked" }],
      ["DELETE", `/plans/${a.won}/packing/${pack}`],
      ["POST", `/plans/${a.won}/todos`, { label: "Hijacked" }],
      ["PUT", `/plans/${a.won}/todos/${todo}`, { label: "Hijacked" }],
      ["DELETE", `/plans/${a.won}/todos/${todo}`],
      // Their own plan's address with the other family's rows.
      ["PUT", `/plans/${b.won}/items/${item}`, { day: 1, title: "Hijacked" }],
      ["DELETE", `/plans/${b.won}/costs/${cost}`],
      ["PUT", `/plans/${b.won}/packing/${pack}`, { label: "Hijacked" }],
      ["DELETE", `/plans/${b.won}/todos/${todo}`],
    ];
    for (const who of [b.owner, b.member]) {
      for (const [method, path, json] of tries) {
        const res = await call(who, method, path, json);
        expect(res.status, `${method} ${path} gave ${res.status}`).toBe(404);
      }
    }
    expect((await call(a.owner, "GET", `/plans/${a.won}`)).body).toEqual(before);
  });

  it("can't name the other family's people on its own plan", async () => {
    await call(b.member, "POST", `/plans/${b.won}/costs`, { title: "Sneaky", amount: 100, paid_by: a.person });
    await call(b.member, "POST", `/plans/${b.won}/packing`, { label: "Sneaky", person_id: a.person });
    await call(b.member, "POST", `/plans/${b.won}/todos`, { label: "Sneaky", person_id: a.person });
    expect((await call(b.member, "POST", `/plans/${b.won}/settlements`, { from_person: a.person, to_person: b.person, amount: 100 })).status).toBe(400);
    const plan = (await call(b.owner, "GET", `/plans/${b.won}`)).body;
    expect(plan.costs[0].paid_by).toBeNull();
    expect(plan.packing[0].person_id).toBeNull();
    expect(plan.todos[0].person_id).toBeNull();
  });

  it("can't name the other family's people in a ready-made list", async () => {
    await call(b.member, "POST", `/plans/${b.won}/packing/many`, { items: [{ label: "Sneaky list", person_id: a.person }] });
    await call(b.member, "POST", `/plans/${b.won}/todos/many`, { items: [{ label: "Sneaky list", person_id: a.memberPerson }] });
    const plan = (await call(b.owner, "GET", `/plans/${b.won}`)).body;
    expect(plan.packing.find((p: { label: string }) => p.label === "Sneaky list").person_id).toBeNull();
    expect(plan.todos.find((t: { label: string }) => t.label === "Sneaky list").person_id).toBeNull();
  });

  it("needs a sign-in", async () => {
    expect((await call(null, "GET", `/plans/${a.won}`)).status).toBe(401);
  });
});

it("goes when the family deletes its account", async () => {
  expect((await call(b.owner, "DELETE", "/family", { confirm: "DELETE" })).status).toBe(200);
  for (const t of ["plans", "plan_days", "plan_items", "plan_costs", "plan_settlements", "plan_packing", "plan_todos"]) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE idea_id = ?`).bind(b.won).first<{ n: number }>();
    expect(row!.n, t).toBe(0);
  }
  // The other family's plan is untouched.
  expect((await call(a.owner, "GET", `/plans/${a.won}`)).body.costs).toHaveLength(1);
});
