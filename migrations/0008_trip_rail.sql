-- Trips can be by train too, so they show as rail tickets and draw their route station to station.
ALTER TABLE trips ADD COLUMN rail INTEGER NOT NULL DEFAULT 0;
