-- When each person joined, for the owner's stats page (/stats). SQLite can't add a column whose default
-- is the current time, so new people get it from the insert in worker/people.ts. Everyone already here
-- counts as joining on 13 October 2026, the day before this was added.
ALTER TABLE people ADD COLUMN created_at TEXT;
UPDATE people SET created_at = '2026-10-13 00:00:00' WHERE created_at IS NULL;
