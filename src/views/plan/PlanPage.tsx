// A won idea's trip plan: the boarding pass folded into a header with a countdown, then four tabs.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useData } from "../../data";
import { flagsOf } from "../../countries";
import { currencyFor } from "../../../shared/currency";
import { MODES, ideaMode, ticketEnds } from "../../../shared/travelMode";
import type { Mode } from "../../../shared/travelMode";
import { tripLengthLabel } from "../../../shared/ideaDetails";
import { daysUntil, formatMoney, planDays, tripSpanLabel } from "../../../shared/plan";
import type { TripPlan } from "../../../shared/plan";
import { PLAN_TABS, dayLabel, planHref, todayIso } from "./context";
import type { PlanCtx, PlanTab } from "./context";
import { PlanOverview } from "./PlanOverview";
import { PlanItinerary } from "./PlanItinerary";
import { PlanCosts } from "./PlanCosts";
import { PlanPacking } from "./PlanPacking";
import { DatesSheet } from "./sheets";

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

export function PlanPage({ id, tab }: { id: number; tab: PlanTab }) {
  const { ideas, rounds, people, me, home } = useData();
  const idea = ideas.find((i) => i.id === id);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDates, setEditingDates] = useState(false);

  const load = useCallback(async () => {
    const p = await api.plan(id);
    setPlan(p);
  }, [id]);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  const round = useMemo(() => rounds.find((r) => r.status === "drawn" && r.winner_idea_id === id) ?? null, [rounds, id]);
  const currency = currencyFor(home?.country_code);

  const run = useCallback(
    async (save: () => Promise<unknown>, onError?: (message: string) => void) => {
      try {
        await save();
        setError(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (onError) onError(message);
        else setError(message);
        return false;
      } finally {
        // Load again either way: someone else may have changed it, which is often why a save fails.
        await load().catch(() => {});
      }
      return true;
    },
    [load],
  );

  if (!idea) {
    return (
      <section>
        <a className="back-link" href="#/next">
          ← Next
        </a>
        <p className="muted center">This idea has been deleted.</p>
      </section>
    );
  }

  if (idea.status !== "won" && idea.status !== "done") {
    return (
      <section>
        <a className="back-link" href={`#/next/${id}`}>
          ← {idea.title}
        </a>
        <p className="muted center">Trip plans open once an idea wins a draw.</p>
      </section>
    );
  }

  const dates = round?.trip_dates ?? null;
  const ctx: PlanCtx | null = plan && {
    idea,
    plan,
    round,
    dates,
    days: planDays(plan, dates, idea.trip_length),
    people,
    me,
    money: (minor) => formatMoney(minor, currency),
    currency,
    run,
    patch: (f) => setPlan((p) => (p ? f(p) : p)),
  };

  return (
    <section className="plan-page">
      <a className="back-link" href="#/next">
        ← Next
      </a>
      <PlanHeader idea={idea} dates={dates} round={round} people={people.map((p) => p.name)} onDates={round ? () => setEditingDates(true) : undefined} home={home} />

      <nav className="plan-tabs" aria-label="Trip plan">
        {PLAN_TABS.map((t) => (
          <a key={t.id} href={planHref(id, t.id)} className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "page" : undefined}>
            {t.label}
            {ctx && <TabCount ctx={ctx} tab={t.id} />}
          </a>
        ))}
      </nav>

      {error && (
        <div className="banner error">
          {error}{" "}
          {!plan && (
            <button className="link" onClick={() => load().then(() => setError(null), (e: Error) => setError(e.message))}>
              Retry
            </button>
          )}
        </div>
      )}

      {!ctx ? (
        !error && <p className="muted center">Loading your plan…</p>
      ) : (
        <>
          {tab === "overview" && <PlanOverview ctx={ctx} />}
          {tab === "itinerary" && <PlanItinerary ctx={ctx} onDates={round ? () => setEditingDates(true) : undefined} />}
          {tab === "costs" && <PlanCosts ctx={ctx} />}
          {tab === "packing" && <PlanPacking ctx={ctx} />}
        </>
      )}
      {editingDates && ctx && <DatesSheet ctx={ctx} onClose={() => setEditingDates(false)} />}
    </section>
  );
}

