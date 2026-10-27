// What comes after a blog post's words: a way on that fits the post. Airport posts get a departures
// board of where you could fly, posts about places get those places with their booking links, and
// every post ends with the holiday picker (or, on posts about agreeing, the family draw).
import type { ReactNode } from "react";
import type { Post, PostPlace } from "../blog";
import { api } from "../api";
import { bestMonths } from "../months";
import { photoProps } from "../photos";
import { destinationPath } from "../../shared/seo";
import { flightLink } from "../../shared/flights";
import { hotelLink } from "../../shared/hotels";
import { activitiesLink } from "../../shared/activities";
import { airportFrom, mainAirport } from "../../shared/mainAirports";
import { geoText } from "../../shared/visitor";
import type { From } from "../../shared/visitor";
import { useFrom, useFromOnceUp } from "../visitor";
import { BookCard, Commission } from "./BookCard";
import { Geo } from "./Geo";

/** How many places a post shows to book, and how many rows its departures board has. */
const TILES = 4;
const BOARD_ROWS = 6;
/** A flights post without its own airport gets a board from the visitor's airport once it has this many places. */
const BOARD_MIN = 3;

/** The two people the booking searches are for: visitors don't say how many they are. */
const GUESTS = 2;

/** Which boxes a post gets, from what it's about. */
export function postBoxes(post: Post): { board: "airport" | "visitor" | null; book: "tiles" | "card" | null; end: "picker" | "draw" | null } {
  const airport = !!mainAirport(post.airport);
  const board = airport ? "airport" : post.tags.includes("flights") && post.places.length >= BOARD_MIN ? "visitor" : null;
  if (board) return { board, book: null, end: null };
  // Posts about agreeing on a holiday often borrow a guide's photo without being about that place.
  const deciding = post.tags.includes("deciding-where-to-go");
  return {
    board: null,
    book: post.places.length >= 2 ? "tiles" : post.places.length === 1 && !deciding ? "card" : null,
    end: deciding ? "draw" : "picker",
  };
}

export function PostBoxes({ post }: { post: Post }) {
  const boxes = postBoxes(post);
  const airport = mainAirport(post.airport);
  return (
    <>
      {boxes.board === "airport" && airport && <AirportBoard places={post.places} airport={airportFrom(airport)} />}
      {boxes.board === "visitor" && <VisitorBoard places={post.places} />}
      {boxes.book === "tiles" && <PlaceTiles places={post.places.slice(0, TILES)} />}
      {boxes.book === "card" && (
        <div className="bl-book">
          <BookCard place={post.places[0]} campaign="blog" />
        </div>
      )}
      {boxes.end === "picker" && <PickerBox />}
      {boxes.end === "draw" && <DrawBox />}
    </>
  );
}

