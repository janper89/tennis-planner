-- Oprava: infinite recursion detected in policy for relation "trip" (42P17)
--
-- Příčina: trip SELECT kontroluje trip_player, trip_player SELECT/INSERT kontroluje trip → cyklus.
-- Řešení: kontroly přes SECURITY DEFINER funkce s row_security = off.

-- Rodič / self-managed hráč / trenér (svůj hráč) je na výjezdu přiřazen
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

-- Trenér je vlastník výjezdu (není smazaný)
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

-- -------------------- trip --------------------

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

-- INSERT / UPDATE / DELETE beze změny logiky (bez křížového dotazu na trip_player)

-- -------------------- trip_player --------------------

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
