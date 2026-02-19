-- RLS policies pro manažera: přidávat turnaje a přihlášky libovolnému hráči
-- Spustit v Supabase SQL Editoru po schema.sql a coach_rls_policies.sql

-- Managers can insert entries for any player
CREATE POLICY "Managers can insert entries for any player"
  ON entry FOR INSERT
  WITH CHECK (get_user_role() = 'manager');

-- Managers can create tournaments (created_by = self)
CREATE POLICY "Managers can create tournaments"
  ON tournament FOR INSERT
  WITH CHECK (
    get_user_role() = 'manager' AND
    created_by = get_user_id()
  );
