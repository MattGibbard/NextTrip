-- Families: each one has a single organiser who signs in by email, plus a
-- private share link for everyone else. We never store the email itself, only
-- a SHA-256 hash of it, which is enough to recognise the organiser next time.
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_hash TEXT UNIQUE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Everything made before sign-in existed belongs to family 1. It has no
-- organiser until someone signs in with the OWNER_EMAIL secret's address.
INSERT OR IGNORE INTO families (id, email_hash, share_token) VALUES (1, NULL, lower(hex(randomblob(18))));

ALTER TABLE people ADD COLUMN family_id INTEGER REFERENCES families(id);
-- Someone removed from a family stays in past draws but no longer takes part.
ALTER TABLE people ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trips ADD COLUMN family_id INTEGER REFERENCES families(id);
ALTER TABLE ideas ADD COLUMN family_id INTEGER REFERENCES families(id);
ALTER TABLE rounds ADD COLUMN family_id INTEGER REFERENCES families(id);

UPDATE people SET family_id = 1 WHERE family_id IS NULL;
UPDATE trips SET family_id = 1 WHERE family_id IS NULL;
UPDATE ideas SET family_id = 1 WHERE family_id IS NULL;
UPDATE rounds SET family_id = 1 WHERE family_id IS NULL;

CREATE INDEX IF NOT EXISTS people_family ON people(family_id);
CREATE INDEX IF NOT EXISTS trips_family ON trips(family_id);
CREATE INDEX IF NOT EXISTS ideas_family ON ideas(family_id);
CREATE INDEX IF NOT EXISTS rounds_family ON rounds(family_id);

-- Settings now belong to a family. The old settings table stays for now, because
-- pull request previews share the live database: until this is merged the live
-- site still uses it, and family 1 copies it again when its organiser first signs in.
CREATE TABLE IF NOT EXISTS family_settings (
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (family_id, key)
);
INSERT OR IGNORE INTO family_settings (family_id, key, value) SELECT 1, key, value FROM settings;

-- A signed-in browser. role: owner (the organiser) or member (came in via the share link).
-- Only a hash of the cookie's token is kept.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_family ON sessions(family_id);

-- One-time sign-in links sent by email. They expire after a few minutes.
CREATE TABLE IF NOT EXISTS login_links (
  token_hash TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS login_links_email ON login_links(email_hash, created_at);
