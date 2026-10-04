-- Practical details on ideas, shown while spending points.
ALTER TABLE ideas ADD COLUMN budget INTEGER CHECK (budget BETWEEN 1 AND 3);
ALTER TABLE ideas ADD COLUMN trip_length TEXT;
ALTER TABLE ideas ADD COLUMN travel_time TEXT;
-- JSON array of holiday types, e.g. ["beach","food"].
ALTER TABLE ideas ADD COLUMN holiday_types TEXT NOT NULL DEFAULT '[]';

-- Each person can veto one idea per round. A vetoed idea can't get points in that round.
CREATE TABLE IF NOT EXISTS round_vetoes (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id),
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, person_id)
);
