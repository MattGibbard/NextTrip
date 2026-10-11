-- When the drawn trip will be: JSON, either {"kind":"exact","start","end"} or {"kind":"month","month"}. NULL means not set.
ALTER TABLE rounds ADD COLUMN trip_dates TEXT;
