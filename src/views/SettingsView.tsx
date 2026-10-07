import { useState } from "react";
import type { Person } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";
import { isInstalled, isIos, useInstallPrompt } from "../install";
import { flag } from "../countries";
import { PlaceSearch } from "../components/PlaceSearch";
import { TerminalPicker } from "../components/TerminalPicker";
import type { Terminal } from "../../shared/terminals";
import { estimateTravel } from "../../shared/travelTime";
import { plural } from "../format";
import { setThemeChoice, themeChoice } from "../theme";
import type { ThemeChoice } from "../theme";
import { LegalLinks } from "./Welcome";

export function SettingsView() {
  const { people, me, isOwner } = useData();
  return (
    <section>
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <div className="panel">
        <h2>Your family</h2>
        <p className="muted small">
          Names and colours show on ideas, points and draws.{" "}
          {isOwner
            ? "Everyone here takes part in each draw, so remove anyone who isn't joining in. To get someone onto a new phone, send them their own sign-in link."
            : "You can change your own."}
        </p>
        {people.map((p) => (isOwner || p.id === me?.id ? <PersonEditor key={p.id} person={p} /> : <PersonRow key={p.id} person={p} />))}
      </div>
      {isOwner && <SharePanel />}
      {isOwner && <HomePanel />}
      {isOwner && <HomeEndsPanel />}
      <AppearancePanel />
      <div className="panel">
        <h2>This device</h2>
        <p>
          You're using NextTrip as <strong>{me?.name ?? "nobody yet"}</strong>
          {isOwner ? ", signed in as the family organiser." : ", through the family link."}
          {!isOwner && " If this isn't you, ask your family organiser for your own sign-in link."}
        </p>
        <div className="form-actions">
          <SignOutButton />
        </div>
      </div>
      <InstallPanel />
      {isOwner && <DeleteAccountPanel />}
      <LegalLinks />
    </section>
  );
}

