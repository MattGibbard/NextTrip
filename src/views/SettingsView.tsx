import { useState } from "react";
import type { Person } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";
import { isInstalled, isIos, useInstallPrompt } from "../install";
import { flag } from "../countries";
import { PlaceSearch } from "../components/PlaceSearch";
import { estimateTravel } from "../../shared/travelTime";
import { plural } from "../format";

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
      <HomePanel />
      <div className="panel">
        <h2>This device</h2>
        <p>
          You're using NextTrip as <strong>{me?.name ?? "nobody yet"}</strong>.
        </p>
        <button className="btn ghost" onClick={() => setMe(null)}>
          Switch person
        </button>
      </div>
      <InstallPanel />
    </section>
  );
}

/** Where travel times are measured from, plus a one-tap fill for ideas missing a travel time. */
function HomePanel() {
  const { home, ideas, reload } = useData();
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = ideas.filter((i) => (i.status === "active" || i.status === "won") && i.travel_time === null && estimateTravel(home, i.places));

  const save = async (place: Parameters<typeof api.setHome>[0]) => {
    setError(null);
    try {
      await api.setHome(place);
      await reload();
      setChanging(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fill = async () => {
    setBusy(true);
    try {
      for (const i of missing) {
        const { title, description, cover_url, created_by, places, budget, trip_length, holiday_types } = i;
        const travel_time = estimateTravel(home, places)!.travel_time;
        await api.updateIdea(i.id, { title, description, cover_url, created_by, places, budget, trip_length, travel_time, holiday_types });
      }
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Home</h2>
      <p className="muted small">Travel times on ideas are worked out from here, as a rough direct flight.</p>
      {home && !changing ? (
        <div className="home-row">
          <span className="grow">
            {flag(home.country_code)} <strong>{home.name}</strong> <span className="muted small">{home.country}</span>
          </span>
          <button className="btn ghost small" onClick={() => setChanging(true)}>
            Change
          </button>
        </div>
      ) : (
        <PlaceSearch onAdd={(p) => void save(p)} />
      )}
      {error && <p className="error-text">{error}</p>}
      {home && missing.length > 0 && (
        <button className="btn small" onClick={fill} disabled={busy}>
          {busy ? "Filling in…" : `Fill in travel time for ${plural(missing.length, "idea")}`}
        </button>
      )}
    </div>
  );
}

/** How to put NextTrip on the home screen, for whichever browser this is. */
function InstallPanel() {
  const install = useInstallPrompt();
  if (isInstalled()) return null;
  return (
    <div className="panel">
      <h2>Add to your home screen</h2>
      {install ? (
        <>
          <p className="muted small">Open NextTrip like an app, full screen and without the browser bars.</p>
          <button className="btn" onClick={() => void install()}>
            📲 Install NextTrip
          </button>
        </>
      ) : isIos() ? (
        <p className="muted small">
          In Safari, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
        </p>
      ) : (
        <p className="muted small">
          Open your browser's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      )}
    </div>
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
