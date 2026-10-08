-- Cover photos picked from Pixabay. Its rules don't allow showing its own links for good,
-- so a picked photo is copied here and served from /api/photos/<key>.
CREATE TABLE IF NOT EXISTS photos (
  key TEXT PRIMARY KEY,
  family_id INTEGER NOT NULL,
  pixabay_id INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_family ON photos (family_id, pixabay_id);