/** The places a post is about, each with its photo, flight time, best months and booking links. */
function PlaceTiles({ places }: { places: PostPlace[] }) {
  const from = useFrom(null);
  const book = useFromOnceUp(null);
  const heading = places.length === 2 ? `Book ${places[0].name} or ${places[1].name}` : "Book one of these";
  return (
    <section className="bl-places" aria-labelledby="bl-places">
      <span className="dx-cta-label">IN THIS POST</span>
      <h2 id="bl-places">{heading}</h2>
      <div className={`bl-place-list ${places.length === 3 ? "three" : ""}`}>
        {places.map((p) => {
          const best = bestMonths(p);
          const place = { name: p.name, country: p.country, country_code: p.country_code, lat: p.lat, lon: p.lon };
          const flights = p.to_code && p.to_code !== book.code ? flightLink(book.code, p.to_code, GUESTS, "blog", { currency: book.currency }) : null;
          return (
            <article key={p.slug} className="bl-place">
              <a className="bl-place-photo" href={destinationPath(p.slug)} onClick={() => api.blogClick("guide")}>
                {p.image ? <img {...photoProps(p.image, p.image_size, "(max-width: 600px) 112px, 340px")} alt={p.image_alt} width={p.image_size?.[0]} height={p.image_size?.[1]} loading="lazy" decoding="async" /> : <span aria-hidden>{p.to_code || p.name.slice(0, 3).toUpperCase()}</span>}
              </a>
              <div className="bl-place-body">
                <h3>
                  <a href={destinationPath(p.slug)} onClick={() => api.blogClick("guide")}>
                    {p.name}
                  </a>
                </h3>
                <p className="muted small">
                  <Geo from={from} geo="hours" to={p} fmt="pill" />
                  {best && <span>Best {best}</span>}
                </p>
                <div className="bl-place-links">
                  {flights && <TileLink href={flights} kind="flights" label="✈️ Flights" />}
                  <TileLink href={hotelLink(place, "blog", { guests: GUESTS, currency: book.currency })} kind="hotels" label="🏨 Hotels" />
                  <TileLink href={activitiesLink(place, "blog")} kind="things" label="🎟️ Things to do" />
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <Commission />
    </section>
  );
}

function TileLink({ href, kind, label }: { href: string; kind: "flights" | "hotels" | "things"; label: string }) {
  return (
    <a href={href} target="_blank" rel="sponsored noopener" onClick={() => api.bookClick(kind, "blog")}>
      {label}
    </a>
  );
}

/** The places an airport post links to, as departures from that airport, with the picker set to fly from there. */
function AirportBoard({ places, airport }: { places: PostPlace[]; airport: From }) {
  const rows = places.filter((p) => p.to_code !== airport.code).slice(0, BOARD_ROWS);
  return (
    <Board
      heading={<>Where could you go from {airport.name}?</>}
      code={airport.code}
      rows={rows}
      hours={(p) => <Hours from={airport} to={p} />}
      flights={(p) => (p.to_code ? flightLink(airport.code, p.to_code, GUESTS, "blog", { currency: airport.currency }) : null)}
      picker={`/holiday-picker?from=${airport.code}`}
      pickerLabel={`Pick a holiday from ${airport.name}`}
    />
  );
}

/**
 * A flights post that isn't about one airport (which side of the plane): the same board, flying from
 * wherever the visitor does. The words go through <Geo> so the Worker writes them for each visitor;
 * the links and which rows show change once the page is up.
 */
function VisitorBoard({ places }: { places: PostPlace[] }) {
  const from = useFrom(null);
  const book = useFromOnceUp(null);
  const rows = places.filter((p) => p.to_code !== book.code).slice(0, BOARD_ROWS);
  return (
    <Board
      heading={
        <>
          Where could you go from <Geo from={from} geo="name" />?
        </>
      }
      code={<Geo from={from} geo="code" />}
      rows={rows}
      hours={(p) => <Geo from={from} geo="hours" to={p} fmt="board" />}
      flights={(p) => (p.to_code ? flightLink(book.code, p.to_code, GUESTS, "blog", { currency: book.currency }) : null)}
      picker={mainAirport(book.code) && book.code !== "LON" ? `/holiday-picker?from=${book.code}` : "/holiday-picker"}
      pickerLabel="Pick a holiday for me"
    />
  );
}

/** "✈️ 4H" from a fixed airport, which the Worker mustn't rewrite for the visitor. */
function Hours({ from, to }: { from: From; to: PostPlace }) {
  if (to.lat === null || to.lon === null) return null;
  return <>{geoText({ geo: "hours", to: { lat: to.lat, lon: to.lon }, fmt: "board" }, from)}</>;
}

function Board({
  heading,
  code,
  rows,
  hours,
  flights,
  picker,
  pickerLabel,
}: {
  heading: ReactNode;
  code: ReactNode;
  rows: PostPlace[];
  hours: (p: PostPlace) => ReactNode;
  flights: (p: PostPlace) => string | null;
  picker: string;
  pickerLabel: string;
}) {
  return (
    <section className="bl-board" aria-labelledby="bl-board">
      <div className="bl-board-head">
        <span className="lit">DEPARTURES</span>
        <span>FROM {code}</span>
      </div>
      <h2 id="bl-board">{heading}</h2>
      {rows.length > 0 && (
        <ul>
          {rows.map((p) => {
            const best = bestMonths(p);
            const link = flights(p);
            return (
              <li key={p.slug}>
                <span className="lit">{p.to_code || "···"}</span>
                <a href={destinationPath(p.slug)} onClick={() => api.blogClick("guide")}>
                  {p.name.toUpperCase()}
                </a>
                <span>{hours(p)}</span>
                <span className="bl-board-best">{best ? best.toUpperCase() : ""}</span>
                {link ? (
                  <a className="bl-board-fly" href={link} target="_blank" rel="sponsored noopener" onClick={() => api.bookClick("flights", "blog")} aria-label={`Flights to ${p.name}`}>
                    FLIGHTS ↗
                  </a>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="bl-board-foot">
        <a className="btn bright" href={picker} onClick={() => api.blogClick("picker")}>
          🎲 {pickerLabel}
        </a>
        <p>Answer five quick questions and the board picks somewhere for you. Free, no sign-up.</p>
      </div>
      <p className="bl-board-note">Rough flight times. Flights open on Aviasales, and we may earn a small commission if you book.</p>
    </section>
  );
}

/** The end of most posts: the holiday picker first, as it needs nothing from the reader, then planning with the family. */
function PickerBox() {
  return (
    <div className="dx-cta bl-cta">
      <div>
        <span className="dx-cta-label">🎲 NOT SURE WHERE YET?</span>
        <h2>Answer five questions, get a holiday</h2>
        <p className="muted">Pick when, how long and what you're into, and the departures board picks somewhere that fits. It's free, with no sign-up.</p>
      </div>
      <div className="dx-cta-actions">
        <a className="btn" href="/holiday-picker" onClick={() => api.blogClick("picker")}>
          Pick my holiday
        </a>
        <a href="/#signin" onClick={() => api.blogClick("signin")}>
          Plan it with the family
        </a>
      </div>
    </div>
  );
}

/** The end of posts about agreeing on a holiday: the family draw, which is what they're about. */
function DrawBox() {
  return (
    <div className="dx-cta bl-cta">
      <div>
        <span className="dx-cta-label">🎟️ CAN'T AGREE?</span>
        <h2>Let a fair draw decide</h2>
        <p className="muted">Everyone adds their ideas, spreads their points in secret and gets one veto. Then the draw picks where you go. It's free.</p>
      </div>
      <div className="dx-cta-actions">
        <a className="btn" href="/#signin" onClick={() => api.blogClick("signin")}>
          Start planning
        </a>
        <a href="/holiday-picker" onClick={() => api.blogClick("picker")}>
          Or pick one at random
        </a>
      </div>
    </div>
  );
}
