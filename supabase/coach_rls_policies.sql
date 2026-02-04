-- RLS pravidla pro trenera (Faze 1)
-- Spustit v Supabase SQL Editoru

-- =============================================
-- PLAYER - trener muze pridavat a upravovat sve hrace
-- =============================================

-- Trener muze pridavat hrace (bez rodice, s coach_id = sebe)
CREATE POLICY "Coaches can insert players"
    ON player FOR INSERT
    WITH CHECK (
        get_user_role() = 'coach' AND
        coach_id = get_user_id() AND
        parent_id IS NULL
    );

-- Trener muze upravovat sve hrace
CREATE POLICY "Coaches can update their players"
    ON player FOR UPDATE
    USING (
        get_user_role() = 'coach' AND
        coach_id = get_user_id()
    );

-- =============================================
-- ENTRY - trener muze spravovat prihlasky svych hracu
-- =============================================

-- Trener muze pridavat prihlasky pro sve hrace
CREATE POLICY "Coaches can insert entries for their players"
    ON entry FOR INSERT
    WITH CHECK (
        get_user_role() = 'coach' AND
        EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.coach_id = get_user_id()
        )
    );

-- Trener muze upravovat prihlasky svych hracu
CREATE POLICY "Coaches can update entries for their players"
    ON entry FOR UPDATE
    USING (
        get_user_role() = 'coach' AND
        EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.coach_id = get_user_id()
        )
    );

-- Trener muze mazat prihlasky svych hracu
CREATE POLICY "Coaches can delete entries for their players"
    ON entry FOR DELETE
    USING (
        get_user_role() = 'coach' AND
        EXISTS (
            SELECT 1 FROM player 
            WHERE player.id = entry.player_id 
            AND player.coach_id = get_user_id()
        )
    );

-- =============================================
-- TOURNAMENT - trener muze vytvaret turnaje
-- =============================================

-- Trener muze vytvaret turnaje
CREATE POLICY "Coaches can create tournaments"
    ON tournament FOR INSERT
    WITH CHECK (
        get_user_role() = 'coach' AND
        created_by = get_user_id()
    );

-- Trener muze upravovat sve turnaje
CREATE POLICY "Coaches can update their tournaments"
    ON tournament FOR UPDATE
    USING (
        get_user_role() = 'coach' AND
        created_by = get_user_id()
    );

-- Trener muze mazat sve turnaje
CREATE POLICY "Coaches can delete their tournaments"
    ON tournament FOR DELETE
    USING (
        get_user_role() = 'coach' AND
        created_by = get_user_id()
    );
