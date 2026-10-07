import { useEffect, useRef, useState } from "react";
import { ENDS, endsForMode } from "../../shared/terminals";
import type { Terminal, TerminalKind, TerminalSearchResult } from "../../shared/terminals";
import type { Mode } from "../../shared/travelMode";
import { api } from "../api";
import { useData } from "../data";
import { flag } from "../countries";

const PLACEHOLDER: Record<TerminalKind, string> = {
  airport: "Airport name or code, like LHR",
  station: "Station name or code, like STP",
  port: "Search for the port's town or city…",
};

async function search(kind: TerminalKind, q: string): Promise<TerminalSearchResult[]> {
  if (kind !== "port") return api.terminals(kind, q);
  const places = await api.geocode(q);
  return places.map(({ label, place }) => ({
    label,
    terminal: { kind, code: null, name: place.name, country_code: place.country_code, lat: place.lat, lon: place.lon },
  }));
}

/** Searches airports, stations or ports as you type, keeping only the latest answer. */
function useTerminalSearch(kind: TerminalKind) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TerminalSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    // The bundled airport and station lists answer quickly; place search is rate limited.
    const t = setTimeout(
      async () => {
        setBusy(true);
        try {
          const r = await search(kind, term);
          if (mine === seq.current) {
            setResults(r);
            setError(null);
          }
        } catch (e) {
          if (mine === seq.current) setError((e as Error).message);
        } finally {
          if (mine === seq.current) setBusy(false);
        }
      },
      kind === "port" ? 400 : 150,
    );
    return () => clearTimeout(t);
  }, [q, kind]);

  const clear = () => {
    setQ("");
    setResults([]);
  };
  return { q, setQ, results, busy, error, clear, open: results.length > 0 || busy || !!error || q.trim().length >= 2 };
}

function SearchResults({ search, onPick }: { search: ReturnType<typeof useTerminalSearch>; onPick: (t: Terminal) => void }) {
  const { results, busy, error } = search;
  return (
    <ul className="results">
      {busy && results.length === 0 && <li className="muted">Searching…</li>}
      {error && <li className="muted">{error}</li>}
      {results.map((r) => (
        <li key={r.label}>
          <button type="button" onClick={() => onPick(r.terminal)}>
            {flag(r.terminal.country_code)} {r.label}
          </button>
        </li>
      ))}
      {!busy && !error && results.length === 0 && <li className="muted">No matches</li>}
    </ul>
  );
}

