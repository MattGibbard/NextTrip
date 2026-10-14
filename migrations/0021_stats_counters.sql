-- More for the owner's stats page (/stats).
-- When each family last opened the app, for "active families". Saved at most once an hour.
ALTER TABLE families ADD COLUMN last_seen_at TEXT;

-- Simple counts per day: sign-in emails sent, sign-ins, taps on the Book it buttons, server errors.
-- Nothing about who did it is kept.
CREATE TABLE IF NOT EXISTS stat_counts (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
