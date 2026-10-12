import { useState } from "react";
import { tripDatesLabel } from "../../shared/tripDates";
import type { StayDates, TripDates } from "../../shared/tripDates";
import { api } from "../api";
import { useData } from "../data";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** What's typed so far: both kinds are kept, so switching between them doesn't lose anything. */
export interface DatesDraft {
  kind: "exact" | "month";
  start: string;
  end: string;
  /** "01" to "12", or "" for not picked. */
  month: string;
  year: string;
}

export function draftOf(dates: TripDates | null): DatesDraft {
  const year = String(new Date().getFullYear());
  if (dates?.kind === "exact") return { kind: "exact", start: dates.start, end: dates.end, month: "", year };
  if (dates?.kind === "month") return { kind: "month", start: "", end: "", month: dates.month.slice(5), year: dates.month.slice(0, 4) };
  return { kind: "exact", start: "", end: "", month: "", year };
}

/** The dates a draft stands for, null when it's empty, or an error when it's half filled in or back to front. */
export function datesOf(d: DatesDraft): { dates: TripDates | null; error?: string } {
  if (d.kind === "month") return { dates: d.month ? { kind: "month", month: `${d.year}-${d.month}` } : null };
  if (!d.start && !d.end) return { dates: null };
  if (!d.start || !d.end) return { dates: null, error: "Pick both dates, or leave them both empty." };
  if (d.end <= d.start) return { dates: null, error: "The trip needs to end after it starts." };
  return { dates: { kind: "exact", start: d.start, end: d.end } };
}

/** Exact dates by default, or just a month like "July 2027". Leaving it empty means no dates. */
export function TripDatesField({ value, onChange }: { value: DatesDraft; onChange: (d: DatesDraft) => void }) {
  const set = (patch: Partial<DatesDraft>) => onChange({ ...value, ...patch });
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1, thisYear + 2];
  if (!years.includes(Number(value.year))) years.unshift(Number(value.year));
  return (
    <div className="dates-field">
      <div className="segmented" role="group" aria-label="How exact">
        <button type="button" className={value.kind === "exact" ? "active" : ""} aria-pressed={value.kind === "exact"} onClick={() => set({ kind: "exact" })}>
          Exact dates
        </button>
        <button type="button" className={value.kind === "month" ? "active" : ""} aria-pressed={value.kind === "month"} onClick={() => set({ kind: "month" })}>
          Just a month
        </button>
      </div>
      {value.kind === "exact" ? (
        <div className="dates-pair">
          <label className="field">
            From
            <input type="date" value={value.start} onChange={(e) => set({ start: e.target.value })} />
          </label>
          <label className="field">
            To
            <input type="date" value={value.end} min={value.start || undefined} onChange={(e) => set({ end: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="dates-pair">
          <label className="field">
            Month
            <select value={value.month} onChange={(e) => set({ month: e.target.value })}>
              <option value="">Pick a month</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Year
            <select value={value.year} onChange={(e) => set({ year: e.target.value })}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

/** A round's trip dates, with a way to add, change or remove them at any time. */
export function RoundDates({
  roundId,
  dates,
  searching = null,
  className = "",
}: {
  roundId: number;
  dates: TripDates | null;
  /** The dates the booking links use, worth spelling out when only a month was given. */
  searching?: StayDates | null;
  className?: string;
}) {
  const { reload } = useData();
  const [draft, setDraft] = useState<DatesDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (next: TripDates | null) => {
    setSaving(true);
    setError(null);
    try {
      await api.setRoundDates(roundId, next);
      await reload(["rounds"]);
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const checked = draft ? datesOf(draft) : null;

  return (
    <div className={`round-dates ${className}`.trim()}>
      <div className="round-dates-head">
        <span className="mono-label">🗓️ When</span>
        <span className={dates ? "round-dates-value" : "muted"}>{dates ? tripDatesLabel(dates) : "No dates yet"}</span>
        {!draft && (
          <button type="button" className="link" onClick={() => setDraft(draftOf(dates))}>
            {dates ? "Change" : "Add dates"}
          </button>
        )}
        {dates?.kind === "month" && searching && (
          <span className="muted small round-dates-searching">
            Searching {tripDatesLabel({ kind: "exact", ...searching })}, from the 1st for the length of the trip.
          </span>
        )}
      </div>
      {draft && checked && (
        <div className="round-dates-edit">
          <TripDatesField value={draft} onChange={setDraft} />
          {(checked.error || error) && <p className="error-text small">{checked.error ?? error}</p>}
          <div className="row">
            <button type="button" className="btn small" disabled={saving || !!checked.error} onClick={() => void save(checked.dates)}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn small ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            {dates && (
              <button type="button" className="link danger" disabled={saving} onClick={() => void save(null)}>
                Remove dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