/** Picks one airport, station or port: a chip once chosen, a search box until then. */
export function TerminalPicker({ kind, label, value, onChange }: { kind: TerminalKind; label: string; value: Terminal | null; onChange: (t: Terminal | null) => void }) {
  const s = useTerminalSearch(kind);
  const pick = (t: Terminal) => {
    onChange(t);
    s.clear();
  };

  return (
    <div className="field">
      <span>{label}</span>
      {value ? (
        <ul className="chips">
          <li className="chip" title={value.name}>
            <span>{flag(value.country_code)}</span>
            {value.code && <strong className="chip-code">{value.code}</strong>} {value.name}
            <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${value.name}`}>
              ✕
            </button>
          </li>
        </ul>
      ) : (
        <div className="place-search">
          <input
            type="search"
            placeholder={PLACEHOLDER[kind]}
            value={s.q}
            onChange={(e) => s.setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (s.results[0]) pick(s.results[0].terminal);
              }
            }}
            aria-label={label}
          />
          {s.open && <SearchResults search={s} onPick={pick} />}
        </div>
      )}
    </div>
  );
}

/**
 * The departure and arrival for a trip or idea, kept as typed so switching mode
 * and back doesn't lose them. Only the ones that fit the current mode count. A new
 * trip or idea starts from the home airport or station until you pick or clear it.
 */
export function useJourney(initial: { depart?: Terminal | null; arrive?: Terminal | null }, isNew: boolean) {
  const { homeEnds } = useData();
  const [depart, setDepart] = useState<Terminal | null>(initial.depart ?? null);
  const [arrive, setArrive] = useState<Terminal | null>(initial.arrive ?? null);
  const [touched, setTouched] = useState(false);
  return (mode: Mode) => {
    const ends = endsForMode(mode, depart, arrive);
    const kind = ENDS[mode].kind;
    const fallback = isNew && !touched && kind !== "port" ? homeEnds[kind] : null;
    return {
      depart: ends.depart ?? fallback,
      arrive: ends.arrive,
      setDepart: (t: Terminal | null) => (setDepart(t), setTouched(true)),
      setArrive,
    };
  };
}

export function JourneyFields({ mode, journey }: { mode: Mode; journey: ReturnType<ReturnType<typeof useJourney>> }) {
  const ends = ENDS[mode];
  const hint =
    mode === "cruise"
      ? "Cruises come back to this port. The map draws dotted lines from here to the first place and back from the last."
      : mode === "road"
        ? "Just the flight out. The map joins the airports, then your route, then flies home from the last place."
        : "The map draws a dotted line between these.";
  return (
    <>
      <div className={ends.arrive ? "journey-row" : undefined}>
        <TerminalPicker kind={ends.kind} label={ends.depart} value={journey.depart} onChange={journey.setDepart} />
        {ends.arrive && <TerminalPicker kind={ends.kind} label={ends.arrive} value={journey.arrive} onChange={journey.setArrive} />}
      </div>
      <span className="muted small journey-hint">{hint}</span>
    </>
  );
}

const SHORT_PLACEHOLDER: Record<TerminalKind, string> = {
  airport: "Airport or code",
  station: "Station or code",
  port: "Port town or city",
};

/** One end of the journey as a ticket-like card: the big code once picked, a search box in a dashed card until then. */
function EndCard({ kind, label, short, value, onChange }: { kind: TerminalKind; label: string; short: string; value: Terminal | null; onChange: (t: Terminal | null) => void }) {
  const s = useTerminalSearch(kind);
  const pick = (t: Terminal) => {
    onChange(t);
    s.clear();
  };
  if (value) {
    return (
      <div className="end-card" title={value.name}>
        <span className="end-label">{short}</span>
        <span className={value.code ? "end-code" : "end-code end-place"}>
          {value.code ?? (
            <>
              {flag(value.country_code)} {value.name}
            </>
          )}
        </span>
        {value.code && (
          <span className="end-name">
            {flag(value.country_code)} {value.name}
          </span>
        )}
        <button type="button" className="end-clear" onClick={() => onChange(null)} aria-label={`Change ${label.toLowerCase()}`}>
          <CrossIcon />
        </button>
      </div>
    );
  }
  return (
    <div className="end-search">
      <label className="end-card empty">
        <span className="end-label">{short}</span>
        <input
          type="search"
          placeholder={SHORT_PLACEHOLDER[kind]}
          value={s.q}
          onChange={(e) => s.setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (s.results[0]) pick(s.results[0].terminal);
            }
          }}
          aria-label={label}
        />
      </label>
      {s.open && <SearchResults search={s} onPick={pick} />}
    </div>
  );
}

export function CrossIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const CARD_TEXT: Record<Mode, { title: string; depart: string; arrive: string }> = {
  flight: { title: "Flights", depart: "DEPART", arrive: "ARRIVE" },
  train: { title: "Stations", depart: "DEPART", arrive: "ARRIVE" },
  cruise: { title: "Port", depart: "SAIL FROM", arrive: "" },
  road: { title: "Flights", depart: "FLY OUT", arrive: "LAND AT" },
};

/** The departure and arrival as two cards with an arrow between, like the ends of a ticket. */
export function JourneyCards({ mode, journey }: { mode: Mode; journey: ReturnType<ReturnType<typeof useJourney>> }) {
  const ends = ENDS[mode];
  const text = CARD_TEXT[mode];
  return (
    <div className="journey-cards-field">
      <span className="field-label">{text.title}</span>
      <div className={ends.arrive ? "journey-cards" : "journey-cards single"}>
        <EndCard kind={ends.kind} label={ends.depart} short={text.depart} value={journey.depart} onChange={journey.setDepart} />
        {ends.arrive && (
          <>
            <svg className="journey-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <EndCard kind={ends.kind} label={ends.arrive} short={text.arrive} value={journey.arrive} onChange={journey.setArrive} />
          </>
        )}
      </div>
    </div>
  );
}
