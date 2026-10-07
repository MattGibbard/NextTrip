import { useMemo, useState } from "react";
import { useData } from "../data";
import { flag } from "../countries";
import { plural } from "../format";
import { budgetLabel, holidayType, travelTimeLabel, tripLengthLabel } from "../../shared/ideaDetails";
import { ticketRanges } from "../../shared/draw";
import { estimateTravel, formatHours } from "../../shared/travelTime";
import { MODES, ideaMode, ticketEnds } from "../../shared/travelMode";
import { followsInOrder } from "../../shared/routes";
import { Pass } from "../components/Ticket";
import { HotelLinks } from "../components/HotelLinks";
import { WorldMap, terminalPins } from "../components/WorldMap";
import { journeyLegs } from "../../shared/terminals";
import type { Pin, Route } from "../components/WorldMap";
import { IdeaForm } from "./IdeaForm";
import { TripForm } from "./TripForm";
import type { TripDraft } from "./TripForm";

const STATUS = {
  active: "IN THE POOL",
  won: "🏆 WON A DRAW",
  done: "✓ DONE",
  archived: "ARCHIVED",
} as const;

const NONE = new Set<string>();

/** Everything about one idea, as a standby ticket: details, places on a map and its draw history. */
export function IdeaPage({ id }: { id: number }) {
  const { ideas, trips, rounds, people, personName, home } = useData();
  const idea = ideas.find((i) => i.id === id);
  const [editing, setEditing] = useState(false);
  const [tripDraft, setTripDraft] = useState<TripDraft | null>(null);

  const countries = useMemo(() => new Set(idea?.places.map((p) => p.country_code) ?? []), [idea]);
  const pins = useMemo<Pin[]>(
    () => [
      ...(idea?.places ?? []).flatMap((p) => (p.lat !== null && p.lon !== null ? [{ lat: p.lat, lon: p.lon, label: `${p.name}, ${p.country}`, kind: "idea" as const }] : [])),
      ...(idea ? terminalPins([idea.depart, idea.arrive], "idea") : []),
    ],
    [idea],
  );

  const routes = useMemo<Route[]>(
    () =>
      idea
        ? [
            {
              places: idea.places,
              inOrder: followsInOrder(idea.holiday_types),
              label: idea.title,
              kind: "idea",
              journey: journeyLegs(ideaMode(idea.holiday_types), idea.depart, idea.arrive, idea.places),
            },
          ]
        : [],
    [idea],
  );

  // Drawn rounds this idea was in, with its share of the tickets.
  const history = useMemo(
    () =>
      rounds
        .filter((r) => r.status === "drawn")
        .flatMap((r) => {
          const ranges = ticketRanges(r.allocations);
          const mine = ranges.find((x) => x.idea_id === id)?.tickets ?? 0;
          if (!mine) return [];
          const total = ranges.reduce((n, x) => n + x.tickets, 0);
          const winner = r.ideas.find((i) => i.id === r.winner_idea_id)?.title ?? null;
          return [{ round: r, tickets: mine, total, won: r.winner_idea_id === id, winner }];
        }),
    [rounds, id],
  );

  if (!idea) {
    return (
      <section>
        <a className="back-link" href="#/next">
          ← Next
        </a>
        <p className="muted center">This idea has been deleted.</p>
      </section>
    );
  }

  const creator = people.find((p) => p.id === idea.created_by);
  const trip = trips.find((t) => t.idea_id === idea.id);
  const origin = idea.depart ?? home;
  const estimate = estimateTravel(origin, idea.places);
  const types = idea.holiday_types.map(holidayType).filter((t) => t !== undefined);
  const mode = ideaMode(idea.holiday_types);
  const m = MODES[mode];
  const ends = ticketEnds(mode, idea, home);
  const flags = [...countries].map(flag).join(" ");
  const codes = ends ? `${ends.from.code}–${ends.to.code}` : null;
  const travel = travelTimeLabel(idea.travel_time);

  return (
    <section className="pass-page">
      <div className="page-head">
        <a className="back-link" href="#/next">
          ← Next
        </a>
        <button className="btn" onClick={() => setEditing(true)}>
          ✏️ Edit
        </button>
      </div>

      <Pass
        tone="standby"
        photo={{ url: idea.cover_url, fallback: flags || "💡" }}
        head={[`STANDBY · ${m.icon} ${m.kind}`, STATUS[idea.status]]}
        route={ends && { from: ends.from, to: ends.to, icon: mode === "road" && idea.depart ? MODES.flight.icon : m.icon }}
        title={`${flags} ${idea.title}`.trim()}
        byline={
          <div className="muted small byline">
            <span className="dot" style={{ background: creator?.color ?? "#999" }} /> {personName(idea.created_by)}'s idea
          </div>
        }
        facts={[
          ["BUDGET", budgetLabel(idea.budget) ?? <span className="muted">Not set</span>],
          ["LENGTH", tripLengthLabel(idea.trip_length) ?? <span className="muted">Not set</span>],
          [
            "TRAVEL TIME",
            travel ? (
              <>
                ✈️ {travel}
                {estimate && origin && <div className="muted small">≈ {formatHours(estimate.hours)} from {origin.name}</div>}
              </>
            ) : (
              <span className="muted">Not set</span>
            ),
          ],
          ["TYPE", types.map((t) => `${t.icon} ${t.label}`).join(" · ") || <span className="muted">Not set</span>],
        ]}
        stub={["💡", codes ? `STANDBY · ${codes}` : "STANDBY", plural(history.length, "DRAW", "DRAWS")]}
      />

      {idea.status === "won" && (
        <div className="panel win-panel">
          <span className="grow">This one won a draw. Been yet?</span>
          <button className="btn small" onClick={() => setTripDraft({ title: idea.title, places: idea.places, idea_id: idea.id, depart: idea.depart, arrive: idea.arrive })}>
            We went! Add to Been
          </button>
        </div>
      )}
      {trip && (
        <p className="small">
          ✓ You went: <a href={`#/been/${trip.id}`}>{trip.title}</a>
        </p>
      )}

      {idea.status !== "done" && <HotelLinks places={idea.places} campaign="idea_page" className="panel" />}

      <div className="pass-columns idea-columns">
        {idea.description && <p className="pass-notes area-notes">{idea.description}</p>}
        {idea.places.length > 0 ? (
          <ol className="stepper-route area-steps" aria-label="Places in order">
            {idea.places.map((p, i) => (
              <li key={i}>
                <span className="step-num">{i + 1}</span>
                <span className="step-name">{p.name}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small area-steps">No places yet. Add some with Edit.</p>
        )}
        {pins.length > 0 && (
          <div className="pass-map area-map">
            <WorldMap visited={NONE} ideas={countries} pins={pins} routes={routes} selected={null} onSelect={() => {}} close />
          </div>
        )}
        {history.length > 0 && (
          <div className="area-history">
            <h2 className="pass-h2">Draw history</h2>
            <ul className="draw-history">
              {history.map((h) => (
                <li key={h.round.id}>
                  <span className="draw-odds">{Math.round((h.tickets / h.total) * 100)}%</span>
                  <div className="grow">
                    <strong>{h.round.name}</strong>
                    <div className="muted small">
                      {h.tickets} of {h.total} tickets
                    </div>
                  </div>
                  <span className="muted small">{h.won ? "🏆 This won" : h.winner ? `🏆 ${h.winner} won` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editing && <IdeaForm idea={idea} onClose={() => setEditing(false)} onDeleted={() => (location.hash = "/next")} />}
      {tripDraft && <TripForm draft={tripDraft} onClose={() => setTripDraft(null)} />}
    </section>
  );
}
