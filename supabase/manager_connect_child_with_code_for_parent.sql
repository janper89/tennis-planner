-- RPC: Oprávněný manažer/admin připojí dítě k rodiči pomocí kódu.
-- Pouze e-maily v seznamu mohou tuto funkci volat (edit mode v impersonation).

CREATE OR REPLACE FUNCTION manager_connect_child_with_code_for_parent(
  code_input TEXT,
  p_parent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  target_player player%ROWTYPE;
  allowed_emails TEXT[] := ARRAY['perutka89@gmail.com', 'al.sprlak@seznam.cz'];
BEGIN
  IF code_input IS NULL OR trim(code_input) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kód je prázdný');
  END IF;

  IF get_user_role() != 'manager' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pouze manažer může použít tuto funkci');
  END IF;

  user_email := auth.jwt() ->> 'email';
  IF user_email IS NULL OR NOT (user_email = ANY(allowed_emails)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nemáš oprávnění připojovat dítě za rodiče');
  END IF;

  SELECT * INTO target_player
  FROM player
  WHERE parent_connection_code = trim(code_input)
    AND (parent_connection_code_expires_at IS NULL OR parent_connection_code_expires_at > NOW());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Neplatný nebo expirovaný kód');
  END IF;

  UPDATE player
  SET parent_id = p_parent_id,
      parent_connection_code = NULL,
      parent_connection_code_expires_at = NULL
  WHERE id = target_player.id;

  RETURN jsonb_build_object('success', true, 'player_name', target_player.name);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_connect_child_with_code_for_parent(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION manager_connect_child_with_code_for_parent(TEXT, UUID) TO service_role;
