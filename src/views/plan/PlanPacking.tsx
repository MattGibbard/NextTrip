// A packing list for each person, plus one for things the family shares.
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api";
import type { PackingItem } from "../../../shared/plan";
import type { Person } from "../../../shared/types";
import type { PlanCtx } from "./context";
import { Avatar, Bar, OnceButton, Tick } from "./bits";
import { addStarterPacking } from "./starter";

export interface PackingGroup {
  key: string;
  name: string;
  person: Person | null;
  items: PackingItem[];
}

/** Me first, then everyone else, then shared things. Lists of people who've left the family join Shared. */
export function packingGroups(ctx: PlanCtx): PackingGroup[] {
  const { people, me, plan } = ctx;
  const ordered = [...people].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));
  const ids = new Set(people.map((p) => p.id));
  return [
    ...ordered.map((p) => ({ key: String(p.id), name: p.id === me?.id ? `${p.name} (you)` : p.name, person: p, items: plan.packing.filter((i) => i.person_id === p.id) })),
    { key: "shared", name: "Shared", person: null, items: plan.packing.filter((i) => i.person_id === null || !ids.has(i.person_id)) },
  ];
}

export function PlanPacking({ ctx }: { ctx: PlanCtx }) {
  const groups = packingGroups(ctx);
  const all = ctx.plan.packing;
  const packed = all.filter((i) => i.packed).length;

  return (
    <div className="plan-packing">
      <div className="plan-packing-total">
        <span className="plan-stat">
          {packed}
          <span className="muted"> / {all.length} packed</span>
        </span>
        <Bar label={`${packed} of ${all.length} packed`} parts={[{ share: all.length ? packed / all.length : 0, className: "booked" }]} />
      </div>
      {all.length === 0 && (
        <section className="panel plan-starter">
          <span className="plan-starter-icon" aria-hidden>
            🧳
          </span>
          <div className="grow">
            <h2>Start with our family packing list</h2>
            <p className="muted small">The basics in everyone's bag, plus shared things like passports and chargers, picked for this kind of holiday. Remove anything you don't need.</p>
          </div>
          <OnceButton label="Add the list" busy="Adding…" run={() => addStarterPacking(ctx)} />
        </section>
      )}
      <div className="plan-packing-grid">
        {groups.map((g) => (
          <PackingList key={g.key} ctx={ctx} group={g} />
        ))}
      </div>
    </div>
  );
}

function PackingList({ ctx, group }: { ctx: PlanCtx; group: PackingGroup }) {
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const id = ctx.plan.idea_id;
  const packed = group.items.filter((i) => i.packed).length;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const text = label.trim();
    if (!text) return;
    setAdding(true);
    if (await ctx.run(() => api.addPacking(id, { label: text, person_id: group.person?.id ?? null }))) setLabel("");
    setAdding(false);
  };

  const toggle = (i: PackingItem) => {
    ctx.patch((p) => ({ ...p, packing: p.packing.map((x) => (x.id === i.id ? { ...x, packed: !x.packed } : x)) }));
    void ctx.run(() => api.updatePacking(id, i.id, { label: i.label, person_id: i.person_id, packed: !i.packed }));
  };

  return (
    <section className="panel plan-pack">
      <div className="plan-pack-head">
        <Avatar person={group.person} />
        <h2 className="grow">{group.name}</h2>
        {group.items.length > 0 && (
          <span className="pill">
            {packed}/{group.items.length}
          </span>
        )}
      </div>
      {group.items.length > 0 && <Bar label={`${packed} of ${group.items.length} packed`} parts={[{ share: packed / group.items.length, className: "booked" }]} />}
      {group.items.length > 0 && (
        <ul className="list plan-flat-list">
          {group.items.map((i) => (
            <li key={i.id} className={`list-row plan-todo ${i.packed ? "done" : ""}`}>
              <Tick on={i.packed} label={i.packed ? `Unpack ${i.label}` : `Pack ${i.label}`} onToggle={() => toggle(i)} />
              <span className="grow">{i.label}</span>
              <button type="button" className="plan-remove" aria-label={`Remove ${i.label}`} onClick={() => void ctx.run(() => api.deletePacking(id, i.id))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="plan-pack-add" onSubmit={add}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={group.person ? "Add to this bag…" : "Add something shared…"} aria-label={`Add to ${group.name}`} maxLength={200} />
        <button className="btn small ghost" disabled={adding || !label.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}
