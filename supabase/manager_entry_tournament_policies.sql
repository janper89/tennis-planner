-- RLS policies pro manažera: přidávat hráče, turnaje a přihlášky
-- Spustit v Supabase SQL Editoru po schema.sql a coach_rls_policies.sql
-- Lze spustit znovu (politiky se přepíší).

-- =============================================
-- PLAYER – manažer může přidávat a spravovat hráče
-- =============================================

DROP POLICY IF EXISTS "Managers can insert players" ON player;
CREATE POLICY "Managers can insert players"
  ON player FOR INSERT
  WITH CHECK (get_user_role() = 'manager');

DROP POLICY IF EXISTS "Managers can update any player" ON player;
CREATE POLICY "Managers can update any player"
  ON player FOR UPDATE
  USING (get_user_role() = 'manager');

DROP POLICY IF EXISTS "Managers can delete any player" ON player;
CREATE POLICY "Managers can delete any player"
  ON player FOR DELETE
  USING (get_user_role() = 'manager');

-- =============================================
-- ENTRY – manažer může přidávat a spravovat přihlášky libovolnému hráči
-- =============================================

DROP POLICY IF EXISTS "Managers can insert entries for any player" ON entry;
CREATE POLICY "Managers can insert entries for any player"
  ON entry FOR INSERT
  WITH CHECK (get_user_role() = 'manager');

DROP POLICY IF EXISTS "Managers can update any entry" ON entry;
CREATE POLICY "Managers can update any entry"
  ON entry FOR UPDATE
  USING (get_user_role() = 'manager');

DROP POLICY IF EXISTS "Managers can delete any entry" ON entry;
CREATE POLICY "Managers can delete any entry"
  ON entry FOR DELETE
  USING (get_user_role() = 'manager');

-- =============================================
-- TOURNAMENT – manažer může vytvářet turnaje
-- =============================================

DROP POLICY IF EXISTS "Managers can create tournaments" ON tournament;
CREATE POLICY "Managers can create tournaments"
  ON tournament FOR INSERT
  WITH CHECK (
    get_user_role() = 'manager' AND
    created_by = get_user_id()
  );
