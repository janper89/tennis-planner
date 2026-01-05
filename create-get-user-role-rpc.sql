-- Vytvoří RPC funkci pro získání role uživatele
-- Tato funkce má SECURITY DEFINER, takže obchází RLS
-- Spusť v SQL Editoru

CREATE OR REPLACE FUNCTION get_user_role_by_email(user_email text)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM app_user WHERE email = user_email LIMIT 1;
$$;

-- Uděl funkci přístupnou pro authenticated uživatele
GRANT EXECUTE ON FUNCTION get_user_role_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_by_email(text) TO anon;

