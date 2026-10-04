-- Trips can be road trips too, so their route draws city to city in order.
ALTER TABLE trips ADD COLUMN road_trip INTEGER NOT NULL DEFAULT 0;

-- Trips made from a road-trip idea start out as road trips.
UPDATE trips SET road_trip = 1 WHERE idea_id IN (SELECT id FROM ideas WHERE holiday_types LIKE '%"road-trip"%');
