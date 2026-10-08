import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Person } from "../../shared/types";
import { PERSON_COLORS } from "../../shared/auth";
import { api } from "../api";
import { useData } from "../data";
import { isInstalled, isIos, useInstallPrompt } from "../install";
import { TerminalPicker } from "../components/TerminalPicker";
import type { Terminal, TerminalKind } from "../../shared/terminals";
import { estimateTravel } from "../../shared/travelTime";
import { flag } from "../countries";
import { plural } from "../format";
import { setThemeChoice, themeChoice } from "../theme";
import type { ThemeChoice } from "../theme";
import { LegalLinks } from "./Welcome";

const COLOUR_NAMES = ["Blue", "Pink", "Green", "Orange", "Purple", "Sea blue", "Mustard", "Red"];

type SectionId = "family" | "invite" | "travel" | "device" | "welcome" | "account";

/** Scrolls to a settings section without touching the hash, which the app uses for its tabs. */
function scrollToSection(id: SectionId) {
  document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SettingsView() {
  const { isOwner, shareUrl } = useData();
  const sections: { id: SectionId; label: string; danger?: boolean }[] = [
    { id: "family", label: "Your family" },
    ...(isOwner && shareUrl ? [{ id: "invite" as const, label: "Invite people" }] : []),
    ...(isOwner ? [{ id: "travel" as const, label: "Travel" }] : []),
    { id: "device", label: "This device" },
    { id: "welcome", label: "How it works" },
    ...(isOwner ? [{ id: "account" as const, label: "Delete account", danger: true }] : []),
  ];
  const [current, setCurrent] = useState<SectionId>("family");

  // Lights up the section nearest the top of the screen as you scroll.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`settings-${s.id}`)).filter((el): el is HTMLElement => !!el);
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = els.find((el) => seen.get(el.id));
        if (first) setCurrent(first.id.replace("settings-", "") as SectionId);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections.length]);

  return (
    <section className="settings">
      <div className="settings-head">
        <h1 className="display">Settings</h1>
        <p className="lede muted">
          {isOwner ? "Who's in your family, how they get in, and how things work on this device." : "Who's in your family, and how things work on this device."}
        </p>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map((s) => (
            <a
              key={s.id}
              href="#/settings"
              className={`${current === s.id ? "on" : ""} ${s.danger ? "danger" : ""}`}
              aria-current={current === s.id ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setCurrent(s.id);
                scrollToSection(s.id);
              }}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="settings-sections">
          <FamilySection />
          {isOwner && shareUrl && <InviteSection />}
          {isOwner && <TravelSection />}
          <DeviceSection />
          <WelcomeSection />
          {isOwner && <DeleteAccountSection />}
          <LegalLinks />
        </div>
      </div>
    </section>
  );
}

