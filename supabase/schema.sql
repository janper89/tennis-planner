-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum type for user roles
CREATE TYPE user_role AS ENUM ('parent', 'coach', 'manager');

-- Create enum type for entry status
CREATE TYPE entry_status AS ENUM ('planovano', 'prihlasen', 'odhlasen', 'odehrano');

-- Table: app_user
CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'parent',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: player
CREATE TABLE player (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    rocnik INTEGER NOT NULL,
    category TEXT,
    coach_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES app_user(id) ON DELETE CASCADE,
    limit_turnaju INTEGER DEFAULT 16,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: tournament
CREATE TABLE tournament (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nazev TEXT NOT NULL,
    kategorie TEXT NOT NULL,
    misto TEXT NOT NULL,
    datum DATE NOT NULL,
    entry_deadline DATE,
    withdraw_deadline DATE,
    poznamka TEXT,
    created_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: entry (přihláška hráče na turnaj)
CREATE TABLE entry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 3),
    status entry_status NOT NULL DEFAULT 'planovano',
    poznamka_rodic TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, tournament_id)
);

-- Function to calculate deadlines
CREATE OR REPLACE FUNCTION calculate_tournament_deadlines()
RETURNS TRIGGER AS $$
BEGIN
    -- entry_deadline = 10 days before tournament date
    NEW.entry_deadline := NEW.datum - INTERVAL '10 days';
    
    -- withdraw_deadline = 2 days before tournament date
    NEW.withdraw_deadline := NEW.datum - INTERVAL '2 days';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate deadlines
CREATE TRIGGER tournament_deadlines_trigger
    BEFORE INSERT OR UPDATE OF datum ON tournament
    FOR EACH ROW
    EXECUTE FUNCTION calculate_tournament_deadlines();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE player ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's app_user id
CREATE OR REPLACE FUNCTION get_user_id() RETURNS UUID AS $$
    SELECT id FROM app_user WHERE email = (auth.jwt() ->> 'email');
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role() RETURNS user_role AS $$
    SELECT role FROM app_user WHERE email = (auth.jwt() ->> 'email');
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies for app_user
CREATE POLICY "Users can view their own record"
    ON app_user FOR SELECT
    USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own record"
    ON app_user FOR UPDATE
    USING (email = auth.jwt() ->> 'email');

-- RLS Policies for player
-- Parent: can see and manage their own children
CREATE POLICY "Parents can view their children"
    ON player FOR SELECT
    USING (
        parent_id = get_user_id() OR
        (get_user_role() = 'coach' AND coach_id = get_user_id()) OR
        get_user_role() = 'manager'
    );

CREATE POLICY "Parents can insert their children"
    ON player FOR INSERT
    WITH CHECK (parent_id = get_user_id());

CREATE POLICY "Parents can update their children"
    ON player FOR UPDATE
    USING (parent_id = get_user_id());

CREATE POLICY "Parents can delete their children"
    ON player FOR DELETE
    USING (parent_id = get_user_id());

-- RLS Policies for tournament
-- Everyone can read tournaments
CREATE POLICY "Everyone can view tournaments"
    ON tournament FOR SELECT
    USING (true);

-- Parents can create tournaments
CREATE POLICY "Parents can create tournaments"
    ON tournament FOR INSERT
    WITH CHECK (created_by = get_user_id());

-- Parents can update/delete their own tournaments
CREATE POLICY "Parents can update their tournaments"
    ON tournament FOR UPDATE
    USING (created_by = get_user_id());

CREATE POLICY "Parents can delete their tournaments"
    ON tournament FOR DELETE
    USING (created_by = get_user_id());

-- RLS Policies for entry
-- Parent: can see and manage entries for their children
CREATE POLICY "Parents can view entries of their children"
    ON entry FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.parent_id = get_user_id()
        ) OR
        (get_user_role() = 'coach' AND EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.coach_id = get_user_id()
        )) OR
        get_user_role() = 'manager'
    );

CREATE POLICY "Parents can insert entries for their children"
    ON entry FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.parent_id = get_user_id()
        )
    );

CREATE POLICY "Parents can update entries for their children"
    ON entry FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.parent_id = get_user_id()
        )
    );

CREATE POLICY "Parents can delete entries for their children"
    ON entry FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.parent_id = get_user_id()
        )
    );

