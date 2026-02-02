-- Přiřazení hráče Dominik Dujka k rodiči Jan Perutka (j.perutka@seznam.cz)

-- Jednoduchá verze - spusť tento SQL dotaz v Supabase SQL Editoru:

UPDATE player
SET parent_id = (
    SELECT id 
    FROM app_user 
    WHERE email = 'j.perutka@seznam.cz'
)
WHERE name = 'Dominik Dujka';

-- Ověření - zobrazí, jestli se přiřazení povedlo:
SELECT 
    p.name AS hráč,
    au.email AS email_rodiče,
    au.name AS jméno_rodiče
FROM player p
LEFT JOIN app_user au ON p.parent_id = au.id
WHERE p.name = 'Dominik Dujka';
