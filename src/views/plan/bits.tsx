// Small pieces shared across the trip plan's tabs.
import type { Person } from "../../../shared/types";
import type { ItemStatus } from "../../../shared/plan";
import { Avatar as PersonAvatar } from "../../components/Avatar";

/** The trip plan's smaller avatar. */
export function Avatar({ person, size = 26 }: { person: Pick<Person, "name" | "color"> | null; size?: number }) {
  return <PersonAvatar person={person} className="plan-av" size={size} />;
}

const STATUS_TEXT: Record<ItemStatus | "estimate" | "free", string> = { plan: "PLAN", to_book: "TO BOOK", booked: "BOOKED", estimate: "ESTIMATE", free: "FREE" };

export function Status({ status }: { status: ItemStatus | "estimate" | "free" }) {
  return <span className={`plan-status ${status}`}>{STATUS_TEXT[status]}</span>;
}

/** A tick box drawn as a button, so it's big enough to tap. */
export function Tick({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" className={`plan-tick ${on ? "on" : ""}`} role="checkbox" aria-checked={on} aria-label={label} onClick={onToggle}>
      {on && "✓"}
    </button>
  );
}

/** A thin bar filled to a share of its width. */
export function Bar({ parts, label }: { parts: { share: number; className: string }[]; label: string }) {
  return (
    <div className="plan-bar" role="img" aria-label={label}>
      {parts.map((p, i) => (
        <span key={i} className={p.className} style={{ width: `${Math.max(0, Math.min(100, p.share * 100))}%` }} />
      ))}
    </div>
  );
}

/** Who a thing belongs to, as buttons: each person, then nobody (or the whole family). */
export function PersonChoice({ people, value, onChange, none }: { people: Person[]; value: number | null; onChange: (id: number | null) => void; none: string }) {
  return (
    <div className="choice-row" role="radiogroup">
      {people.map((p) => (
        <button type="button" key={p.id} role="radio" aria-checked={value === p.id} className={`choice ${value === p.id ? "on" : ""}`} onClick={() => onChange(p.id)}>
          <span className="dot" style={{ background: p.color }} /> {p.name}
        </button>
      ))}
      <button type="button" role="radio" aria-checked={value === null} className={`choice ${value === null ? "on" : ""}`} onClick={() => onChange(null)}>
        {none}
      </button>
    </div>
  );
}
