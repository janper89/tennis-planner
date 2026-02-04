-- Rozšíření tournament_cache o pole z ITF factsheetu (extract-itf-factsheet-browser.js)
--
-- SPUSŤ V: Supabase Dashboard → tvůj projekt → SQL Editor (NE v konzoli prohlížeče F12!)
-- Po spuštění tournament_cache.sql klikni New query, vlož tento soubor a Run.

ALTER TABLE tournament_cache
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS venue_address TEXT,
  ADD COLUMN IF NOT EXISTS venue_telephone TEXT,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS surface TEXT,
  ADD COLUMN IF NOT EXISTS draw_size TEXT,
  ADD COLUMN IF NOT EXISTS singles_main_draw_format TEXT,
  ADD COLUMN IF NOT EXISTS entry_deadline TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_deadline TEXT,
  ADD COLUMN IF NOT EXISTS main_draw_sign_in TEXT,
  ADD COLUMN IF NOT EXISTS qualifying_sign_in TEXT,
  ADD COLUMN IF NOT EXISTS first_day_qualifying TEXT,
  ADD COLUMN IF NOT EXISTS first_day_main_draw TEXT,
  ADD COLUMN IF NOT EXISTS tournament_director_name TEXT,
  ADD COLUMN IF NOT EXISTS tournament_director_email TEXT,
  ADD COLUMN IF NOT EXISTS official_ball TEXT,
  ADD COLUMN IF NOT EXISTS tournament_key_factsheet TEXT;

COMMENT ON COLUMN tournament_cache.country IS 'Host nation from factsheet';
COMMENT ON COLUMN tournament_cache.venue IS 'Venue name';
COMMENT ON COLUMN tournament_cache.entry_deadline IS 'Entry deadline text (e.g. Tue 20th January 2026 by 14:00GMT)';
COMMENT ON COLUMN tournament_cache.withdrawal_deadline IS 'Withdrawal deadline text';
