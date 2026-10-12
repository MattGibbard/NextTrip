// The plan at a glance: the days on a departures board, jobs before you go, the budget,
// packing for each person and what's still to book.
import { useState } from "react";
import { api } from "../../api";
import { BookLinks } from "../../components/BookLinks";
import { ideaMode } from "../../../shared/travelMode";
import { stayDates } from "../../../shared/tripDates";
import { costTotals, dayDate, dayStatus, balances, settleUp, tripOver } from "../../../shared/plan";
import type { PlanItem, PlanTodo } from "../../../shared/plan";
import { planHref, pad2, shortDate, todayIso } from "./context";
import type { PlanCtx } from "./context";
import { Avatar, Bar, OnceButton, Tick } from "./bits";
import { addStarterPacking, addStarterTodos } from "./starter";
import { BudgetSheet, ItemSheet, TodoSheet } from "./sheets";
import { packingGroups } from "./PlanPacking";

const BOARD_NOTE = { booked: "BOOKED", to_book: "TO BOOK", plan: "PLANNED", free: "FREE" } as const;
const BOARD_ROWS = 10;

export function PlanOverview({ ctx }: { ctx: PlanCtx }) {
  const { plan, idea } = ctx;
  const [todo, setTodo] = useState<PlanTodo | "new" | null>(null);
  const [budgeting, setBudgeting] = useState(false);
  const [booking, setBooking] = useState<PlanItem | null>(null);

  const days = Array.from({ length: ctx.days }, (_, i) => i + 1);
  const toBook = plan.items.filter((i) => i.status === "to_book");
  const booked = plan.items.filter((i) => i.status === "booked").length;

  return (
    <div className="plan-cols">
      <div className="plan-main">
        <section className="plan-section">
          <div className="plan-section-head">
            <h2>Your days</h2>
            <a href={planHref(idea.id, "itinerary")}>Open itinerary →</a>
          </div>
          <div className="plan-board">
            <div className="plan-board-row plan-board-headings mono-label" aria-hidden>
              <span>DAY</span>
              <span>WHAT'S ON</span>
              <span className="plan-board-note">STATUS</span>
            </div>
            {days.slice(0, BOARD_ROWS).map((d) => {
              const items = plan.items.filter((i) => i.day === d);
              const status = dayStatus(items);
              const date = dayDate(ctx.dates, d);
              const what = plan.day_titles[d] ?? items[0]?.title ?? "Nothing planned yet";
              return (
                <a key={d} className="plan-board-row" href={`${planHref(idea.id, "itinerary")}`}>
                  <span className="plan-board-num">{pad2(d)}</span>
                  <span className="ellipsis">
                    {date && <span className="plan-board-date">{shortDate(date)} · </span>}
                    {what}
                  </span>
                  <span className={`plan-board-note ${status === "booked" ? "lit" : status === "to_book" ? "warn" : ""}`}>{BOARD_NOTE[status]}</span>
                </a>
              );
            })}
            {days.length > BOARD_ROWS && <div className="plan-board-more mono-label">+ {days.length - BOARD_ROWS} MORE DAYS</div>}
          </div>
        </section>

        <Todos ctx={ctx} onEdit={setTodo} />
      </div>

      <aside className="plan-side">
        {idea.status === "won" && !tripOver(ctx.dates, todayIso()) && (
          <BookLinks
            trip={idea}
            mode={ideaMode(idea.holiday_types)}
            campaign="trip_plan"
            className="panel plan-book"
            dates={stayDates(ctx.dates, idea.trip_length)}
            before={<p className="muted small">For {ctx.people.length === 1 ? "1 person" : `all ${ctx.people.length} of you`}{ctx.dates ? ", on your trip dates" : ""}.</p>}
          />
        )}
        <BudgetPanel ctx={ctx} onBudget={() => setBudgeting(true)} />
        <PackingPanel ctx={ctx} />
        <section className="panel">
          <div className="plan-section-head">
            <h2>Bookings</h2>
            <span className="pill">{booked} booked</span>
          </div>
          {toBook.length === 0 ? (
            <p className="muted small">{plan.items.length ? "Nothing left to book." : "Mark things on your days as To book and they'll show here."}</p>
          ) : (
            <ul className="list plan-flat-list">
              {toBook.slice(0, 5).map((i) => (
                <li key={i.id} className="list-row">
                  <span className="grow">
                    <strong>{i.title}</strong>
                    <br />
                    <span className="mono-label muted">DAY {pad2(i.day)}</span>
                  </span>
                  <button type="button" className="btn small ghost" onClick={() => setBooking(i)}>
                    Booked ✓
                  </button>
                </li>
              ))}
            </ul>
          )}
          {toBook.length > 5 && <p className="muted small">and {toBook.length - 5} more.</p>}
        </section>
      </aside>

      {todo && <TodoSheet ctx={ctx} todo={todo === "new" ? null : todo} onClose={() => setTodo(null)} />}
      {budgeting && <BudgetSheet ctx={ctx} onClose={() => setBudgeting(false)} />}
      {booking && <ItemSheet ctx={ctx} item={booking} day={booking.day} booking onClose={() => setBooking(null)} />}
    </div>
  );
}

