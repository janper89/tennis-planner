-- Oprava neplatných hodnot kategorie (např. Dorost) na platné U16/U18
-- Spustit v Supabase SQL Editoru

-- Hráči s neplatnou kategorií (např. Dorost) -> U16
UPDATE player
SET category = ARRAY['U16']::text[]
WHERE deleted_at IS NULL
  AND category IS NOT NULL
  AND NOT (category <@ ARRAY['U16', 'U18']::text[]);

-- Check constraint: pouze U16 a U18
ALTER TABLE player DROP CONSTRAINT IF EXISTS valid_player_categories;
ALTER TABLE player ADD CONSTRAINT valid_player_categories
  CHECK (category IS NULL OR category <@ ARRAY['U16', 'U18']::text[]);
