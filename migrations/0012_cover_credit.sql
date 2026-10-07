-- Who took a suggested cover photo, as JSON, so it can be credited under it.
ALTER TABLE trips ADD COLUMN cover_credit TEXT;
ALTER TABLE ideas ADD COLUMN cover_credit TEXT;
