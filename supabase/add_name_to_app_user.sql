-- Migration: Add name column to app_user table
-- Date: 2025-01-23
-- Description: Adds name column for displaying user's name instead of just email

-- Add name column (nullable for existing records)
ALTER TABLE app_user 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Add comment to column
COMMENT ON COLUMN app_user.name IS 'Display name of the user (e.g., "Jan Perutka")';
