-- Soft delete for player and entry tables
-- Run in Supabase SQL Editor
-- Players and entries are hidden (deleted_at set) instead of permanently removed

ALTER TABLE player ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE entry ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Allow re-adding same player+tournament after soft delete (partial unique index)
-- Drops the existing unique constraint and replaces with partial index
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'entry' AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE entry DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS entry_player_tournament_active_idx
  ON entry (player_id, tournament_id) WHERE deleted_at IS NULL;
