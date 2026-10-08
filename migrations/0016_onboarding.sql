-- Whether someone has been through the welcome steps shown the first time they sign in.
-- Everyone already here has been using the app, so they skip it (they can replay it from Settings).
ALTER TABLE people ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;
UPDATE people SET onboarded = 1;
