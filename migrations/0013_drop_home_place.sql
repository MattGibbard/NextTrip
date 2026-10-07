-- The home place is gone from Settings: travel times now start from the home airport.
DELETE FROM family_settings WHERE key = 'home';
