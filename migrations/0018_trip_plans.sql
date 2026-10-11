-- Trip plans: once an idea wins a draw the family plans it in more detail.
-- Everything hangs off the winning idea and is kept per family so a whole family can be deleted.
-- Money is in whole minor units (pence) of the family's own currency.
CREATE TABLE IF NOT EXISTS plans (
  idea_id INTEGER PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  budget INTEGER,
  days INTEGER
);

-- A name for a day of the itinerary, like "Fly to Vancouver".
CREATE TABLE IF NOT EXISTS plan_days (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  day INTEGER NOT NULL,
  title TEXT NOT NULL,
  PRIMARY KEY (idea_id, day)
);

-- The things on each day. status: plan, to_book or booked.
CREATE TABLE IF NOT EXISTS plan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  day INTEGER NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'plan' CHECK (status IN ('plan', 'to_book', 'booked')),
  created_by INTEGER REFERENCES people(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS plan_items_idea ON plan_items(idea_id, day);

-- Costs, booked or estimated. paid_by is who paid, so the family can settle up.
CREATE TABLE IF NOT EXISTS plan_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('travel', 'stays', 'activities', 'food', 'other')),
  status TEXT NOT NULL CHECK (status IN ('booked', 'estimate')),
  day INTEGER,
  paid_by INTEGER REFERENCES people(id),
  created_by INTEGER REFERENCES people(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS plan_costs_idea ON plan_costs(idea_id);

-- Paying someone back.
CREATE TABLE IF NOT EXISTS plan_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  from_person INTEGER NOT NULL REFERENCES people(id),
  to_person INTEGER NOT NULL REFERENCES people(id),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS plan_settlements_idea ON plan_settlements(idea_id);

-- Packing. person_id is whose bag it goes in, or NULL for things the family shares.
CREATE TABLE IF NOT EXISTS plan_packing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  label TEXT NOT NULL,
  person_id INTEGER REFERENCES people(id),
  packed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS plan_packing_idea ON plan_packing(idea_id);

-- Jobs to do before you go, each given to someone (or nobody yet), with an optional due date.
CREATE TABLE IF NOT EXISTS plan_todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  family_id INTEGER NOT NULL REFERENCES families(id),
  label TEXT NOT NULL,
  person_id INTEGER REFERENCES people(id),
  due TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS plan_todos_idea ON plan_todos(idea_id);
