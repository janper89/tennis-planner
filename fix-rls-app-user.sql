-- Dočasné řešení: Povol všem autentifikovaným uživatelům číst app_user
-- Spusť v SQL Editoru, pokud RLS blokuje čtení

-- Nejdřív zkontroluj současné policies
SELECT * FROM pg_policies WHERE tablename = 'app_user';

-- Pokud to nefunguje, zkus dočasně upravit policy
-- (NEBO můžeš použít SECURITY DEFINER funkci - viz níže)

-- Alternativně: Použij SECURITY DEFINER funkci místo přímého dotazu
-- Helper funkce už existuje v schema.sql:
-- CREATE OR REPLACE FUNCTION get_user_role() RETURNS user_role AS $$
--     SELECT role FROM app_user WHERE email = (auth.jwt() ->> 'email');
-- $$ LANGUAGE sql SECURITY DEFINER;

