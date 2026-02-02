-- Přidá povolení čtení tournament_cache pro roli anon (pro vyhledávání z prohlížeče).
-- Spusť v Supabase SQL Editoru, pokud vyhledávání na stránkách nic nenachází.

CREATE POLICY "Anon can read tournament cache"
    ON tournament_cache FOR SELECT
    TO anon
    USING (true);
