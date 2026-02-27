-- KROK 1/2: Přidání hodnoty 'player' do enum user_role
--
-- DŮLEŽITÉ: V Supabase SQL Editoru spusť POUZE TENTO JEDEN ŘÁDEK (Run nebo Ctrl+Enter).
-- Počkej, až dotaz doběhne (Success). Teprve pak v NOVÉM dotazu spusť krok 2.
-- Pokud spustíš krok 1 a 2 v jednom bloku, vznikne chyba "invalid input value for enum user_role: player".

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'player';
