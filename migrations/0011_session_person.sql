-- Each signed-in browser now belongs to one person, set by the server, so
-- nobody can switch to someone else and see or change their secret points.
ALTER TABLE sessions ADD COLUMN person_id INTEGER REFERENCES people(id);
-- Browsers signed in before this change picked a person on their own. They
-- keep that person: the first request that names one claims it, once.
ALTER TABLE sessions ADD COLUMN legacy INTEGER NOT NULL DEFAULT 0;
UPDATE sessions SET legacy = 1;
CREATE INDEX IF NOT EXISTS sessions_person ON sessions(person_id);

-- One-off links the organiser makes to sign a person in on a new device.
CREATE TABLE IF NOT EXISTS person_links (
  token_hash TEXT PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS person_links_person ON person_links(person_id);
