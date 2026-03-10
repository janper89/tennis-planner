-- Migrace: category z TEXT na TEXT[] pro podporu více kategorií (U16, U18)
-- Spustit v Supabase SQL Editoru

ALTER TABLE player
  ALTER COLUMN category TYPE text[] USING (
    CASE
      WHEN category IS NULL THEN NULL
      WHEN category ~ '.*,.*' THEN string_to_array(replace(trim(category), ' ', ''), ',')
      ELSE ARRAY[trim(category)]
    END
  );
