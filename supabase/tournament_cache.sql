-- Migration: Create tournament_cache table for ITF/factsheet cache
-- Description: Cache of tournaments (e.g. from IPIN factsheets), updated periodically.
--              Used for search in app instead of live ITF API.

CREATE TABLE IF NOT EXISTS tournament_cache (
    tournament_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    start_date DATE NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tournament_cache IS 'Cache of tournaments from factsheet/ITF; refreshed periodically (e.g. every 2 months). Used for search by name.';

-- Authenticated and anon can read (for search from app; anon used when JWT role is anon)
ALTER TABLE tournament_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tournament cache"
    ON tournament_cache FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Anon can read tournament cache"
    ON tournament_cache FOR SELECT
    TO anon
    USING (true);

-- Only service role / migrations can insert/update (populate via script or dashboard)
CREATE POLICY "Service role can manage tournament cache"
    ON tournament_cache FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
