import type { ReactNode } from "react";
import type { TicketEnd } from "../../shared/travelMode";
import { cssUrl } from "../format";

/** A number on split-flap tiles, like a departures board. */
export function Flaps({ value, label }: { value: number; label: string }) {
  const digits = String(value).padStart(2, "0").split("");
  return (
    <div className="flaps">
      <div className="flap-row" aria-label={`${value} ${label.toLowerCase()}`}>
        {digits.map((d, i) => (
          <span key={i} className="flap" aria-hidden>
            {d}
          </span>
        ))}
      </div>
      <span className="mono-label">{label}</span>
    </div>
  );
}

/** "LHR - - ✈️ - - NAP" with the place names underneath. */
export function RouteLine({ from, to, icon, names = true }: { from: TicketEnd; to: TicketEnd; icon: string; names?: boolean }) {
  return (
    <div className="route-line">
      {/* The names sit on their own row so a long name doesn't push the line off centre. */}
      <div className="route-codes">
        <div className="code">{from.code}</div>
        <div className="route-dash" aria-hidden>
          <span />
          <span className="route-icon">{icon}</span>
          <span />
        </div>
        <div className="code">{to.code}</div>
      </div>
      {names && (
        <div className="route-names">
          <div className="code-name">{from.name}</div>
          <div className="code-name end">{to.name}</div>
        </div>
      )}
    </div>
  );
}

/** A cover photo, or the flags on a soft background when there isn't one. */
export function Photo({ url, fallback, className = "" }: { url: string | null; fallback: string; className?: string }) {
  return url ? (
    <div className={`photo ${className}`} style={{ backgroundImage: cssUrl(url) }} />
  ) : (
    <div className={`photo placeholder ${className}`}>{fallback}</div>
  );
}

/** A small labelled value on a ticket: "NIGHTS / 7". */
export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mono-label">{label}</div>
      <div className="tk-value">{children}</div>
    </div>
  );
}

interface PassProps {
  /** "mode-cruise", or "standby" for an idea. */
  tone: string;
  photo: { url: string | null; fallback: string };
  head: [ReactNode, ReactNode];
  route: { from: TicketEnd; to: TicketEnd; icon: string } | null;
  title: ReactNode;
  byline?: ReactNode;
  facts: [string, ReactNode][];
  tags?: ReactNode;
  stub: [ReactNode, ReactNode, ReactNode];
}

/**
 * A whole trip or idea as one big ticket: photo, then the details, then a
 * coloured stub. On a phone the photo sits on top and the stub drops away.
 */
export function Pass({ tone, photo, head, route, title, byline, facts, tags, stub }: PassProps) {
  return (
    <div className={`pass ${tone}`}>
      <Photo url={photo.url} fallback={photo.fallback} className="pass-photo" />
      <div className="pass-main">
        <div className="pass-head">
          <span>{head[0]}</span>
          <span>{head[1]}</span>
        </div>
        <div className="pass-top">
          {route && <RouteLine {...route} />}
          <div>
            <h1 className="pass-title">{title}</h1>
            {byline}
          </div>
        </div>
        <div className="pass-perf" aria-hidden />
        <div className="pass-facts">
          {facts.map(([label, value]) => (
            <Field key={label} label={label}>
              {value}
            </Field>
          ))}
        </div>
        {tags && <div className="pass-tags">{tags}</div>}
      </div>
      <div className="pass-stub">
        <span>{stub[0]}</span>
        <span className="stub-text">{stub[1]}</span>
        <span className="stub-no">{stub[2]}</span>
      </div>
      <span className="notch top" />
      <span className="notch bottom" />
    </div>
  );
}
