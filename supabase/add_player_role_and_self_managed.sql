-- Role "player" a self-managed profil hráče (KROK 2/2)
-- NEJDŘÍV spusť add_player_role_enum_step1.sql, počkej až doběhne, pak spusť tento soubor.
-- Spustit v Supabase SQL Editoru po schema.sql, coach_rls_policies.sql, manager_entry_tournament_policies.sql

-- 1) Sloupec na player: tento hráč spravuje sám přihlášený účet s rolí player
ALTER TABLE player
  ADD COLUMN IF NOT EXISTS self_managed_by UUID REFERENCES app_user(id) ON DELETE SET NULL;

COMMENT ON COLUMN player.self_managed_by IS 'Pokud vyplněno, hráč spravuje svůj profil sám (role player)';

-- 2) RLS – player může číst/upravovat/mazat jen svůj řádek (self_managed_by = get_user_id())
CREATE POLICY "Players can view own profile"
  ON player FOR SELECT
  USING (get_user_role() = 'player' AND self_managed_by = get_user_id());

CREATE POLICY "Players can insert own profile"
  ON player FOR INSERT
  WITH CHECK (get_user_role() = 'player' AND self_managed_by = get_user_id());

CREATE POLICY "Players can update own profile"
  ON player FOR UPDATE
  USING (get_user_role() = 'player' AND self_managed_by = get_user_id());

CREATE POLICY "Players can delete own profile"
  ON player FOR DELETE
  USING (get_user_role() = 'player' AND self_managed_by = get_user_id());

-- 3) RLS – entry: player může spravovat přihlášky u svého hráče
CREATE POLICY "Players can view own entries"
  ON entry FOR SELECT
  USING (
    get_user_role() = 'player' AND
    EXISTS (
      SELECT 1 FROM player
      WHERE player.id = entry.player_id AND player.self_managed_by = get_user_id()
    )
  );

CREATE POLICY "Players can insert own entries"
  ON entry FOR INSERT
  WITH CHECK (
    get_user_role() = 'player' AND
    EXISTS (
      SELECT 1 FROM player
      WHERE player.id = entry.player_id AND player.self_managed_by = get_user_id()
    )
  );

CREATE POLICY "Players can update own entries"
  ON entry FOR UPDATE
  USING (
    get_user_role() = 'player' AND
    EXISTS (
      SELECT 1 FROM player
      WHERE player.id = entry.player_id AND player.self_managed_by = get_user_id()
    )
  );

CREATE POLICY "Players can delete own entries"
  ON entry FOR DELETE
  USING (
    get_user_role() = 'player' AND
    EXISTS (
      SELECT 1 FROM player
      WHERE player.id = entry.player_id AND player.self_managed_by = get_user_id()
    )
  );

-- 4) RLS – tournament: player může vytvářet turnaje (created_by = get_user_id()); update/delete už povoluje "Parents can update/delete" (created_by = get_user_id())
CREATE POLICY "Players can create tournaments"
  ON tournament FOR INSERT
  WITH CHECK (get_user_role() = 'player' AND created_by = get_user_id());
