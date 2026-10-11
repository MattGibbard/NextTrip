import { describe, expect, it } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { sqliteD1 } from "./sqliteD1";
import { cleanTripDates, stayDates, tripDatesLabel } from "../shared/tripDates";
import { flightLink } from "../shared/flights";
import { hotelLink } from "../shared/hotels";
import { datesOf, draftOf } from "../src/components/TripDatesField";

describe("cleanTripDates", () => {
  it("keeps exact dates and months, from objects or stored JSON", () => {
    expect(cleanTripDates({ kind: "exact", start: "2027-07-12", end: "2027-07-19" })).toEqual({ kind: "exact", start: "2027-07-12", end: "2027-07-19" });
    expect(cleanTripDates('{"kind":"month","month":"2027-07"}')).toEqual({ kind: "month", month: "2027-07" });
  });

  it("drops anything else", () => {
    for (const bad of [null, "", "nope", {}, { kind: "exact", start: "2027-07-19", end: "2027-07-12" }, { kind: "exact", start: "2027-02-30", end: "2027-03-02" }, { kind: "month", month: "2027-13" }, { kind: "month", month: "July" }]) {
      expect(cleanTripDates(bad)).toBeNull();
    }
  });
});

describe("stayDates", () => {
  it("uses exact dates as they are", () => {
    expect(stayDates({ kind: "exact", start: "2027-07-12", end: "2027-07-19" }, "weekend")).toEqual({ start: "2027-07-12", end: "2027-07-19" });
  });

  it("starts a month on the 1st and stays for the idea's trip length", () => {
    const july = { kind: "month", month: "2027-07" } as const;
    expect(stayDates(july, "weekend")).toEqual({ start: "2027-07-01", end: "2027-07-04" });
    expect(stayDates(july, "week")).toEqual({ start: "2027-07-01", end: "2027-07-08" });
    expect(stayDates(july, "two-weeks")).toEqual({ start: "2027-07-01", end: "2027-07-15" });
    expect(stayDates({ kind: "month", month: "2027-12" }, "longer")).toEqual({ start: "2027-12-01", end: "2027-12-22" });
    // No trip length on the idea: a week.
    expect(stayDates(july, null)).toEqual({ start: "2027-07-01", end: "2027-07-08" });
  });

  it("is nothing without dates", () => {
    expect(stayDates(null, "week")).toBeNull();
  });
});

describe("tripDatesLabel", () => {
  it("reads naturally", () => {
    expect(tripDatesLabel({ kind: "exact", start: "2027-07-12", end: "2027-07-19" })).toBe("12–19 Jul 2027");
    expect(tripDatesLabel({ kind: "exact", start: "2027-07-28", end: "2027-08-04" })).toBe("28 Jul – 4 Aug 2027");
    expect(tripDatesLabel({ kind: "exact", start: "2027-12-30", end: "2028-01-06" })).toBe("30 Dec 2027 – 6 Jan 2028");
    expect(tripDatesLabel({ kind: "month", month: "2027-07" })).toBe("July 2027");
  });
});

describe("links with dates", () => {
  const dates = { start: "2027-07-01", end: "2027-07-08" };

  it("searches Aviasales for that return trip", () => {
    const u = new URL(new URL(flightLink("LHR", "BCN", 4, "draw_result", { dates })).searchParams.get("u")!);
    expect(u.searchParams.get("params")).toBe("LHR0107BCN08074");
  });

  it("opens Stay22 on those check-in and check-out dates", () => {
    const url = new URL(hotelLink({ name: "Barcelona", country: "Spain", country_code: "ES", lat: 41.4, lon: 2.2 }, "draw_result", { dates }));
    expect(url.searchParams.get("checkin")).toBe("2027-07-01");
    expect(url.searchParams.get("checkout")).toBe("2027-07-08");
  });

  it("leaves dates out when there are none", () => {
    const url = new URL(hotelLink({ name: "Barcelona", country: "Spain", country_code: "ES", lat: 41.4, lon: 2.2 }, "draw_result"));
    expect(url.searchParams.has("checkin")).toBe(false);
  });
});

describe("the dates form", () => {
  it("treats empty as no dates and flags half-filled or backwards ones", () => {
    const empty = draftOf(null);
    expect(datesOf(empty)).toEqual({ dates: null });
    expect(datesOf({ ...empty, start: "2027-07-12" }).error).toBeTruthy();
    expect(datesOf({ ...empty, start: "2027-07-12", end: "2027-07-12" }).error).toBeTruthy();
    expect(datesOf({ ...empty, kind: "month", month: "07", year: "2027" })).toEqual({ dates: { kind: "month", month: "2027-07" } });
    expect(draftOf({ kind: "month", month: "2027-07" })).toMatchObject({ kind: "month", month: "07", year: "2027" });
  });
});

describe("round dates API", () => {
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

  it("saves dates when a round starts and lets them change or go later", async () => {
    const { body } = await call(null, "POST", "/auth/email", { email: "dates@example.com" });
    const token = new URL(body.dev_link).searchParams.get("token");
    const cookie = (await call(null, "POST", "/auth/verify", { token })).setCookie!.split(";")[0];
    await call(cookie, "POST", "/people", { name: "Sam" });
    for (const n of [1, 2]) await call(cookie, "POST", "/ideas", { title: `Idea ${n}`, places: [] });

    const exact = { kind: "exact", start: "2027-07-12", end: "2027-07-19" };
    const id = (await call(cookie, "POST", "/rounds", { points_per_person: 10, trip_dates: exact })).body.id;
    const get = async () => (await call(cookie, "GET", "/rounds")).body.find((r: { id: number }) => r.id === id).trip_dates;
    expect(await get()).toEqual(exact);

    expect((await call(cookie, "PUT", `/rounds/${id}/dates`, { trip_dates: { kind: "month", month: "2027-08" } })).status).toBe(200);
    expect(await get()).toEqual({ kind: "month", month: "2027-08" });

    expect((await call(cookie, "PUT", `/rounds/${id}/dates`, { trip_dates: { kind: "month", month: "nope" } })).status).toBe(400);
    expect(await get()).toEqual({ kind: "month", month: "2027-08" });

    await call(cookie, "PUT", `/rounds/${id}/dates`, { trip_dates: null });
    expect(await get()).toBeNull();
  });
});
