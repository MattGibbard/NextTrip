// Every cost, booked or estimated, against the budget, and who owes whom.
import { useState } from "react";
import { api } from "../../api";
import { COST_CATEGORIES, COST_CATEGORY_LABEL, balances, costTotals, settleUp } from "../../../shared/plan";
import type { PlanCost } from "../../../shared/plan";
import { pad2, shortDate } from "./context";
import type { PlanCtx } from "./context";
import { Avatar, Bar, Status } from "./bits";
import { BudgetSheet, CostSheet } from "./sheets";

type Filter = "all" | "booked" | "estimate";

export function PlanCosts({ ctx }: { ctx: PlanCtx }) {
  const { plan, money, people, me } = ctx;
  const [editing, setEditing] = useState<PlanCost | "new" | null>(null);
  const [budgeting, setBudgeting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const totals = costTotals(plan.costs);
  const budget = plan.budget;
  const scale = Math.max(budget ?? 0, totals.total) || 1;
  const shown = plan.costs.filter((c) => filter === "all" || c.status === filter);
  const ids = people.map((p) => p.id);
  const owed = balances(plan.costs, plan.settlements, ids);
  const payments = settleUp(owed);
  const person = (id: number | null) => people.find((p) => p.id === id) ?? null;
  const name = (id: number) => (id === me?.id ? "You" : (person(id)?.name ?? "Someone"));
  const paidBy = new Map<number, number>();
  for (const c of plan.costs) if (c.status === "booked" && c.paid_by !== null) paidBy.set(c.paid_by, (paidBy.get(c.paid_by) ?? 0) + c.amount);
  const sharers = people.length;
  const count = (f: Filter) => plan.costs.filter((c) => f === "all" || c.status === f).length;

  return (
    <div className="plan-cols">
      <div className="plan-main">
        <section className="panel plan-budget-strip">
          <div>
            <div className="mono-label muted">PLANNED</div>
            <div className="plan-stat">{money(totals.total)}</div>
          </div>
          <div>
            <div className="mono-label muted">
              <span className="plan-swatch booked" />
              BOOKED
            </div>
            <div className="plan-stat-2">{money(totals.booked)}</div>
          </div>
          <div>
            <div className="mono-label muted">
              <span className="plan-swatch estimate" />
              ESTIMATED
            </div>
            <div className="plan-stat-2">{money(totals.estimate)}</div>
          </div>
          <div>
            <div className="mono-label muted">{budget === null ? "BUDGET" : totals.total > budget ? "OVER BUDGET" : `LEFT OF ${money(budget)}`}</div>
            {budget === null ? (
              <button type="button" className="link" onClick={() => setBudgeting(true)}>
                Set a budget
              </button>
            ) : (
              <div className={`plan-stat-2 ${totals.total > budget ? "plan-late" : ""}`}>
                {money(Math.abs(budget - totals.total))}{" "}
                <button type="button" className="link" onClick={() => setBudgeting(true)}>
                  Edit
                </button>
              </div>
            )}
          </div>
          <div className="plan-strip-bar">
            <Bar
              label={`${money(totals.booked)} booked, ${money(totals.estimate)} estimated`}
              parts={[
                { share: totals.booked / scale, className: "booked" },
                { share: totals.estimate / scale, className: "estimate" },
              ]}
            />
          </div>
        </section>

        <section className="plan-section">
          <div className="plan-section-head">
            <h2>Every cost</h2>
            <button type="button" className="btn small" onClick={() => setEditing("new")}>
              + Add a cost
            </button>
          </div>
          {plan.costs.length > 0 && (
            <div className="segmented plan-filter">
              {(["all", "booked", "estimate"] as const).map((f) => (
                <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "booked" ? "Booked" : "Estimates"} <span className="count">{count(f)}</span>
                </button>
              ))}
            </div>
          )}
          {plan.costs.length === 0 ? (
            <div className="empty">
              <p>No costs yet. Add flights, places to stay and tickets as you book them, or an estimate for the things you haven't.</p>
            </div>
          ) : (
            <ul className="list plan-costs">
              {shown.map((c) => {
                const payer = person(c.paid_by);
                return (
                  <li key={c.id}>
                    <button type="button" className="plan-cost" onClick={() => setEditing(c)}>
                      <span className="plan-cost-what">
                        <strong>{c.title}</strong>
                        <span className="muted small">
                          {COST_CATEGORY_LABEL[c.category]}
                          {c.day !== null && ` · Day ${pad2(c.day)}`}
                          {c.status === "booked" && (payer ? ` · ${payer.id === me?.id ? "You" : payer.name} paid` : " · Not paid yet")}
                        </span>
                      </span>
                      <Status status={c.status} />
                      <span className={`plan-cost-amount ${c.status === "estimate" ? "muted" : ""}`}>
                        {c.status === "estimate" && "≈ "}
                        {money(c.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="plan-side">
        <section className="panel">
          <h2>Settle up</h2>
          {paidBy.size === 0 ? (
            <p className="muted small">When you add a booked cost, say who paid. It's split evenly between {sharers === 2 ? "both of you" : `all ${sharers} of you`}.</p>
          ) : (
            <>
              <ul className="plan-paid">
                {people
                  .filter((p) => paidBy.has(p.id))
                  .map((p) => (
                    <li key={p.id}>
                      <Avatar person={p} />
                      <span className="grow">{p.id === me?.id ? "You" : p.name} paid</span>
                      <strong className="plan-num">{money(paidBy.get(p.id)!)}</strong>
                    </li>
                  ))}
              </ul>
              {payments.length === 0 ? (
                <p className="plan-even">✓ You're all square.</p>
              ) : (
                payments.map((pay) => (
                  <div key={`${pay.from}-${pay.to}`} className="plan-owe">
                    <Avatar person={person(pay.from)} />
                    <span aria-hidden>→</span>
                    <Avatar person={person(pay.to)} />
                    <span className="grow">
                      {name(pay.from)} {pay.from === me?.id ? "owe" : "owes"} {pay.to === me?.id ? "you" : name(pay.to)}
                      <br />
                      <strong className="plan-stat-2">{money(pay.amount)}</strong>
                    </span>
                    <button type="button" className="btn small" onClick={() => void ctx.run(() => api.settle(plan.idea_id, { from_person: pay.from, to_person: pay.to, amount: pay.amount }))}>
                      Paid back
                    </button>
                  </div>
                ))
              )}
            </>
          )}
          {plan.settlements.length > 0 && (
            <ul className="plan-settled">
              {plan.settlements.map((s) => (
                <li key={s.id} className="small muted">
                  <span className="grow">
                    {name(s.from_person)} paid {s.to_person === me?.id ? "you" : name(s.to_person)} back {money(s.amount)}
                    {s.created_at && ` on ${shortDate(s.created_at.slice(0, 10))}`}
                  </span>
                  <button type="button" className="link" onClick={() => void ctx.run(() => api.unsettle(plan.idea_id, s.id))}>
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {totals.total > 0 && (
          <section className="panel">
            <h2>By type</h2>
            <div className="plan-progress">
              {COST_CATEGORIES.filter((k) => totals.byCategory[k] > 0).map((k) => (
                <div key={k} className="plan-cat">
                  <div className="plan-cat-head">
                    <span>{COST_CATEGORY_LABEL[k]}</span>
                    <strong className="plan-num">{money(totals.byCategory[k])}</strong>
                  </div>
                  <Bar label={`${Math.round((totals.byCategory[k] / totals.total) * 100)}% of the total`} parts={[{ share: totals.byCategory[k] / totals.total, className: "booked" }]} />
                </div>
              ))}
            </div>
            {sharers > 0 && <p className="muted small plan-per-head">That's {money(Math.round(totals.total / sharers))} each.</p>}
          </section>
        )}
      </aside>

      {editing && <CostSheet ctx={ctx} cost={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {budgeting && <BudgetSheet ctx={ctx} onClose={() => setBudgeting(false)} />}
    </div>
  );
}
