-- Which person the organiser is, so signing in again on a new device doesn't
-- ask them who they are every time. Filled in from their latest signed-in browser.
ALTER TABLE families ADD COLUMN owner_person_id INTEGER;
UPDATE families SET owner_person_id = (
  SELECT s.person_id FROM sessions s
  WHERE s.family_id = families.id AND s.role = 'owner' AND s.person_id IS NOT NULL
  ORDER BY s.expires_at DESC LIMIT 1
);
