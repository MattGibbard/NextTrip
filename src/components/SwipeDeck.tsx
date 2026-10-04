import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import type { Idea, Round } from "../../shared/types";
import { matchesFilters } from "../../shared/roundFilters";
import { api } from "../api";
import { useData } from "../data";
import { flag } from "../countries";
import { cssUrl } from "../format";
import { IdeaDetailsLine } from "./IdeaDetails";

const THRESHOLD = 90;

/** One card per idea in the round: swipe right (or tap ♥) for yes, left (or ✕) for no. */
export function SwipeDeck({ round }: { round: Round }) {
  const { ideas, reload } = useData();
  const pool = useMemo(() => ideas.filter((i) => i.status === "active" && matchesFilters(i, round.filters)), [ideas, round.filters]);
  // Swipes made here show straight away, before the next reload catches up.
  const [local, setLocal] = useState<Map<number, boolean>>(() => new Map(round.my_swipes.map((s) => [s.idea_id, s.liked])));
  const [history, setHistory] = useState<number[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<-1 | 1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useRef<number | null>(null);

  const remaining = pool.filter((i) => !local.has(i.id));
  const [card, next] = remaining;

  const decide = (liked: boolean) => {
    if (!card || leaving) return;
    setLeaving(liked ? 1 : -1);
    setTimeout(() => {
      setLocal((m) => new Map(m).set(card.id, liked));
      setHistory((h) => [...h, card.id]);
      setLeaving(null);
      setDx(0);
      api
        .swipe(round.id, card.id, liked)
        .then(() => (remaining.length === 1 ? reload() : undefined))
        .catch((e: Error) => setError(e.message));
    }, 220);
  };

  const undo = () => {
    const last = history.at(-1);
    if (last === undefined) return;
    setHistory((h) => h.slice(0, -1));
    setLocal((m) => {
      const copy = new Map(m);
      copy.delete(last);
      return copy;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <div className="swipe-done">
        <p className="big">✅ All swiped</p>
        <p className="muted">The shortlist appears once everyone has finished.</p>
        {history.length > 0 && (
          <button className="link" onClick={undo}>
            Undo last swipe
          </button>
        )}
      </div>
    );
  }

  const offset = leaving ? leaving * 600 : dx;
  const vote = leaving ?? (Math.abs(dx) > 30 ? Math.sign(dx) : 0);

  return (
    <div className="swipe">
      <p className="muted small center">
        {pool.length - remaining.length + 1} of {pool.length} · swipe right for yes, left for no
      </p>
      <div className="swipe-stack">
        {next && <SwipeCard idea={next} className="behind" />}
        <SwipeCard
          key={card.id}
          idea={card}
          className={start.current === null ? "animate" : ""}
          style={{ transform: `translateX(${offset}px) rotate(${offset / 18}deg)` }}
          vote={vote}
          onPointerDown={(e) => {
            start.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
          onPointerUp={() => {
            start.current = null;
            if (Math.abs(dx) > THRESHOLD) decide(dx > 0);
            else setDx(0);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDx(0);
          }}
        />
      </div>
      <div className="swipe-buttons">
        <button className="swipe-btn no" onClick={() => decide(false)} aria-label={`No to ${card.title}`}>
          ✕
        </button>
        <button className="link" onClick={undo} disabled={history.length === 0}>
          Undo
        </button>
        <button className="swipe-btn yes" onClick={() => decide(true)} aria-label={`Yes to ${card.title}`}>
          ♥
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function SwipeCard({
  idea,
  className,
  vote = 0,
  ...rest
}: { idea: Idea; className: string; vote?: number } & HTMLAttributes<HTMLDivElement>) {
  const countries = [...new Set(idea.places.map((p) => p.country_code))];
  return (
    <div className={`swipe-card ${className}`} {...rest}>
      {idea.cover_url ? (
        <div className="cover" style={{ backgroundImage: cssUrl(idea.cover_url) }} />
      ) : (
        <div className="cover placeholder">{countries.map(flag).join(" ") || "💡"}</div>
      )}
      <div className="card-body">
        <h3>{idea.title}</h3>
        {idea.places.length > 0 && <p className="small">{idea.places.map((p) => p.name).join(" → ")}</p>}
        <IdeaDetailsLine idea={idea} />
        {idea.description && <p className="muted small clamp">{idea.description}</p>}
      </div>
      {vote !== 0 && <span className={`swipe-stamp ${vote > 0 ? "yes" : "no"}`}>{vote > 0 ? "YES" : "NOPE"}</span>}
    </div>
  );
}
