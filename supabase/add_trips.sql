-- Migrace: tabulky pro výjezdy (trip) a přiřazené hráče (trip_player)
-- Výjezd je organizační informace, kterou zakládá trenér (nebo manažer)
-- a která se zobrazí pouze rodičům / hráčům přiřazených hráčů.

-- Tabulka: trip
CREATE TABLE IF NOT EXISTS trip (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    tournament_id UUID REFERENCES tournament(id) ON DELETE SET NULL,
    transport TEXT,
    meeting_point TEXT,
    accommodation TEXT,
    cost_note TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'planovano'
        CHECK (status IN ('planovano', 'probiha', 'ukonceno', 'zruseno')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trip_coach_id ON trip(coach_id);
CREATE INDEX IF NOT EXISTS idx_trip_start_at ON trip(start_at);
CREATE INDEX IF NOT EXISTS idx_trip_tournament_id ON trip(tournament_id);

-- Tabulka: trip_player (vazba M:N mezi výjezdem a hráči)
CREATE TABLE IF NOT EXISTS trip_player (
    trip_id UUID NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (trip_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_player_player_id ON trip_player(player_id);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION trip_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trip_updated_at_trigger ON trip;
CREATE TRIGGER trip_updated_at_trigger
    BEFORE UPDATE ON trip
    FOR EACH ROW
    EXECUTE FUNCTION trip_set_updated_at();

-- ============================================================
-- RLS POLICIES
-- (křížové kontroly trip ↔ trip_player přes SECURITY DEFINER – viz fix_trip_rls_recursion.sql)
-- ============================================================

CREATE OR REPLACE FUNCTION trip_user_has_player_assignment(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM trip_player tp
        JOIN player p ON p.id = tp.player_id
        WHERE tp.trip_id = p_trip_id
            AND (
                p.parent_id = get_user_id()
                OR p.self_managed_by = get_user_id()
                OR (get_user_role() = 'coach' AND p.coach_id = get_user_id())
            )
    );
$$;

CREATE OR REPLACE FUNCTION trip_user_is_coach_owner(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM trip t
        WHERE t.id = p_trip_id
            AND t.deleted_at IS NULL
            AND t.coach_id = get_user_id()
    );
$$;

ALTER TABLE trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_player ENABLE ROW LEVEL SECURITY;

-- -------------------- trip --------------------

-- SELECT: trenér vidí své výjezdy, manager vše,
--        rodič vidí výjezd kde je jeho dítě,
--        hráč (self-managed) vidí výjezd kde je on sám.
DROP POLICY IF EXISTS "Trip visible to relevant users" ON trip;
CREATE POLICY "Trip visible to relevant users"
    ON trip FOR SELECT
    USING (
        deleted_at IS NULL AND (
            get_user_role() = 'manager'
            OR coach_id = get_user_id()
            OR trip_user_has_player_assignment(id)
        )
    );

-- INSERT: trenér nebo manager může vytvořit výjezd (coach_id musí být vlastní id, pokud není manager)
DROP POLICY IF EXISTS "Coaches and managers can insert trips" ON trip;
CREATE POLICY "Coaches and managers can insert trips"
    ON trip FOR INSERT
    WITH CHECK (
        get_user_role() = 'manager'
        OR (get_user_role() = 'coach' AND coach_id = get_user_id())
    );

-- UPDATE: manager kdykoliv, trenér jen vlastní výjezdy
DROP POLICY IF EXISTS "Coaches and managers can update trips" ON trip;
CREATE POLICY "Coaches and managers can update trips"
    ON trip FOR UPDATE
    USING (
        get_user_role() = 'manager'
        OR (get_user_role() = 'coach' AND coach_id = get_user_id())
    );

-- DELETE: manager kdykoliv, trenér jen vlastní výjezdy
DROP POLICY IF EXISTS "Coaches and managers can delete trips" ON trip;
CREATE POLICY "Coaches and managers can delete trips"
    ON trip FOR DELETE
    USING (
        get_user_role() = 'manager'
        OR (get_user_role() = 'coach' AND coach_id = get_user_id())
    );

-- -------------------- trip_player --------------------

-- SELECT: podobně jako trip (pokud může vidět trip, může vidět i přiřazení)
DROP POLICY IF EXISTS "Trip player visible to relevant users" ON trip_player;
CREATE POLICY "Trip player visible to relevant users"
    ON trip_player FOR SELECT
    USING (
        get_user_role() = 'manager'
        OR trip_user_is_coach_owner(trip_id)
        OR EXISTS (
            SELECT 1 FROM player p
            WHERE p.id = trip_player.player_id
                AND (
                    p.parent_id = get_user_id()
                    OR p.self_managed_by = get_user_id()
                    OR (get_user_role() = 'coach' AND p.coach_id = get_user_id())
                )
        )
    );

-- INSERT / DELETE: manager + vlastník výjezdu (trenér)
DROP POLICY IF EXISTS "Coaches and managers can manage trip players (insert)" ON trip_player;
CREATE POLICY "Coaches and managers can manage trip players (insert)"
    ON trip_player FOR INSERT
    WITH CHECK (
        get_user_role() = 'manager'
        OR trip_user_is_coach_owner(trip_id)
    );

DROP POLICY IF EXISTS "Coaches and managers can manage trip players (delete)" ON trip_player;
CREATE POLICY "Coaches and managers can manage trip players (delete)"
    ON trip_player FOR DELETE
    USING (
        get_user_role() = 'manager'
        OR trip_user_is_coach_owner(trip_id)
    );
