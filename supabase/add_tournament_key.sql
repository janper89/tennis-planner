-- Migration: Add tournament_key column to tournament table
-- Date: 2025-01-21
-- Description: Adds tournament_key column for ITF tournament identification and prevents duplicates

-- Add tournament_key column (nullable for existing records)
ALTER TABLE tournament 
ADD COLUMN IF NOT EXISTS tournament_key TEXT;

-- Create unique index for tournament_key (allows NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_key ON tournament(tournament_key) 
WHERE tournament_key IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN tournament.tournament_key IS 'Unique identifier from ITF system (e.g., tournamentId from IPIN)';
