-- Optional filters chosen when a round starts, as JSON:
-- {"budgets":[1,2],"trip_lengths":["week"],"travel_times":[],"holiday_types":["beach"]}.
-- An empty list means "any".
ALTER TABLE rounds ADD COLUMN filters TEXT NOT NULL DEFAULT '{}';
