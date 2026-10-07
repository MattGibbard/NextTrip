import { useEffect, useRef, useState } from "react";
import type { GeocodeResult, Place } from "../../shared/types";
import { api } from "../api";
import { countryOptions, flag } from "../countries";

/** City search backed by OpenStreetMap, with a manual fallback. */
export function PlaceSearch({ onAdd, placeholder = "Search for a city…", icon = false }: { onAdd: (p: Place) => void; placeholder?: string; icon?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await api.geocode(term);
        if (mine === seq.current) {
          setResults(r);
          setError(null);
        }
      } catch (e) {
        if (mine === seq.current) setError((e as Error).message);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (p: Place) => {
    onAdd(p);
    setQ("");
    setResults([]);
  };

  if (manual) return <ManualPlace onAdd={(p) => (pick(p), setManual(false))} onCancel={() => setManual(false)} />;

  return (
    <div className={icon ? "place-search with-icon" : "place-search"}>
      {icon && (
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )}
      <input
        type="search"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[0]) pick(results[0].place);
          }
        }}
        aria-label="Search for a city"
      />
      {(results.length > 0 || busy || error || q.trim().length >= 2) && (
        <ul className="results">
          {busy && results.length === 0 && <li className="muted">Searching…</li>}
          {error && <li className="muted">{error}</li>}
          {results.map((r) => (
            <li key={r.label}>
              <button type="button" onClick={() => pick(r.place)}>
                {flag(r.place.country_code)} {r.label}
              </button>
            </li>
          ))}
          {!busy && !error && results.length === 0 && <li className="muted">No matches</li>}
        </ul>
      )}
      <button type="button" className="link" onClick={() => setManual(true)}>
        Can't find it? Add it by hand
      </button>
    </div>
  );
}

function ManualPlace({ onAdd, onCancel }: { onAdd: (p: Place) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const options = countryOptions();
  return (
    <div className="manual-place">
      <input placeholder="City or place" value={name} onChange={(e) => setName(e.target.value)} aria-label="Place name" />
      <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Country">
        <option value="">Country…</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
      <div className="row">
        <button
          type="button"
          className="btn small"
          disabled={!name.trim() || !code}
          onClick={() => onAdd({ name: name.trim(), country: options.find((o) => o.code === code)!.name, country_code: code, lat: null, lon: null })}
        >
          Add
        </button>
        <button type="button" className="btn small ghost" onClick={onCancel}>
          Back to search
        </button>
      </div>
    </div>
  );
}