function PersonRow({ person }: { person: Person }) {
  return (
    <div className="person-editor">
      <span className="avatar" style={{ background: person.color }}>
        {person.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="grow">{person.name}</span>
    </div>
  );
}

function SignOutButton() {
  const { isOwner } = useData();
  const signOut = async () => {
    const msg = isOwner
      ? "Sign out on this device? You can sign back in with your email."
      : "Leave on this device? You'll need the family link to get back in.";
    if (!confirm(msg)) return;
    await api.signOut().catch(() => {});
    location.href = "/";
  };
  return (
    <button className="btn ghost danger" onClick={signOut}>
      {isOwner ? "Sign out" : "Leave"}
    </button>
  );
}

/** The private link that lets the rest of the family in, for the organiser to share or reset. */
function SharePanel() {
  const { shareUrl, setShareToken } = useData();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!shareUrl) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.");
    }
  };
  const share = () => void navigator.share?.({ title: "NextTrip", text: "Join our family's NextTrip to add holiday ideas and vote in the draw.", url: shareUrl }).catch(() => {});
  const reset = async () => {
    if (!confirm("Make a new family link? The old one stops working, and everyone who used it will need the new one.")) return;
    try {
      setShareToken((await api.resetShareLink()).share_token);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="panel">
      <h2>Family link</h2>
      <p className="muted small">Send this to your family. Anyone with it can add ideas, take part in draws and see the results, so keep it private.</p>
      <input className="share-link" readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label="Family link" />
      <div className="form-actions">
        <button className="btn small" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        {"share" in navigator && (
          <button className="btn small ghost" onClick={share}>
            Share…
          </button>
        )}
        <button className="btn small ghost danger" onClick={reset}>
          Make a new link
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

/** Where travel times are measured from, plus a one-tap fill for ideas missing a travel time. */
function HomePanel() {
  const { home, ideas, reload } = useData();
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = ideas.filter((i) => (i.status === "active" || i.status === "won") && i.travel_time === null && estimateTravel(i.depart ?? home, i.places));

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
        const { title, description, cover_url, cover_credit, created_by, places, depart, arrive, budget, trip_length, holiday_types } = i;
        const travel_time = estimateTravel(depart ?? home, places)!.travel_time;
        await api.updateIdea(i.id, { title, description, cover_url, cover_credit, created_by, places, depart, arrive, budget, trip_length, travel_time, holiday_types });
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

/** The airport and station new trips and ideas set off from unless you pick another. */
function HomeEndsPanel() {
  const { homeEnds, reload } = useData();
  const [error, setError] = useState<string | null>(null);

  const save = async (kind: "airport" | "station", t: Terminal | null) => {
    setError(null);
    try {
      await api.setHomeEnds({ [kind]: t });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="panel">
      <h2>Where you usually leave from</h2>
      <p className="muted small">New trips and ideas start with these filled in. You can change them on each one.</p>
      <div className="journey-row">
        <TerminalPicker kind="airport" label="Home airport" value={homeEnds.airport} onChange={(t) => void save("airport", t)} />
        <TerminalPicker kind="station" label="Home station" value={homeEnds.station} onChange={(t) => void save("station", t)} />
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

const THEMES: { key: ThemeChoice; label: string }[] = [
  { key: "system", label: "📱 Match device" },
  { key: "light", label: "☀️ Light" },
  { key: "dark", label: "🌙 Dark" },
];

/** Light or dark mode for this browser. */
function AppearancePanel() {
  const [choice, setChoice] = useState(themeChoice);
  const pick = (c: ThemeChoice) => {
    setThemeChoice(c);
    setChoice(c);
  };
  return (
    <div className="panel">
      <h2>Appearance</h2>
      <p className="muted small">Just for this device.</p>
      <div className="choice-row" role="radiogroup" aria-label="Appearance">
        {THEMES.map((t) => (
          <button type="button" key={t.key} role="radio" aria-checked={choice === t.key} className={`choice ${choice === t.key ? "on" : ""}`} onClick={() => pick(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** How to put NextTrip on the home screen, for whichever browser this is. */
const DELETE_WORD = "DELETE";

/** Lets the organiser delete their account and everything the family has added. */
function DeleteAccountPanel() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(typed.trim());
      location.href = "/";
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Delete account</h2>
      <p className="muted small">
        This permanently deletes your account and everything your family has added: trips, places, ideas, draws, people and the family link. Everyone using it is signed out.
        It can't be undone.
      </p>
      {open ? (
        <>
          <label className="field">
            <span>
              Type <strong>{DELETE_WORD}</strong> to confirm
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button className="btn danger-fill" onClick={remove} disabled={busy || typed.trim() !== DELETE_WORD}>
              {busy ? "Deleting…" : "Delete everything"}
            </button>
            <button className="btn ghost" onClick={() => (setOpen(false), setTyped(""), setError(null))} disabled={busy}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button className="btn ghost danger" onClick={() => setOpen(true)}>
          Delete account…
        </button>
      )}
    </div>
  );
}

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
  const { reload, isOwner, me } = useData();
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

  const remove = async () => {
    if (!confirm(`Remove ${person.name} from the family? They'll still show on past draws, and any points they've put in the open round are cleared.`)) return;
    await api.removePerson(person.id);
    await reload();
  };

  return (
    <>
      <div className="person-editor">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={`${person.name}'s colour`} />
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <button className="btn small" disabled={!changed || !name.trim() || state === "saving"} onClick={saveIt}>
          {state === "saved" && !changed ? "Saved" : "Save"}
        </button>
        {isOwner && person.id !== me?.id && (
          <button className="btn small ghost danger" onClick={remove} aria-label={`Remove ${person.name}`}>
            Remove
          </button>
        )}
      </div>
      {isOwner && person.id !== me?.id && <DeviceActions person={person} />}
    </>
  );
}

/** The organiser's tools for getting someone onto a new device, or off an old one. */
function DeviceActions({ person }: { person: Person }) {
  const [link, setLink] = useState<{ url: string; days: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const makeLink = async () => {
    setNote(null);
    try {
      const made = await api.personLink(person.id);
      setLink(made);
      const text = `Here's your own link to NextTrip, ${person.name}. It works once, for ${made.days} days.`;
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "NextTrip", text, url: made.url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(made.url).then(() => setNote("Copied. Send it to them."), () => {});
      }
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const signOut = async () => {
    if (!confirm(`Sign ${person.name} out on all their devices? They'll need a new sign-in link from you to get back in.`)) return;
    setNote(null);
    try {
      await api.signOutPerson(person.id);
      setLink(null);
      setNote(`${person.name} is signed out everywhere.`);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <div className="device-actions">
      <button className="btn small ghost" onClick={() => void makeLink()}>
        Sign-in link
      </button>
      <button className="btn small ghost danger" onClick={() => void signOut()}>
        Sign out
      </button>
      {link && (
        <input
          className="share-link"
          readOnly
          value={link.url}
          onFocus={(e) => e.target.select()}
          aria-label={`${person.name}'s sign-in link`}
        />
      )}
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}
