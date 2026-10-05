-- Where a trip or idea set off from and arrived at (an airport, station or cruise port), as JSON.
-- These are separate from its places, which are the cities visited.
ALTER TABLE trips ADD COLUMN depart TEXT;
ALTER TABLE trips ADD COLUMN arrive TEXT;
ALTER TABLE ideas ADD COLUMN depart TEXT;
ALTER TABLE ideas ADD COLUMN arrive TEXT;
