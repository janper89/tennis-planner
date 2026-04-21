-- Ensure soft-delete friendly uniqueness for entry(player_id, tournament_id).
-- Keeps only one ACTIVE registration per player+tournament.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'entry'
      AND c.conname = 'entry_player_id_tournament_id_key'
  ) THEN
    ALTER TABLE entry DROP CONSTRAINT entry_player_id_tournament_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS entry_player_tournament_active_idx
  ON entry (player_id, tournament_id)
  WHERE deleted_at IS NULL;
