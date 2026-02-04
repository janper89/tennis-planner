-- Fáze 2: Kód pro připojení rodiče k dítěti (hráči)
-- Spustit v Supabase SQL Editoru po schema.sql a coach_rls_policies.sql

-- Sloupce na player
ALTER TABLE player
  ADD COLUMN IF NOT EXISTS parent_connection_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS parent_connection_code_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN player.parent_connection_code IS 'Jednorázový kód pro připojení rodiče; po použití se vynuluje';
COMMENT ON COLUMN player.parent_connection_code_expires_at IS 'Platnost kódu; po expiraci nelze kód použít';

-- RPC: Rodič se připojí k dítěti zadáním kódu
CREATE OR REPLACE FUNCTION connect_child_with_code(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user_id UUID;
  user_role user_role;
  target_player player%ROWTYPE;
BEGIN
  IF code_input IS NULL OR trim(code_input) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kód je prázdný');
  END IF;

  app_user_id := get_user_id();
  IF app_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Uživatel není přihlášen');
  END IF;

  user_role := get_user_role();
  IF user_role != 'parent' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pouze rodič může připojit dítě pomocí kódu');
  END IF;

  SELECT * INTO target_player
  FROM player
  WHERE parent_connection_code = trim(code_input)
    AND (parent_connection_code_expires_at IS NULL OR parent_connection_code_expires_at > NOW());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Neplatný nebo expirovaný kód');
  END IF;

  UPDATE player
  SET parent_id = app_user_id,
      parent_connection_code = NULL,
      parent_connection_code_expires_at = NULL
  WHERE id = target_player.id;

  RETURN jsonb_build_object('success', true, 'player_name', target_player.name);
END;
$$;

-- RPC: Trenér nebo manažer vygeneruje kód pro rodiče (pro daného hráče)
CREATE OR REPLACE FUNCTION generate_parent_connection_code(p_player_id UUID, p_expires_in_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user_id UUID;
  user_role user_role;
  new_code TEXT;
  expires_at TIMESTAMPTZ;
BEGIN
  app_user_id := get_user_id();
  IF app_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Uživatel není přihlášen');
  END IF;

  user_role := get_user_role();

  -- Trenér smí jen u svého hráče, manažer u kohokoli
  IF user_role = 'coach' THEN
    IF NOT EXISTS (SELECT 1 FROM player WHERE id = p_player_id AND coach_id = app_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Tento hráč není pod tvým vedením');
    END IF;
  ELSIF user_role != 'manager' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pouze trenér nebo manažer může vygenerovat kód');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM player WHERE id = p_player_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hráč nenalezen');
  END IF;

  -- 8 znaků alfanumerických (hex uppercase)
  new_code := upper(encode(gen_random_bytes(4), 'hex'));
  expires_at := CASE WHEN p_expires_in_days > 0 THEN NOW() + (p_expires_in_days || ' days')::INTERVAL ELSE NULL END;

  UPDATE player
  SET parent_connection_code = new_code,
      parent_connection_code_expires_at = expires_at
  WHERE id = p_player_id;

  RETURN jsonb_build_object('success', true, 'code', new_code, 'expires_at', expires_at);
END;
$$;

-- Grant execute pro authenticated
GRANT EXECUTE ON FUNCTION connect_child_with_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION connect_child_with_code(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION generate_parent_connection_code(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_parent_connection_code(UUID, INT) TO service_role;
