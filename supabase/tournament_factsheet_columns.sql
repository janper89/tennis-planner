-- Rozšíření tabulky tournament o pole z factsheetu (sign-in, ředitel, míčky).
-- Spustit v Supabase SQL Editoru.

ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS sign_in_deadline_text TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_deadline_text TEXT,
  ADD COLUMN IF NOT EXISTS tournament_director_name TEXT,
  ADD COLUMN IF NOT EXISTS official_ball TEXT;

COMMENT ON COLUMN tournament.sign_in_deadline_text IS 'Text deadline přihlášek z ITF factsheetu';
COMMENT ON COLUMN tournament.tournament_director_name IS 'Jméno ředitele turnaje z factsheetu';
COMMENT ON COLUMN tournament.official_ball IS 'Oficiální míček turnaje z factsheetu';