function Card({ id, title, intro, action, children }: { id: SectionId; title: string; intro?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <section id={`settings-${id}`} className="settings-card" aria-labelledby={`settings-${id}-h`}>
      <div className="settings-card-head">
        <div>
          <h2 id={`settings-${id}-h`}>{title}</h2>
          {intro && <p className="muted small">{intro}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FamilySection() {
  const { people, me, isOwner, shareUrl } = useData();
  return (
    <Card
      id="family"
      title="Your family"
      intro={
        isOwner
          ? "Everyone here takes part in each draw. Their colour marks their ideas and points."
          : "Everyone here takes part in each draw. You can change your own name and colour."
      }
      action={
        isOwner &&
        shareUrl && (
          <button type="button" className="btn ghost soft" onClick={() => scrollToSection("invite")}>
            + Invite someone
          </button>
        )
      }
    >
      <div className="person-list">
        {people.map((p) => (
          <PersonCard key={p.id} person={p} isMe={p.id === me?.id} canEdit={isOwner || p.id === me?.id} canManage={isOwner && p.id !== me?.id} />
        ))}
      </div>
    </Card>
  );
}

function PersonCard({ person, isMe, canEdit, canManage }: { person: Person; isMe: boolean; canEdit: boolean; canManage: boolean }) {
  const { isOwner, reload } = useData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [color, setColor] = useState(person.color);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<{ url: string; days: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changed = name.trim() !== person.name || color !== person.color;

  const close = () => {
    setEditing(false);
    setName(person.name);
    setColor(person.color);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updatePerson(person.id, { name: name.trim(), color });
      await reload();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sendLink = async () => {
    setNote(null);
    setError(null);
    try {
      const made = await api.personLink(person.id);
      setLink(made);
      const text = `Here's your own link to somewhere🎉, ${person.name}. It works once, for ${made.days} days.`;
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "somewhere🎉", text, url: made.url }).catch(() => {});
        setNote(`Sign-in link made. Opening it signs ${person.name} in on that phone. It works once, for ${made.days} days.`);
      } else {
        await navigator.clipboard.writeText(made.url).then(
          () => setNote(`Sign-in link copied. Send it to ${person.name} in a message. Opening it signs them in on that phone. It works once, for ${made.days} days.`),
          () => setNote(`Copy this link and send it to ${person.name}. It works once, for ${made.days} days.`),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const signOut = async () => {
    if (!confirm(`Sign ${person.name} out on all their devices? They'll need a new sign-in link from you to get back in.`)) return;
    setNote(null);
    setError(null);
    try {
      await api.signOutPerson(person.id);
      setLink(null);
      setNote(`${person.name} is signed out everywhere. Send a fresh sign-in link to get them back in.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${person.name} from the family? They'll still show on past draws, and any points they've put in the open round are cleared.`)) return;
    try {
      await api.removePerson(person.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const custom = !PERSON_COLORS.includes(color);
  const meta = isMe ? "Signed in on this device" : "Joins every draw";

  return (
    <div className={`person-card ${editing ? "editing" : ""}`}>
      <div className="person-card-row">
        <span className="avatar" style={{ background: person.color }} aria-hidden>
          {person.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="person-card-who">
          <div className="person-card-name">
            <strong>{person.name}</strong>
            {isMe && <span className="tag accent">You</span>}
            {isMe && isOwner && <span className="tag">Organiser</span>}
          </div>
          <span className="muted small">{meta}</span>
        </div>
        <div className="person-card-actions">
          {canManage && (
            <button type="button" className={`btn ghost soft ${link ? "done" : ""}`} onClick={() => void sendLink()}>
              {link ? "Link made ✓" : "Send sign-in link"}
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn ghost" aria-expanded={editing} onClick={() => (editing ? close() : setEditing(true))}>
              {editing ? "Close" : "Edit"}
            </button>
          )}
        </div>
      </div>

      {(note || link) && !editing && (
        <div className="person-card-note" role="status">
          {note && <p className="accent-text small">✓ {note}</p>}
          {link && <input className="share-link" readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={`${person.name}'s sign-in link`} />}
        </div>
      )}
      {error && !editing && <p className="error-text person-card-note">{error}</p>}

      {editing && (
        <div className="person-card-edit">
          <label className="field narrow">
            <span>Name</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset className="field">
            <legend>Colour</legend>
            <div className="color-row" role="radiogroup" aria-label="Colour">
              {PERSON_COLORS.map((c, i) => (
                <button
                  type="button"
                  key={c}
                  role="radio"
                  aria-checked={color === c}
                  aria-label={COLOUR_NAMES[i]}
                  className={`color-swatch ${color === c ? "on" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                >
                  {color === c && "✓"}
                </button>
              ))}
              <input type="color" className={custom ? "on" : ""} value={color} onChange={(e) => setColor(e.target.value)} aria-label="Another colour" />
            </div>
          </fieldset>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn" disabled={!changed || !name.trim() || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="btn plain" onClick={close}>
              Cancel
            </button>
          </div>
          {canManage && (
            <div className="person-card-danger">
              <div>
                <strong>Lost or changed phones?</strong>
                <span className="muted small">Signs {person.name} out everywhere. Send a fresh sign-in link to get them back in.</span>
                <button type="button" className="btn ghost danger small" onClick={() => void signOut()}>
                  Sign {person.name} out
                </button>
              </div>
              <div>
                <strong>Not joining in any more?</strong>
                <span className="muted small">Takes {person.name} out of the family and out of future draws.</span>
                <button type="button" className="btn ghost danger small" onClick={() => void remove()}>
                  Remove {person.name}…
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The private link that lets the rest of the family in, for the organiser to share or reset. */
function InviteSection() {
  const { shareUrl, setShareToken } = useData();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
  const share = () => void navigator.share?.({ title: "somewhere🎉", text: "Join our family's somewhere🎉 to add holiday ideas and vote in the draw.", url: shareUrl }).catch(() => {});
  const reset = async () => {
    setError(null);
    try {
      setShareToken((await api.resetShareLink()).share_token);
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card
      id="invite"
      title="Invite people"
      intro="Send your family link to anyone joining. They pick a name and colour, then they're in. Keep it private: anyone with it can add ideas and join draws."
    >
      <div className="family-link">
        <label className="family-link-text">
          <span className="mono-label">Family link</span>
          <input readOnly value={shareUrl.replace(/^https?:\/\//, "")} onFocus={(e) => e.target.select()} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => void copy()}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          {"share" in navigator && (
            <button type="button" className="btn ghost raised" onClick={share}>
              Share…
            </button>
          )}
        </div>
      </div>

      <div className="settings-note">
        <span className="settings-note-i" aria-hidden>
          i
        </span>
        <p className="muted small">
          <strong>Already in the family, on a new phone?</strong> Don't send this link. Use <strong>Send sign-in link</strong> next to their name instead, so they come back as
          themselves.
        </p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {confirming ? (
        <div className="settings-confirm" role="alert">
          <strong>Make a new family link?</strong>
          <span className="muted small">The old link stops working straight away, so anyone still to join will need the new one.</span>
          <div className="form-actions">
            <button type="button" className="btn ghost danger small" onClick={() => void reset()}>
              Make a new link
            </button>
            <button type="button" className="btn plain small" onClick={() => setConfirming(false)}>
              Keep this one
            </button>
          </div>
        </div>
      ) : (
        <div className="settings-foot">
          <span className="muted small">Shared it somewhere you shouldn't have?</span>
          <button type="button" className="btn ghost small" onClick={() => setConfirming(true)}>
            Make a new link
          </button>
        </div>
      )}
    </Card>
  );
}

/**
 * The airport and station new trips and ideas set off from unless you pick another.
 * Travel times are measured from the airport, with a one-tap fill for ideas missing one.
 */
function TravelSection() {
  const { home, homeEnds, ideas, reload } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = ideas.filter((i) => (i.status === "active" || i.status === "won") && i.travel_time === null && estimateTravel(i.depart ?? home, i.places));

  const save = async (kind: "airport" | "station", t: Terminal | null) => {
    setError(null);
    try {
      await api.setHomeEnds({ [kind]: t });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fill = async () => {
    setBusy(true);
    try {
      for (const i of missing) {
        const { title, description, cover_url, created_by, places, depart, arrive, budget, trip_length, holiday_types } = i;
        const travel_time = estimateTravel(depart ?? home, places)!.travel_time;
        await api.updateIdea(i.id, { title, description, cover_url, created_by, places, depart, arrive, budget, trip_length, travel_time, holiday_types });
      }
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      id="travel"
      title="Where you usually leave from"
      intro="New trips and ideas start with these filled in, and you can change them on each one. Travel times are a rough direct flight from your airport."
    >
      <div className="home-ends">
        <HomeEnd kind="airport" label="Home airport" value={homeEnds.airport} onChange={(t) => save("airport", t)} />
        <HomeEnd kind="station" label="Home train station" value={homeEnds.station} onChange={(t) => save("station", t)} />
      </div>
      {error && <p className="error-text">{error}</p>}
      {missing.length > 0 && (
        <div className="settings-foot">
          <span className="muted small">Some ideas don't have a travel time yet.</span>
          <button type="button" className="btn ghost small" onClick={() => void fill()} disabled={busy}>
            {busy ? "Filling in…" : `Fill in travel time for ${plural(missing.length, "idea")}`}
          </button>
        </div>
      )}
    </Card>
  );
}

/** One home airport or station: a card with Change once it's set, a search box until then. */
function HomeEnd({ kind, label, value, onChange }: { kind: TerminalKind; label: string; value: Terminal | null; onChange: (t: Terminal | null) => Promise<void> }) {
  const [changing, setChanging] = useState(false);
  if (!value || changing) {
    return (
      <div className="home-end">
        <TerminalPicker
          kind={kind}
          label={label}
          value={null}
          onChange={(t) => {
            setChanging(false);
            void onChange(t);
          }}
        />
        {value && (
          <div className="form-actions">
            <button type="button" className="btn plain small" onClick={() => setChanging(false)}>
              Keep {value.code ?? value.name}
            </button>
            <button type="button" className="btn plain danger small" onClick={() => (setChanging(false), void onChange(null))}>
              Don't use one
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="home-end field">
      <span>{label}</span>
      <button type="button" className="terminal-card" onClick={() => setChanging(true)} aria-label={`${label}: ${value.name}. Change`}>
        <span aria-hidden>{flag(value.country_code)}</span>
        {value.code && <span className="terminal-card-code">{value.code}</span>}
        <span className="terminal-card-name">{value.name}</span>
        <span className="terminal-card-change">Change</span>
      </button>
    </div>
  );
}

const THEMES: { key: ThemeChoice; label: string }[] = [
  { key: "system", label: "Match device" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

function DeviceSection() {
  const { me, isOwner } = useData();
  const [choice, setChoice] = useState(themeChoice);
  const pick = (c: ThemeChoice) => {
    setThemeChoice(c);
    setChoice(c);
  };
  const install = useInstallPrompt();

  const signOut = async () => {
    const msg = isOwner
      ? "Sign out on this device? You can sign back in with your email."
      : "Leave on this device? You'll need the family link to get back in.";
    if (!confirm(msg)) return;
    await api.signOut().catch(() => {});
    location.href = "/";
  };

  return (
    <Card id="device" title="This device" intro="These only change things on the phone or computer you're using now.">
      <div className="settings-rows">
        <div className="settings-row">
          <div>
            <strong>Appearance</strong>
            <span className="muted small">Match device follows your phone's light or dark setting.</span>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Appearance">
            {THEMES.map((t) => (
              <button type="button" key={t.key} role="radio" aria-checked={choice === t.key} className={choice === t.key ? "on" : ""} onClick={() => pick(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!isInstalled() && (
          <div className="settings-row">
            <div>
              <strong>Add to your home screen</strong>
              {install ? (
                <span className="muted small">Open somewhere🎉 like an app, full screen and without the browser bars.</span>
              ) : isIos() ? (
                <span className="muted small">
                  In Safari, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>. It then opens full screen, like an app.
                </span>
              ) : (
                <span className="muted small">
                  Open your browser's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. It then opens full screen, like an app.
                </span>
              )}
            </div>
            {install && (
              <button type="button" className="btn ghost raised" onClick={() => void install()}>
                Install
              </button>
            )}
          </div>
        )}

        <div className="settings-row">
          <div>
            <strong>{me ? `Signed in as ${me.name}` : "Signed in"}</strong>
            <span className="muted small">
              {isOwner
                ? "You're the family organiser. Signing out only affects this device."
                : "You came in with the family link. If this isn't you, ask your family organiser for your own sign-in link."}
            </span>
          </div>
          <button type="button" className="btn ghost raised" onClick={() => void signOut()}>
            {isOwner ? "Sign out" : "Leave"}
          </button>
        </div>
      </div>
    </Card>
  );
}

/** Replays the welcome steps everyone sees the first time they're in. */
function WelcomeSection() {
  const { isOwner } = useData();
  return (
    <Card
      id="welcome"
      title="How it works"
      intro={
        isOwner
          ? "Go back through the welcome steps: how the draw works, your home airport, a first idea and your family link."
          : "Go back through the welcome steps: how the draw works and adding an idea."
      }
      action={
        <button type="button" className="btn ghost raised" onClick={() => (location.hash = "/welcome")}>
          Show me again
        </button>
      }
    />
  );
}

const DELETE_WORD = "DELETE";

/** Lets the organiser delete their account and everything the family has added. */
function DeleteAccountSection() {
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
    <Card
      id="account"
      title="Delete account"
      intro="Permanently deletes everything your family has added: trips, places, ideas, draws, people and the family link. Everyone is signed out. It can't be undone."
      action={
        !open && (
          <button type="button" className="btn ghost danger" onClick={() => setOpen(true)}>
            Delete account…
          </button>
        )
      }
    >
      {open && (
        <div className="settings-confirm" role="alert">
          <label className="field narrow">
            <span>
              Type <strong>{DELETE_WORD}</strong> to confirm
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn danger-fill" onClick={() => void remove()} disabled={busy || typed.trim() !== DELETE_WORD}>
              {busy ? "Deleting…" : "Delete everything"}
            </button>
            <button type="button" className="btn plain" onClick={() => (setOpen(false), setTyped(""), setError(null))} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
