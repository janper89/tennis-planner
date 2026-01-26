-- KROK 1: Smazat jperutka@proton.me a všechna související data

DELETE FROM entry
WHERE player_id IN (
    SELECT id FROM player WHERE parent_id IN (
        SELECT id FROM app_user WHERE email = 'jperutka@proton.me'
    )
);

DELETE FROM tournament 
WHERE created_by IN (
    SELECT id FROM app_user WHERE email = 'jperutka@proton.me'
);

DELETE FROM player 
WHERE parent_id IN (
    SELECT id FROM app_user WHERE email = 'jperutka@proton.me'
);

DELETE FROM app_user 
WHERE email = 'jperutka@proton.me';

-- KROK 2: Přidat jperutka@proton.me jako trenéra

INSERT INTO app_user (email, role) 
VALUES ('jperutka@proton.me', 'coach');

-- Ověření - zobraz všechny uživatele
SELECT email, role, created_at FROM app_user ORDER BY role, email;