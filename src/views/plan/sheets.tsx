// The add and edit sheets for a trip plan: things on a day, costs, jobs, the budget, day names and dates.
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Modal } from "../../components/Modal";
import { api } from "../../api";
import { useData } from "../../data";
import { COST_CATEGORIES, COST_CATEGORY_LABEL, ITEM_STATUSES, ITEM_STATUS_LABEL, MAX_DAYS, dayDate, parseAmount } from "../../../shared/plan";
import type { CostCategory, CostStatus, ItemStatus, PlanCost, PlanItem, PlanTodo } from "../../../shared/plan";
import type { TripDates } from "../../../shared/tripDates";
import type { PlanCtx } from "./context";
import { dayLabel, pad2 } from "./context";
import { PersonChoice } from "./bits";

/** A sheet with a form: the fields, then Delete (when editing), Cancel and the save button. */
function SheetForm({ title, onClose, onSubmit, onDelete, saveLabel, error, children }: {
  title: string;
  onClose: () => void;
  onSubmit: () => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  saveLabel: string;
  error: string | null;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit();
    setSaving(false);
    if (ok) onClose();
  };
  const remove = async () => {
    setSaving(true);
    const ok = await onDelete!();
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {children}
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          {onDelete && (
            <button type="button" className="link danger" onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={saving}>
            {saving ? "Saving…" : saveLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DaySelect({ ctx, value, onChange, optional }: { ctx: PlanCtx; value: number | null; onChange: (d: number | null) => void; optional?: boolean }) {
  return (
    <label>
      Day
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        {optional && <option value="">No day</option>}
        {Array.from({ length: ctx.days }, (_, i) => i + 1).map((d) => {
          const date = dayDate(ctx.dates, d);
          return (
            <option key={d} value={d}>
              Day {pad2(d)}
              {date ? ` · ${dayLabel(date)}` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function Choices<T extends string>({ options, labels, value, onChange }: { options: readonly T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="choice-row" role="radiogroup">
      {options.map((o) => (
        <button type="button" key={o} role="radio" aria-checked={value === o} className={`choice ${value === o ? "on" : ""}`} onClick={() => onChange(o)}>
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

/** Saves through the page, keeping any error in the sheet rather than at the top of the page. */
function useSave(ctx: PlanCtx) {
  const [error, setError] = useState<string | null>(null);
  const save = (fn: () => Promise<unknown>) => {
    setError(null);
    return ctx.run(fn, setError);
  };
  return { error, setError, save };
}

export function ItemSheet({ ctx, item, day, onClose }: { ctx: PlanCtx; item: PlanItem | null; day: number; onClose: () => void }) {
  const [d, setDay] = useState(item?.day ?? day);
  const [time, setTime] = useState(item?.time ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? "plan");
  const { error, save } = useSave(ctx);
  const id = ctx.idea.id;
  return (
    <SheetForm
      title={item ? "Edit this" : "Add to a day"}
      saveLabel={item ? "Save" : "Add"}
      onClose={onClose}
      error={error}
      onSubmit={() => save(() => api.savePlanItem(id, item?.id ?? null, { day: d, time: time.trim() || null, title, notes: notes.trim() || null, status }))}
      onDelete={item ? () => save(() => api.deletePlanItem(id, item.id)) : undefined}
    >
      <label>
        What's happening?
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Peak 2 Peak gondola" required autoFocus maxLength={200} />
      </label>
      <div className="row two">
        <DaySelect ctx={ctx} value={d} onChange={(v) => setDay(v ?? 1)} />
        <label>
          Time
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="13:35, AM, evening" maxLength={20} />
        </label>
      </div>
      <div className="field">
        <span>Status</span>
        <Choices options={ITEM_STATUSES} labels={ITEM_STATUS_LABEL} value={status} onChange={setStatus} />
      </div>
      <label>
        Notes
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Booking reference, where to meet, what to bring…" maxLength={2000} />
      </label>
    </SheetForm>
  );
}

const STATUS_LABELS: Record<CostStatus, string> = { booked: "Booked", estimate: "Estimate" };

export function CostSheet({ ctx, cost, onClose }: { ctx: PlanCtx; cost: PlanCost | null; onClose: () => void }) {
  const [title, setTitle] = useState(cost?.title ?? "");
  const [amount, setAmount] = useState(cost ? String(cost.amount / 100) : "");
  const [category, setCategory] = useState<CostCategory>(cost?.category ?? "travel");
  const [status, setStatus] = useState<CostStatus>(cost?.status ?? "booked");
  const [day, setDay] = useState<number | null>(cost?.day ?? null);
  const [paidBy, setPaidBy] = useState<number | null>(cost ? cost.paid_by : (ctx.me?.id ?? null));
  const { error, setError, save } = useSave(ctx);
  const id = ctx.idea.id;
  const submit = async () => {
    const minor = parseAmount(amount);
    if (minor === null) {
      setError("Enter an amount, like 960 or 12.50");
      return false;
    }
    return save(() => api.saveCost(id, cost?.id ?? null, { title, amount: minor, category, status, day, paid_by: status === "booked" ? paidBy : null }));
  };
  return (
    <SheetForm
      title={cost ? "Edit cost" : "Add a cost"}
      saveLabel={cost ? "Save" : "Add cost"}
      onClose={onClose}
      error={error}
      onSubmit={submit}
      onDelete={cost ? () => save(() => api.deleteCost(id, cost.id)) : undefined}
    >
      <label>
        Amount ({ctx.currency})
        <input className="plan-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" required autoFocus />
      </label>
      <label>
        What's it for?
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Whistler hotel, 2 nights" required maxLength={200} />
      </label>
      <div className="field">
        <span>Type</span>
        <Choices options={COST_CATEGORIES} labels={COST_CATEGORY_LABEL} value={category} onChange={setCategory} />
      </div>
      <div className="row two">
        <DaySelect ctx={ctx} value={day} onChange={setDay} optional />
        <div className="field">
          <span>Status</span>
          <Choices options={["booked", "estimate"] as const} labels={STATUS_LABELS} value={status} onChange={setStatus} />
        </div>
      </div>
      {status === "booked" && (
        <div className="field">
          <span>Who paid?</span>
          <PersonChoice people={ctx.people} value={paidBy} onChange={setPaidBy} none="Not paid yet" />
          <span className="muted small">Split evenly between everyone, so you can settle up later.</span>
        </div>
      )}
    </SheetForm>
  );
}

export function TodoSheet({ ctx, todo, onClose }: { ctx: PlanCtx; todo: PlanTodo | null; onClose: () => void }) {
  const [label, setLabel] = useState(todo?.label ?? "");
  const [person, setPerson] = useState<number | null>(todo ? todo.person_id : (ctx.me?.id ?? null));
  const [due, setDue] = useState(todo?.due ?? "");
  const { error, save } = useSave(ctx);
  const id = ctx.idea.id;
  return (
    <SheetForm
      title={todo ? "Edit job" : "Add a job"}
      saveLabel={todo ? "Save" : "Add"}
      onClose={onClose}
      error={error}
      onSubmit={() => save(() => api.saveTodo(id, todo?.id ?? null, { label, person_id: person, due: due || null, done: todo?.done ?? false }))}
      onDelete={todo ? () => save(() => api.deleteTodo(id, todo.id)) : undefined}
    >
      <label>
        What needs doing?
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Apply for travel visas" required autoFocus maxLength={200} />
      </label>
      <div className="field">
        <span>Who's doing it?</span>
        <PersonChoice people={ctx.people} value={person} onChange={setPerson} none="Anyone" />
      </div>
      <label>
        Do it by
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
    </SheetForm>
  );
}

export function BudgetSheet({ ctx, onClose }: { ctx: PlanCtx; onClose: () => void }) {
  const [amount, setAmount] = useState(ctx.plan.budget ? String(ctx.plan.budget / 100) : "");
  const { error, setError, save } = useSave(ctx);
  const submit = async () => {
    const minor = amount.trim() ? parseAmount(amount) : null;
    if (amount.trim() && minor === null) {
      setError("Enter an amount, like 6000");
      return false;
    }
    return save(() => api.setPlan(ctx.idea.id, { budget: minor }));
  };
  return (
    <SheetForm title="Trip budget" saveLabel="Save budget" onClose={onClose} error={error} onSubmit={submit}>
      <label>
        Everything, for everyone ({ctx.currency})
        <input className="plan-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="6000" autoFocus />
      </label>
      <p className="muted small">Leave it empty if you'd rather not set one.</p>
    </SheetForm>
  );
}

export function DaySheet({ ctx, day, onClose }: { ctx: PlanCtx; day: number; onClose: () => void }) {
  const [title, setTitle] = useState(ctx.plan.day_titles[day] ?? "");
  const { error, save } = useSave(ctx);
  return (
    <SheetForm title={`Name day ${day}`} saveLabel="Save" onClose={onClose} error={error} onSubmit={() => save(() => api.nameDay(ctx.idea.id, day, title))}>
      <label>
        What's the day about?
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fly to Vancouver" autoFocus maxLength={120} />
      </label>
    </SheetForm>
  );
}

/** The trip's dates live on the draw it won, so the countdown and the Draw tab agree. */
export function DatesSheet({ ctx, onClose }: { ctx: PlanCtx; onClose: () => void }) {
  const exact = ctx.dates?.kind === "exact" ? ctx.dates : null;
  const [start, setStart] = useState(exact?.start ?? "");
  const [end, setEnd] = useState(exact?.end ?? "");
  const { error, setError, save } = useSave(ctx);
  const { reload } = useData();
  const round = ctx.round!;
  const submit = async () => {
    if (!start || !end || end < start) {
      setError("Pick when you go and when you come back");
      return false;
    }
    const nights = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
    if (nights + 1 > MAX_DAYS) {
      setError(`Plans go up to ${MAX_DAYS} days`);
      return false;
    }
    const dates: TripDates = { kind: "exact", start, end };
    return save(async () => {
      await api.setRoundDates(round.id, dates);
      await reload(["rounds"]);
    });
  };
  return (
    <SheetForm title="Trip dates" saveLabel="Save dates" onClose={onClose} error={error} onSubmit={submit}>
      <div className="row two">
        <label>
          You go
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          You're back
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      <p className="muted small">The itinerary shows a day for each date, and the countdown starts.</p>
    </SheetForm>
  );
}