function Todos({ ctx, onEdit }: { ctx: PlanCtx; onEdit: (t: PlanTodo | "new") => void }) {
  const { plan, people } = ctx;
  const [showDone, setShowDone] = useState(false);
  const open = plan.todos.filter((t) => !t.done);
  const done = plan.todos.filter((t) => t.done);
  const today = todayIso();

  const toggle = (t: PlanTodo) => {
    ctx.patch((p) => ({ ...p, todos: p.todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) }));
    void ctx.run(() => api.saveTodo(plan.idea_id, t.id, { label: t.label, person_id: t.person_id, due: t.due, done: !t.done }));
  };

  const row = (t: PlanTodo) => {
    const who = people.find((p) => p.id === t.person_id) ?? null;
    const late = !t.done && t.due !== null && t.due < today;
    return (
      <li key={t.id} className={`list-row plan-todo ${t.done ? "done" : ""}`}>
        <Tick on={t.done} label={t.done ? `Not done: ${t.label}` : `Done: ${t.label}`} onToggle={() => toggle(t)} />
        <button type="button" className="plan-row-button grow" onClick={() => onEdit(t)}>
          {t.label}
        </button>
        {t.due && <span className={`small ${late ? "plan-late" : "muted"}`}>{late ? "Overdue" : `by ${shortDate(t.due)}`}</span>}
        {who && <Avatar person={who} />}
      </li>
    );
  };

  return (
    <section className="panel">
      <div className="plan-section-head">
        <div>
          <h2>Before you go</h2>
          <p className="muted small">Things to sort before you leave. Give each one to someone.</p>
        </div>
        {plan.todos.length > 0 && (
          <span className="pill">
            {done.length} of {plan.todos.length} done
          </span>
        )}
      </div>
      {plan.todos.length === 0 ? (
        <p className="muted small">No jobs yet. Start with the usual ones for a family trip, like passports and travel insurance, each with a date to do it by.</p>
      ) : (
        <ul className="list plan-flat-list">
          {open.map(row)}
          {showDone && done.map(row)}
        </ul>
      )}
      <div className="plan-actions">
        {plan.todos.length === 0 && <OnceButton label="Add the usual jobs" busy="Adding…" run={() => addStarterTodos(ctx)} />}
        <button type="button" className="btn small ghost" onClick={() => onEdit("new")}>
          + Add a job
        </button>
        {done.length > 0 && (
          <button type="button" className="link" onClick={() => setShowDone(!showDone)}>
            {showDone ? "Hide done" : `Show ${done.length} done`}
          </button>
        )}
      </div>
    </section>
  );
}

export function BudgetPanel({ ctx, onBudget }: { ctx: PlanCtx; onBudget: () => void }) {
  const { plan, people, me, money } = ctx;
  const totals = costTotals(plan.costs);
  const budget = plan.budget;
  const scale = Math.max(budget ?? 0, totals.total) || 1;
  const owed = settleUp(balances(plan.costs, plan.settlements, people.map((p) => p.id)));
  const name = (id: number) => (id === me?.id ? "You" : (ctx.people.find((p) => p.id === id)?.name ?? "Someone"));
  const first = owed[0];

  return (
    <section className="panel">
      <div className="plan-section-head">
        <h2>Budget</h2>
        <a href={planHref(plan.idea_id, "costs")}>All costs →</a>
      </div>
      <div className="plan-big">
        <span className="plan-stat">{money(totals.total)}</span>
        {budget ? (
          <button type="button" className="link" onClick={onBudget}>
            of {money(budget)}
          </button>
        ) : (
          <button type="button" className="link" onClick={onBudget}>
            Set a budget
          </button>
        )}
      </div>
      <Bar
        label={`${money(totals.booked)} booked, ${money(totals.estimate)} estimated`}
        parts={[
          { share: totals.booked / scale, className: "booked" },
          { share: totals.estimate / scale, className: "estimate" },
        ]}
      />
      <div className="plan-key">
        <span>
          <span className="plan-swatch booked" />
          {money(totals.booked)} booked
        </span>
        <span>
          <span className="plan-swatch estimate" />
          {money(totals.estimate)} estimated
        </span>
        {budget !== null && (
          <span className={totals.total > budget ? "plan-late" : ""}>{totals.total > budget ? `${money(totals.total - budget)} over` : `${money(budget - totals.total)} left`}</span>
        )}
      </div>
      {first && (
        <a className="plan-owe" href={planHref(plan.idea_id, "costs")}>
          <Avatar person={people.find((p) => p.id === first.from) ?? null} />
          <span aria-hidden>→</span>
          <Avatar person={people.find((p) => p.id === first.to) ?? null} />
          <span className="grow">
            <strong>
              {name(first.from)} {first.from === me?.id ? "owe" : "owes"} {first.to === me?.id ? "you" : name(first.to)} {money(first.amount)}
            </strong>
            {owed.length > 1 && <span className="muted small"> and {owed.length - 1} more</span>}
          </span>
        </a>
      )}
    </section>
  );
}

function PackingPanel({ ctx }: { ctx: PlanCtx }) {
  const groups = packingGroups(ctx).filter((g) => g.items.length > 0);
  return (
    <section className="panel">
      <div className="plan-section-head">
        <h2>Packing</h2>
        <a href={planHref(ctx.plan.idea_id, "packing")}>Open list →</a>
      </div>
      {groups.length === 0 ? (
        <>
          <p className="muted small">Nothing on the list yet. Everyone gets their own, plus one for shared things.</p>
          <div className="plan-actions">
            <OnceButton label="Add our family list" busy="Adding…" className="btn small ghost" run={() => addStarterPacking(ctx)} />
          </div>
        </>
      ) : (
        <div className="plan-progress">
          {groups.map((g) => {
            const packed = g.items.filter((i) => i.packed).length;
            return (
              <div key={g.key} className="plan-progress-row">
                <Avatar person={g.person} />
                <span className="plan-progress-name">{g.name}</span>
                <Bar label={`${packed} of ${g.items.length} packed`} parts={[{ share: packed / g.items.length, className: "booked" }]} />
                <span className="small muted plan-num">
                  {packed}/{g.items.length}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
