import { useState } from "react";
import type { Person } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";

export function SettingsView() {
  const { people, me, setMe } = useData();
  return (
    <section>
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <div className="panel">
        <h2>The two of you</h2>
        <p className="muted small">Names and colours show on ideas, points and draws.</p>
        {people.map((p) => (
          <PersonEditor key={p.id} person={p} />
        ))}
      </div>
      <div className="panel">
        <h2>This device</h2>
        <p>
          You're using NextTrip as <strong>{me?.name ?? "nobody yet"}</strong>.
        </p>
        <button className="btn ghost" onClick={() => setMe(null)}>
          Switch person
        </button>
      </div>
    </section>
  );
}

function PersonEditor({ person }: { person: Person }) {
  const { reload } = useData();
  const [name, setName] = useState(person.name);
  const [color, setColor] = useState(person.color);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const changed = name.trim() !== person.name || color !== person.color;

  const saveIt = async () => {
    setState("saving");
    await api.updatePerson(person.id, { name: name.trim(), color });
    await reload();
    setState("saved");
  };

  return (
    <div className="person-editor">
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={`${person.name}'s colour`} />
      <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <button className="btn small" disabled={!changed || !name.trim() || state === "saving"} onClick={saveIt}>
        {state === "saved" && !changed ? "Saved" : "Save"}
      </button>
    </div>
  );
}
