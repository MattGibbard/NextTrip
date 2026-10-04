-- Swipe to shortlist: a round can start with each person swiping yes or no on
-- every idea in its pool. Once everyone has swiped, the shortlist is fixed as
-- JSON, e.g. {"ids":[3,7],"rule":"both"}, and only those ideas take points.
ALTER TABLE rounds ADD COLUMN swipe INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rounds ADD COLUMN shortlist TEXT;

CREATE TABLE IF NOT EXISTS round_swipes (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id),
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  liked INTEGER NOT NULL CHECK (liked IN (0, 1)),
  PRIMARY KEY (round_id, person_id, idea_id)
);

-- Shared app settings, e.g. key 'home' holds the place travel times are measured from.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
