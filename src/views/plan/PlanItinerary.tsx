// Day by day: each day's name and date, the things on it in time order, and whether they're booked.
import { useState } from "react";
import { api } from "../../api";
import { dayDate, MAX_DAYS } from "../../../shared/plan";
import type { PlanItem } from "../../../shared/plan";
import { dayLabel, pad2 } from "./context";
import type { PlanCtx } from "./context";
import { Status } from "./bits";
import { DaySheet, ItemSheet } from "./sheets";

export function PlanItinerary({ ctx, onDates }: { ctx: PlanCtx; onDates?: () => void }) {
  const { plan } = ctx;
  const [editing, setEditing] = useState<{ item: PlanItem | null; day: number } | null>(null);
  const [naming, setNaming] = useState<number | null>(null);
  const days = Array.from({ length: ctx.days }, (_, i) => i + 1);
  const fixed = ctx.dates?.kind === "exact";
  const lastEmpty = !plan.items.some((i) => i.day === ctx.days);

  return (
    <div className="plan-days">
      <div className="plan-section-head">
        <p className="muted small">
          {fixed ? "A day for each date of your trip." : "Set your dates to see them on each day."} Tap anything to change it.
        </p>
        <button type="button" className="btn small" onClick={() => setEditing({ item: null, day: 1 })}>
          + Add to a day
        </button>
      </div>

      {days.map((d) => {
        const items = plan.items.filter((i) => i.day === d);
        const date = dayDate(ctx.dates, d);
        const title = plan.day_titles[d];
        return (
          <article key={d} className="panel plan-day">
            <div className="plan-day-when">
              <div className="mono-label plan-day-num">DAY {pad2(d)}</div>
              {date && <div className="plan-day-date">{dayLabel(date)}</div>}
            </div>
            <div className="plan-day-body">
              <div className="plan-day-head">
                <button type="button" className={`plan-row-button plan-day-title ${title ? "" : "muted"}`} onClick={() => setNaming(d)}>
                  {title ?? "Name this day"}
                </button>
              </div>
              {items.length > 0 && (
                <ul className="plan-items">
                  {items.map((i) => (
                    <li key={i.id}>
                      <button type="button" className="plan-item" onClick={() => setEditing({ item: i, day: d })}>
                        <span className="plan-item-time">{i.time ?? "—"}</span>
                        <span className="plan-item-text">
                          <strong>{i.title}</strong>
                          {i.notes && <span className="muted small">{i.notes}</span>}
                        </span>
                        <Status status={i.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="plan-add-row" onClick={() => setEditing({ item: null, day: d })}>
                + {items.length ? "Add more" : "Add something to this day"}
              </button>
            </div>
          </article>
        );
      })}

      <div className="plan-actions">
        {fixed ? (
          onDates && (
            <button type="button" className="btn small ghost" onClick={onDates}>
              Change dates
            </button>
          )
        ) : (
          <>
            {ctx.days < MAX_DAYS && (
              <button type="button" className="btn small ghost" onClick={() => void ctx.run(() => api.setPlan(plan.idea_id, { days: ctx.days + 1 }))}>
                + Add a day
              </button>
            )}
            {ctx.days > 1 && lastEmpty && (
              <button type="button" className="link" onClick={() => void ctx.run(() => api.setPlan(plan.idea_id, { days: ctx.days - 1 }))}>
                Remove day {ctx.days}
              </button>
            )}
          </>
        )}
      </div>

      {editing && <ItemSheet ctx={ctx} item={editing.item} day={editing.day} onClose={() => setEditing(null)} />}
      {naming !== null && <DaySheet ctx={ctx} day={naming} onClose={() => setNaming(null)} />}
    </div>
  );
}
