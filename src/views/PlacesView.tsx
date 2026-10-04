import { useMemo, useState } from "react";
import { useData } from "../data";
import { flag, summarise } from "../countries";
import type { CountrySummary } from "../countries";
import { plural } from "../format";
import { WorldMap } from "../components/WorldMap";
import type { Pin } from "../components/WorldMap";

export function PlacesView() {
  const { trips, ideas } = useData();
  const [showIdeas, setShowIdeas] = useState(true);
  const [mode, setMode] = useState<"countries" | "cities">("countries");

  const visited = useMemo(() => summarise(trips.map((t) => t.places)), [trips]);
  const activeIdeas = useMemo(() => ideas.filter((i) => i.status === "active" || i.status === "won"), [ideas]);

  const { visitedCodes, ideaCodes, pins } = useMemo(() => {
    const visitedCodes = new Set(visited.map((c) => c.code));
    const ideaCodes = new Set<string>();
    const pins: Pin[] = [];
    const seen = new Set<string>();
    for (const t of trips)
      for (const p of t.places)
        if (p.lat !== null && p.lon !== null && !seen.has(`v${p.name}${p.country_code}`)) {
          seen.add(`v${p.name}${p.country_code}`);
          pins.push({ lat: p.lat, lon: p.lon, label: `${p.name}, ${p.country}`, kind: "visited" });
        }
    if (showIdeas)
      for (const i of activeIdeas)
        for (const p of i.places) {
          if (!visitedCodes.has(p.country_code)) ideaCodes.add(p.country_code);
          if (p.lat !== null && p.lon !== null && !seen.has(`i${p.name}${p.country_code}`)) {
            seen.add(`i${p.name}${p.country_code}`);
            pins.push({ lat: p.lat, lon: p.lon, label: `${p.name} (idea: ${i.title})`, kind: "idea" });
          }
        }
    return { visitedCodes, ideaCodes, pins };
  }, [trips, activeIdeas, visited, showIdeas]);

  const cities = useMemo(
    () =>
      visited
        .flatMap((c) => c.cities.map((city) => ({ ...city, code: c.code, country: c.name })))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [visited],
  );

  return (
    <section>
      <div className="page-head">
        <h1>Where we've been</h1>
      </div>

      <div className="map-wrap">
        <WorldMap visited={visitedCodes} ideas={ideaCodes} pins={pins} />
        <div className="legend">
          <span>
            <i className="swatch visited" /> Been
          </span>
          <label>
            <input type="checkbox" checked={showIdeas} onChange={(e) => setShowIdeas(e.target.checked)} />
            <i className="swatch idea" /> Ideas
          </label>
        </div>
      </div>

      <div className="segmented">
        <button className={mode === "countries" ? "active" : ""} onClick={() => setMode("countries")}>
          {plural(visited.length, "country", "countries")}
        </button>
        <button className={mode === "cities" ? "active" : ""} onClick={() => setMode("cities")}>
          {plural(cities.length, "city", "cities")}
        </button>
      </div>

      {visited.length === 0 && <p className="muted center">Add trips with places to see them here.</p>}

      {mode === "countries" ? (
        <ul className="list">
          {visited.map((c) => (
            <CountryRow key={c.code} c={c} />
          ))}
        </ul>
      ) : (
        <ul className="list">
          {cities.map((c) => (
            <li key={`${c.name}${c.code}`} className="list-row">
              <span className="flag">{flag(c.code)}</span>
              <div className="grow">
                <strong>{c.name}</strong>
                <div className="muted small">{c.country}</div>
              </div>
              <span className="pill">{plural(c.count, "visit")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CountryRow({ c }: { c: CountrySummary }) {
  return (
    <li className="list-row">
      <span className="flag">{flag(c.code)}</span>
      <div className="grow">
        <strong>{c.name}</strong>
        <div className="muted small">{c.cities.map((x) => (x.count > 1 ? `${x.name} ×${x.count}` : x.name)).join(" · ")}</div>
      </div>
      <span className="pill">{plural(c.visits, "trip")}</span>
    </li>
  );
}
