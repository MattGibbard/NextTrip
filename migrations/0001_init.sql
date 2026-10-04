-- The two travellers. Names are editable in Settings.
CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

INSERT INTO people (id, name, color) VALUES
  (1, 'Matt', '#2563eb'),
  (2, 'Partner', '#db2777');

-- Holidays already taken.
CREATE TABLE trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  cover_url TEXT,
  idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES people(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE trip_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  lat REAL,
  lon REAL
);
CREATE INDEX trip_places_trip ON trip_places(trip_id);

-- Holiday ideas. status: active (in the pool), won (drawn), done (turned into a trip),
-- archived (removed but kept so past draws still make sense).
CREATE TABLE ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'done', 'archived')),
  created_by INTEGER REFERENCES people(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE idea_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  lat REAL,
  lon REAL
);
CREATE INDEX idea_places_idea ON idea_places(idea_id);

-- A points round ending in a draw. status: open, drawn.
CREATE TABLE rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  points_per_person INTEGER NOT NULL CHECK (points_per_person > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'drawn')),
  winner_idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
  winning_ticket INTEGER,
  total_tickets INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  drawn_at TEXT
);

CREATE TABLE allocations (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id),
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  PRIMARY KEY (round_id, person_id, idea_id)
);

CREATE TABLE round_locks (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id),
  locked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, person_id)
);
