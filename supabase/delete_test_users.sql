-- Skript pro smazání testovacích uživatelů
-- Spusť v Supabase SQL Editor

-- Smazání záznamů pro j.perutka@seznam.cz
DELETE FROM entry
WHERE player_id IN (
    SELECT id FROM player WHERE parent_id IN (
        SELECT id FROM app_user WHERE email = 'j.perutka@seznam.cz'
    )
);

DELETE FROM tournament 
WHERE created_by IN (
    SELECT id FROM app_user WHERE email = 'j.perutka@seznam.cz'
);

DELETE FROM player 
WHERE parent_id IN (
    SELECT id FROM app_user WHERE email = 'j.perutka@seznam.cz'
);

DELETE FROM app_user 
WHERE email = 'j.perutka@seznam.cz';

-- Smazání záznamů pro perutka@proton.me
DELETE FROM entry
WHERE player_id IN (
    SELECT id FROM player WHERE parent_id IN (
        SELECT id FROM app_user WHERE email = 'perutka@proton.me'
    )
);

DELETE FROM tournament 
WHERE created_by IN (
    SELECT id FROM app_user WHERE email = 'perutka@proton.me'
);

DELETE FROM player 
WHERE parent_id IN (
    SELECT id FROM app_user WHERE email = 'perutka@proton.me'
);

DELETE FROM app_user 
WHERE email = 'perutka@proton.me';

-- Ověření - zobraz zbývající uživatele
SELECT email, role, created_at FROM app_user ORDER BY email;
