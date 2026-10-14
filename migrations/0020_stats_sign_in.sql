-- Sign-in for the owner's stats page (/stats). Only addresses in the STATS_EMAILS secret get a code.
-- Like the rest of the site, emails, codes and cookies are only kept as hashes.
CREATE TABLE IF NOT EXISTS stats_codes (
  email_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stats_codes_email ON stats_codes(email_hash, created_at);

-- A browser signed in to the stats page. The email hash is checked against STATS_EMAILS on every visit,
-- so taking an address out of the secret signs that person out.
CREATE TABLE IF NOT EXISTS stats_sessions (
  token_hash TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