function TabCount({ ctx, tab }: { ctx: PlanCtx; tab: PlanTab }) {
  const { plan } = ctx;
  if (tab === "itinerary") return <span className="count">{ctx.days} DAYS</span>;
  if (tab === "costs" && plan.costs.length) return <span className="count">{ctx.money(plan.costs.reduce((n, c) => n + c.amount, 0))}</span>;
  if (tab === "packing" && plan.packing.length) return <span className="count">{`${plan.packing.filter((p) => p.packed).length}/${plan.packing.length}`}</span>;
  return null;
}

/** The won boarding pass, folded into a strip: where, when, who, and the days to go. */
function PlanHeader({
  idea,
  dates,
  round,
  people,
  onDates,
  home,
}: {
  idea: PlanCtx["idea"];
  dates: PlanCtx["dates"];
  round: PlanCtx["round"];
  people: string[];
  onDates?: () => void;
  home: ReturnType<typeof useData>["home"];
}) {
  const mode = ideaMode(idea.holiday_types);
  const arrival: Mode = mode === "train" ? "train" : mode === "cruise" && idea.depart ? "cruise" : "flight";
  const ends = ticketEnds(idea.depart || idea.arrive ? mode : arrival, idea, home);
  const flags = flagsOf(idea.places);
  const toGo = daysUntil(dates, todayIso());
  const route = [
    ends ? `${ends.from.code} ${MODES[arrival].icon} ${ends.to.code}` : null,
    mode === "road" || mode === "cruise" ? `${MODES[mode].icon} ${idea.places.length} STOPS` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const when =
    dates?.kind === "exact" ? (
      <>
        {dayLabel(dates.start)} – {dayLabel(dates.end)}
      </>
    ) : dates?.kind === "month" ? (
      MONTH.format(new Date(`${dates.month}-01T00:00:00Z`))
    ) : (
      "Not set yet"
    );

  return (
    <section className="plan-pass" aria-label="Boarding pass">
      <div className="plan-pass-main">
        <div className="plan-pass-head">
          <span className="mono-label">TRIP PLAN{round?.winning_ticket && round.total_tickets ? ` · TICKET ${round.winning_ticket} / ${round.total_tickets}` : ""}</span>
          {round && <span className="departure-badge">🏆 Won in the {round.name} draw</span>}
        </div>
        <div className="plan-pass-title">
          <h1>
            {flags} {idea.title}
          </h1>
          {route && <span className="plan-pass-route">{route}</span>}
        </div>
        <div className="plan-pass-fields">
          <div>
            <div className="mono-label">WHEN</div>
            <div className="tk-value">
              {when}
              {onDates && (
                <button type="button" className="plan-pass-edit" onClick={onDates}>
                  {dates?.kind === "exact" ? "Change" : "Set dates"}
                </button>
              )}
            </div>
          </div>
          <div className="desktop-only">
            <div className="mono-label">LENGTH</div>
            <div className="tk-value">{tripSpanLabel(dates) ?? tripLengthLabel(idea.trip_length) ?? "—"}</div>
          </div>
          <div className="desktop-only">
            <div className="mono-label">PASSENGERS</div>
            <div className="tk-value">{people.join(" & ") || "—"}</div>
          </div>
        </div>
      </div>
      {toGo !== null && toGo >= 0 && (
        <div className="plan-pass-side">
          <span className="mono-label">{toGo === 0 ? "DEPARTS" : "DEPARTS IN"}</span>
          {toGo === 0 ? (
            <span className="plan-today">TODAY</span>
          ) : (
            <>
              <div className="plan-flaps" aria-label={`${toGo} days`}>
                {String(toGo)
                  .split("")
                  .map((d, i) => (
                    <span key={i} className="plan-flap" aria-hidden>
                      {d}
                    </span>
                  ))}
              </div>
              <span className="mono-label">{toGo === 1 ? "DAY" : "DAYS"}</span>
            </>
          )}
        </div>
      )}
    </section>
  );
}
