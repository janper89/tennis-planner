-- Add manual adjustment counter for historically played tournaments.
-- This counter is separate from entry.status='odehrano' and can be changed by +/- controls in UI.

ALTER TABLE player
  ADD COLUMN IF NOT EXISTS manual_played_adjustment INTEGER NOT NULL DEFAULT 0;

ALTER TABLE player
  DROP CONSTRAINT IF EXISTS player_manual_played_adjustment_check;

ALTER TABLE player
  ADD CONSTRAINT player_manual_played_adjustment_check
  CHECK (manual_played_adjustment >= 0);
