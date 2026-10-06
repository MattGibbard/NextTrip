import { useState } from "react";
import type { FormEvent } from "react";
import { PERSON_COLORS } from "../../shared/auth";
import { api } from "../api";
import { useData } from "../data";

/**
 * Asks who this browser is, the first time. Everyone else can only add a new
 * name, so nobody can pick someone else and see their secret points. The
 * organiser can also say they're someone already on the list.
 */
export function PersonPicker() {
  const { people, isOwner, setMe } = useData();
  const [adding, setAdding] = useState(!isOwner || people.length === 0);
  const [error, setError] = useState<string | null>(null);

  const pick = async (id: number) => {
    setError(null);
    try {
      await api.setMe(id);
      setMe(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="overlay">
      <div className="sheet picker">
        {adding ? (
          <NewPerson onAdded={setMe} onCancel={isOwner && people.length > 0 ? () => setAdding(false) : undefined} />
        ) : (
          <>
            <h2>Which one is you?</h2>
            <p className="muted">This device will stay as you. Everyone else gets their own sign-in link from Settings.</p>
            <div className="picker-options">
              {people.map((p) => (
                <button key={p.id} className="picker-option" style={{ borderColor: p.color }} onClick={() => void pick(p.id)}>
                  <span className="avatar" style={{ background: p.color }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn ghost" onClick={() => setAdding(true)}>
              ➕ I'm not on the list
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NewPerson({ onAdded, onCancel }: { onAdded: (id: number) => void; onCancel?: () => void }) {
  const { people, isOwner, reload } = useData();
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => PERSON_COLORS.find((c) => !people.some((p) => p.color === c)) ?? PERSON_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.addPerson({ name: name.trim(), color });
      await reload();
      onAdded(id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={add}>
      <div>
        <h2>What's your name?</h2>
        <p className="muted">Your name and colour show on your ideas, points and draws. This device will stay as you.</p>
        {!isOwner && people.length > 0 && (
          <p className="muted small">Already on the list? Ask your family organiser to send you your own sign-in link.</p>
        )}
      </div>
      <label>
        Name
        <input value={name} maxLength={40} required autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
      </label>
      <div className="field">
        <span>Colour</span>
        <div className="color-row" role="radiogroup" aria-label="Colour">
          {PERSON_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              className={`color-swatch ${color === c ? "on" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Another colour" />
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button className="btn" disabled={busy || !name.trim()}>
          {busy ? "Adding…" : "That's me"}
        </button>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Back
          </button>
        )}
      </div>
    </form>
  );
}
