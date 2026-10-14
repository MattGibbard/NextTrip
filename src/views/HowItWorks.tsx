import type { CSSProperties, ReactNode } from "react";
import "../styles/how-it-works.css";
import { HOW, HOW_STEPS } from "../site";
import type { HowStep } from "../site";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";

/**
 * The page at /how-it-works: each step of choosing a holiday, told in words beside a short looping
 * animation of that part of the app. The sides swap from one step to the next. Its words are edited
 * at /admin; the animations are drawn here, so they're decoration and screen readers skip them.
 */
export function HowItWorksPage() {
  const { hero, steps } = HOW;
  return (
    <div className="lp lp-home">
      <SiteHeader current="how" exact />

      <section className="lp-wrap hw-hero">
        {hero.kicker && <div className="lp-kicker">{hero.kicker}</div>}
        <h1>{hero.heading}</h1>
        {hero.lead && <p className="lp-lead">{hero.lead}</p>}
      </section>

      <ol className="lp-wrap hw-steps">
        {HOW_STEPS.map((key) => {
          const s = steps[key];
          return (
            <li key={key} className="hw-step">
              <div className="hw-text">
                {s.kicker && <span className="lp-kicker">{s.kicker}</span>}
                <h2>{s.title}</h2>
                {s.text.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
              <div className="hw-stage-wrap">{STAGES[key]}</div>
            </li>
          );
        })}
      </ol>

      <SiteFooter />
    </div>
  );
}

/** The stage around each animation: the app's own look, without anything to click. */
function Stage({ name, label, children }: { name: string; label?: ReactNode; children: ReactNode }) {
  return (
    <div className={`hw-stage hw-${name}`} aria-hidden="true">
      {label}
      {children}
    </div>
  );
}

const Eyebrow = ({ children }: { children: ReactNode }) => <span className="hw-eyebrow">{children}</span>;

/** Two ideas already on standby, then two more drop in as someone taps "Add idea". */
function IdeasStage() {
  const cards = [
    { flag: "🇵🇹", name: "Lisbon and Porto", chips: ["🏙️ City break", "££"] },
    { flag: "🇬🇷", name: "Crete", chips: ["🏖️ Beach", "££"] },
    { flag: "🇬🇧", name: "Lake District", chips: ["🥾 Nature & hiking", "£"], drop: "hw-in3" },
    { flag: "🇯🇵", name: "Kyoto", chips: ["🏙️ City break", "£££"], drop: "hw-in4" },
  ];
  return (
    <Stage
      name="ideas"
      label={
        <div className="hw-bar">
          <Eyebrow>Departures · Standby</Eyebrow>
          <span className="hw-add hw-anim">
            <span>+</span> Add idea
          </span>
        </div>
      }
    >
      <div className="hw-grid2">
        {cards.map((c) => (
          <div key={c.name} className={c.drop ? `hw-sb hw-anim ${c.drop}` : "hw-sb"}>
            <div className="hw-sb-head">
              {c.flag}
              <span className="hw-sb-tag">STANDBY</span>
            </div>
            <div className="hw-perf" />
            <div className="hw-sb-body">
              <div className="hw-sb-name">{c.name}</div>
              <div className="hw-chips">
                {c.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}

const count = (from: number, to: number) => Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => (from < to ? from + i : from - i));

/** All ten points go on one idea, the other gets vetoed, and the points are locked in. */
function PointsStage() {
  return (
    <Stage name="points" label={<Eyebrow>Ticket office</Eyebrow>}>
      <div className="hw-pts-bar">
        <div className="hw-pts-who">
          <span className="hw-avatar" style={{ background: "#2563eb" }}>
            M
          </span>
          Your points
        </div>
        <div className="hw-pts-left">
          <span className="hw-mono-label">POINTS LEFT</span>
          <div className="hw-pts-window">
            <div className="hw-strip hw-anim hw-pts-down">
              {count(10, 0).map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hw-grid2">
        <div className="hw-pts-card hw-anim hw-pts-has">
          <div className="hw-pts-top">
            <div className="hw-pts-flag">
              <span>🇵🇹</span>
              <span className="hw-pts-standby">STANDBY</span>
            </div>
            <div className="hw-pts-name">Lisbon and Porto</div>
            <div className="hw-chips">
              <span>🏙️ City break</span>
            </div>
          </div>
          <div className="hw-perf" />
          <div className="hw-pts-foot">
            <span className="hw-veto">🚫 Veto</span>
            <div className="hw-stepper">
              <span className="hw-round">−</span>
              <div className="hw-pts-count hw-anim hw-pts-hasc">
                <div className="hw-strip hw-anim hw-pts-up">
                  {count(0, 10).map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
              </div>
              <span className="hw-round hw-anim hw-pts-plus">+</span>
            </div>
          </div>
        </div>

        <div className="hw-pts-card">
          <div className="hw-pts-top hw-anim hw-pts-dim">
            <div className="hw-pts-flag">
              <span>🇺🇸</span>
              <span className="hw-pts-standby">STANDBY</span>
            </div>
            <div className="hw-pts-name">New York</div>
            <div className="hw-chips">
              <span>🏙️ City break</span>
            </div>
          </div>
          <div className="hw-perf" />
          <div className="hw-pts-foot">
            <span className="hw-veto hw-swap hw-anim hw-pts-vbtn">
              <span className="hw-anim hw-pts-a">🚫 Veto</span>
              <span className="hw-anim hw-pts-b">Undo veto</span>
            </span>
            <div className="hw-stepper off">
              <span className="hw-round">−</span>
              <div className="hw-pts-zero">0</div>
              <span className="hw-round">+</span>
            </div>
          </div>
          <div className="hw-stamp hw-anim">VETO</div>
        </div>
      </div>

      <div className="hw-lock hw-swap hw-anim">
        <span className="hw-anim hw-lock-a">Lock in my points</span>
        <span className="hw-anim hw-lock-b">✓ Locked in</span>
      </div>
    </Stage>
  );
}

// The letters each remark flap riffles through on its way from "ON TIME" to its last word. Fixed, so
// the prerendered page and the browser draw the same thing.
const RIFFLE = "QB7X3RMZ5WHPC9JUF2GVKS8Z6TQ3HY9MGPCJ2USR";

function remarkFlaps(to: string) {
  const from = "ON TIME ";
  return Array.from({ length: 8 }, (_, i) => [from[i], RIFFLE[i * 3 + 1], RIFFLE[i * 3 + 2], RIFFLE[i * 3 + 3], to[i]]);
}

const pad = (s: string, n: number) => s.padEnd(n, " ").slice(0, n).split("");

/** The departures board flips each idea to "DELAYED" in turn until Lisbon is left boarding. */
function DrawStage() {
  const rows = [
    { code: "NYC", name: "NEW YORK", remark: "DELAYED " },
    { code: "HER", name: "CRETE", remark: "DELAYED " },
    { code: "KIX", name: "KYOTO", remark: "DELAYED " },
    { code: "LIS", name: "LISBON", remark: "BOARDING", win: true },
  ];
  const confetti = ["#0f766e", "#ea580c", "#2563eb", "#db2777", "#ca8a04", "#7c3aed", "#16a34a", "#dc2626", "#2dd4bf", "#d97706", "#0891b2", "#ea580c"];
  const delays = [0, 0.25, 0.1, 0.4, 0.15, 0.05, 0.35, 0.2, 0.45, 0.1, 0.3, 0.5];
  const lefts = [6, 14, 23, 31, 40, 48, 57, 65, 73, 81, 89, 95];
  return (
    <Stage name="draw" label={<Eyebrow>The draw</Eyebrow>}>
      <div className="hw-board">
        <div className="hw-board-head">
          <div className="hw-board-title">
            <span className="hw-board-icon">🎟️</span>DEPARTURES
          </div>
          <div className="hw-board-round">ROUND 3 · 4 IDEAS</div>
        </div>
        <div className="hw-board-rows">
          <div className="hw-board-cols">
            <div style={{ width: 50 }}>CODE</div>
            <div style={{ width: 135 }}>DESTINATION</div>
            <div>REMARKS</div>
          </div>
          {rows.map((r, n) => (
            <div key={r.code} className={`hw-fb-row r${n + 1}`}>
              <div className={r.win ? "hw-fb-group lit" : "hw-fb-group hw-anim off"}>
                {pad(r.code, 3).map((ch, i) => (
                  <span key={i} className="hw-flap">
                    {ch}
                  </span>
                ))}
              </div>
              <div className={r.win ? "hw-fb-group lit" : "hw-fb-group hw-anim off"}>
                {pad(r.name, 8).map((ch, i) => (
                  <span key={i} className="hw-flap">
                    {ch}
                  </span>
                ))}
              </div>
              <div className="hw-fb-group hw-anim remark">
                {remarkFlaps(r.remark).map((strip, i) => (
                  <span key={i} className="hw-flap">
                    <span className="hw-fb-strip" style={{ animationDelay: `${i * 0.04}s` }}>
                      {strip.map((ch, j) => (
                        <span key={j}>{ch}</span>
                      ))}
                    </span>
                  </span>
                ))}
              </div>
              <span className="hw-fb-dot hw-anim" />
            </div>
          ))}
        </div>
      </div>

      <div className="hw-result">
        <div className="hw-wait hw-anim">Drawing…</div>
        <div className="hw-win hw-anim">
          <div className="hw-win-text">
            <div className="hw-mono-label">🏆 WINNER</div>
            <div className="hw-win-name">🇵🇹 Lisbon and Porto</div>
          </div>
          <span className="hw-btn hw-anim hw-win-glow">Plan the trip</span>
        </div>
      </div>

      <div className="hw-confetti">
        {confetti.map((c, i) => (
          <span
            key={i}
            className={`hw-anim ${i % 2 ? "fall-b" : "fall-a"}`}
            style={{ left: `${lefts[i]}%`, background: c, animationDelay: `${delays[i]}s`, borderRadius: i % 3 === 2 ? "50%" : undefined } as CSSProperties}
          />
        ))}
      </div>
    </Stage>
  );
}

/** The winner's boarding pass arrives, the plane crosses, the family boards and the countdown ticks. */
function DepartureStage() {
  const people = [
    { initial: "M", colour: "#2563eb" },
    { initial: "S", colour: "#db2777" },
    { initial: "E", colour: "#16a34a" },
    { initial: "J", colour: "#ea580c" },
  ];
  return (
    <Stage name="departure" label={<Eyebrow>Next departure</Eyebrow>}>
      <div className="hw-pass hw-anim">
        <div className="hw-pass-head">
          <span className="hw-pass-label">BOARDING PASS</span>
          <span className="hw-pass-pill">🏆 Won the draw</span>
          <span className="hw-pass-tag">TICKET 1 / 4</span>
        </div>
        <div className="hw-pass-title">
          <span>🇵🇹</span>Lisbon and Porto
        </div>
        <div className="hw-pass-route">
          <div className="hw-pass-code">LHR</div>
          <div className="hw-pass-line">
            <div className="hw-plane hw-anim">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" transform="rotate(90 12 12)" />
              </svg>
            </div>
          </div>
          <div className="hw-pass-code hw-anim hw-dest">LIS</div>
        </div>
        <div className="hw-pass-facts">
          <div>
            <span className="hw-pass-label">NIGHTS AWAY</span>
            <span className="hw-pass-nights">7</span>
          </div>
          <div>
            <span className="hw-pass-label">PASSENGERS</span>
            <div className="hw-pass-people">
              {people.map((p, i) => (
                <span key={p.initial} className={`hw-pass-av hw-anim av${i + 1}`} style={{ background: p.colour }}>
                  {p.initial}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="hw-pass-label">DEPARTS IN</span>
            <div className="hw-pass-days">
              <span className="hw-dflap">4</span>
              <span className="hw-dflap">
                <span className="hw-strip hw-anim hw-day">
                  <span>3</span>
                  <span>2</span>
                </span>
              </span>
              <span className="hw-pass-label">DAYS</span>
            </div>
          </div>
        </div>
        <span className="hw-pass-btn hw-anim">Start planning</span>
      </div>
    </Stage>
  );
}

/** The trip plan's tabs in turn: the days fill in, the budget bar grows, the packing gets ticked off. */
function PlanStage() {
  const days = [
    { day: "DAY 1", what: "✈️ Fly out, settle into Alfama", status: "booked" },
    { day: "DAY 2", what: "Tram 28 and Belém" },
    { day: "DAY 3", what: "Beach day in Cascais" },
    { day: "DAY 4", what: "🚆 Train to Porto", status: "tobook" },
  ];
  const packing = [
    { item: "Passports", initial: "M", colour: "#2563eb" },
    { item: "Sun cream", initial: "S", colour: "#db2777" },
    { item: "Plug adapters", initial: "E", colour: "#16a34a" },
    { item: "Swimming kit", initial: "J", colour: "#ea580c" },
  ];
  return (
    <Stage name="plan" label={<Eyebrow>Trip plan</Eyebrow>}>
      <div className="hw-plan-pass">
        <div className="hw-plan-main">
          <div className="hw-pass-label">TRIP PLAN · 7 NIGHTS</div>
          <div className="hw-plan-name">🇵🇹 Lisbon and Porto</div>
          <div className="hw-plan-route">LHR → LIS → OPO → LHR</div>
        </div>
        <div className="hw-plan-count">
          <div className="hw-pass-label">DEPARTS IN</div>
          <div className="hw-pass-days">
            <span className="hw-dflap small">4</span>
            <span className="hw-dflap small">2</span>
            <span className="hw-pass-label">DAYS</span>
          </div>
        </div>
      </div>

      <div className="hw-plan-panel">
        <div className="hw-plan-tabs">
          <span>Overview</span>
          <span className="hw-anim t2">Itinerary</span>
          <span className="hw-anim t3">Costs</span>
          <span className="hw-anim t4">Packing</span>
          <span className="hw-plan-bar hw-anim">
            <span />
          </span>
        </div>

        <div className="hw-plan-panes">
          <div className="hw-pane hw-anim p1">
            {days.map((d, i) => (
              <div key={d.day} className={`hw-plan-row hw-anim d${i + 1}`}>
                <span className="hw-plan-day">{d.day}</span>
                <span className="hw-plan-what">{d.what}</span>
                {d.status === "booked" ? <span className="hw-status booked">BOOKED</span> : d.status === "tobook" ? <span className="hw-status tobook">TO BOOK</span> : <span />}
              </div>
            ))}
          </div>

          <div className="hw-pane hw-anim p2 hw-costs">
            <div className="hw-costs-total">
              <strong>£1,860</strong>
              <span>of your £2,400 budget</span>
            </div>
            <div className="hw-costs-bar">
              <span className="hw-anim g1" />
              <span className="hw-anim g2" />
            </div>
            <div className="hw-costs-key">
              <span>
                <i className="booked" />
                Booked
              </span>
              <span>
                <i className="est" />
                Estimated
              </span>
            </div>
            <div className="hw-costs-rows">
              <div>
                ✈️ Flights <span className="hw-status booked">BOOKED</span>
              </div>
              <div>
                🚆 Train to Porto <span className="hw-status tobook">TO BOOK</span>
              </div>
            </div>
          </div>

          <div className="hw-pane hw-anim p3 hw-packing">
            {packing.map((p, i) => (
              <div key={p.item} className="hw-pack-row">
                <span className={`hw-tick hw-anim k${i + 1}`}>✓</span>
                <span className={`hw-pack-item hw-anim x${i + 1}`}>{p.item}</span>
                <span className="hw-avatar small" style={{ background: p.colour }}>
                  {p.initial}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Stage>
  );
}

const STAGES: Record<HowStep, ReactNode> = {
  ideas: <IdeasStage />,
  points: <PointsStage />,
  draw: <DrawStage />,
  departure: <DepartureStage />,
  plan: <PlanStage />,
};
