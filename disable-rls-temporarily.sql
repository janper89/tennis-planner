-- DOČASNĚ vypni RLS pro app_user tabulku (pouze pro testování!)
-- Spusť v SQL Editoru
-- POZOR: Toto je jen pro testování, v produkci by to nemělo být!

ALTER TABLE app_user DISABLE ROW LEVEL SECURITY;

-- Po testování znovu zapni:
-- ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;

