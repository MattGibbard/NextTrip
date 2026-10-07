-- Sign-in emails also carry a 6-digit code, for when the link opens in another app's browser.
-- Only a hash of the code is kept, and a few wrong guesses use the code up.
ALTER TABLE login_links ADD COLUMN code_hash TEXT;
ALTER TABLE login_links ADD COLUMN tries INTEGER NOT NULL DEFAULT 0;
