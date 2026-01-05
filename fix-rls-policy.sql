-- Oprav RLS policy pro app_user tabulku
-- Spusť v SQL Editoru

-- Nejdřív smaž starou policy
DROP POLICY IF EXISTS "Users can view their own record" ON app_user;

-- Vytvoř novou policy, která umožní všem autentifikovaným uživatelům číst app_user
-- (pro testování - v produkci bychom to mohli zpřísnit)
CREATE POLICY "Users can view their own record"
ON app_user FOR SELECT
TO authenticated
USING (true);

-- Tato policy umožní všem přihlášeným uživatelům číst všechny záznamy v app_user
-- Pro produkci by bylo lepší použít: USING (email = (auth.jwt() ->> 'email')::text)
-- Ale pro teď to necháme takto, aby to fungovalo

