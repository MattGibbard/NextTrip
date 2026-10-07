import type { Idea, IdeaDetails } from "../../shared/types";
import { MODES, ideaMode, ticketEnds } from "../../shared/travelMode";
import { useData } from "../data";
import { flag } from "../countries";
import { IdeaDetailsLine } from "./IdeaDetails";
import { Photo } from "./Ticket";

type CardIdea = Pick<Idea, "title" | "places" | "cover_url" | "status" | "created_by" | "depart" | "arrive" | keyof IdeaDetails> & { id?: number };

/** One idea as a standby card. A `preview` isn't a link, for showing an idea that's still being filled in. */
export function StandbyCard({ idea: i, onBeen, preview = false }: { idea: CardIdea; onBeen?: () => void; preview?: boolean }) {
  const { people, personName, home } = useData();
  const creator = people.find((p) => p.id === i.created_by);
  const mode = ideaMode(i.holiday_types);
  const m = MODES[mode];
  const ends = ticketEnds(mode, i, home);
  const flags = [...new Set(i.places.map((p) => p.country_code))].map(flag).join(" ");
  const Link = preview ? "div" : "a";
  const tag = i.status === "won" ? "🏆 WINNER" : i.status === "done" ? "✓ DONE" : "STANDBY";
  return (
    <article className={`standby-card mode-${mode}${preview ? " preview" : ""}`}>
      <Link className="standby-link" href={preview ? undefined : `#/next/${i.id}`}>
        <div className="standby-photo">
          <Photo url={i.cover_url} fallback={flags || "💡"} className="fill" />
          <span className="standby-tag">
            {tag} · {m.icon} {ends ? `${ends.from.code} → ${ends.to.code}` : m.kind}
          </span>
        </div>
        <div className="perf" aria-hidden />
        <div className="standby-body">
          <div className="standby-name">
            <span className="standby-flags">{flags || "💡"}</span>
            <h3 className={i.title ? undefined : "muted"}>{i.title || "Your idea's name"}</h3>
          </div>
          {i.places.length > 0 && <p className="small">{i.places.map((p) => p.name).join(" → ")}</p>}
          <IdeaDetailsLine idea={i} />
          <div className="standby-foot">
            <span>
              <span className="dot" style={{ background: creator?.color ?? "#999" }} /> {personName(i.created_by)}'s idea
            </span>
            <span className="mono-label mode-ink desktop-only">{m.kind}</span>
          </div>
        </div>
      </Link>
      {i.status === "won" && onBeen && (
        <div className="card-actions">
          <span className="badge win">🏆 Winner</span>
          <button className="btn small" onClick={onBeen}>
            We went! Add to Been
          </button>
        </div>
      )}
    </article>
  );
}
