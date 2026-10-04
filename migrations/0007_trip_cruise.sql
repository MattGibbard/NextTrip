-- Cruises, like road trips, draw their route port to port in order.
ALTER TABLE trips ADD COLUMN cruise INTEGER NOT NULL DEFAULT 0;

UPDATE trips SET cruise = 1 WHERE idea_id IN (SELECT id FROM ideas WHERE holiday_types LIKE '%"cruise"%');
