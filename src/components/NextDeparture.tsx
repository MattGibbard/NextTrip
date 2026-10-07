import type { Idea } from "../../shared/types";
import { MODES, ideaMode, ticketEnds } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import { budgetLabel, tripLengthLabel } from "../../shared/ideaDetails";
import { useData } from "../data";
import { Field, Photo, RouteLine } from "./Ticket";
import { flagsOf } from "./TripTicket";
import type { TripDraft } from "../views/TripForm";

/** The idea that won the latest draw and hasn't been turned into a trip yet, as a boarding pass. */
export function NextDeparture({ onBeen }: { onBeen: (d: TripDraft) => void }) {
  const { ideas, rounds, people, home } = useData();
  const won = ideas.filter((i) => i.status === "won");
  if (won.length === 0) return null;
  // Rounds arrive newest first; fall back to any won idea if its round is gone.
  const round = rounds.find((r) => r.status === "drawn" && won.some((i) => i.id === r.winner_idea_id));
  const idea: Idea = won.find((i) => i.id === round?.winner_idea_id) ?? won[0];
  const mode = ideaMode(idea.holiday_types);
  // You get there by air (unless it's a train journey, or a cruise from a port you've set), then carry on by sea or road.
  const arrival: Mode = mode === "train" ? "train" : mode === "cruise" && idea.depart ? "cruise" : "flight";
  // A road trip's ends are the airports it flies between.
  const ends = ticketEnds(idea.depart || idea.arrive ? mode : arrival, idea, home);
  const flags = flagsOf(idea.places);
  const then = mode === "cruise" || mode === "road" ? `${MODES[mode].icon} ${mode === "cruise" ? "Sail" : "Drive"} ${idea.places.length} stops` : null;
  const passengers = people.map((p) => p.name).join(" & ") || "—";
  const been = () => onBeen({ title: idea.title, places: idea.places, idea_id: idea.id, depart: idea.depart, arrive: idea.arrive });

  return (
    <div className="departure">
      <div className="departure-main">
        <div className="departure-head">
          <span className="mono-label">NEXT DEPARTURE · {MODES[arrival].kind}</span>
          {round && <span className="departure-badge">🏆 Won in the {round.name} draw</span>}
        </div>
        {ends ? <RouteLine from={ends.from} to={ends.to} icon={MODES[arrival].icon} /> : <div className="departure-flags">{flags || "🏆"}</div>}
        <div className="departure-fields">
          <Field label="TRIP" className="departure-trip">
            <a href={`#/ideas/${idea.id}`}>
              {flags} {idea.title}
            </a>
          </Field>
          <Field label="PASSENGERS" className="desktop-only">
            {passengers}
          </Field>
          <Field label="LENGTH" className="desktop-only">
            {tripLengthLabel(idea.trip_length) ?? "—"}
          </Field>
          {then ? (
            <Field label="THEN">{then}</Field>
          ) : (
            <Field label="BUDGET">{budgetLabel(idea.budget) ?? "—"}</Field>
          )}
        </div>
        <button className="btn departure-been mobile-only" onClick={been}>
          We went! Add to Been
        </button>
      </div>
      <div className="departure-side desktop-only">
        <Photo url={idea.cover_url} fallback={flags || "🏆"} className="fill" />
        <div className="departure-actions">
          {round?.winning_ticket && round.total_tickets && (
            <span className="ticket-tag">
              TICKET {round.winning_ticket} / {round.total_tickets}
            </span>
          )}
          <button className="departure-been" onClick={been}>
            We went! Add to Been
          </button>
        </div>
      </div>
      <span className="notch top" />
      <span className="notch bottom" />
    </div>
  );
}
