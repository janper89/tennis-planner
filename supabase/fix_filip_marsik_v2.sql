-- Oprava: smazat osiřelý záznam filip.marsik@tiscali.cz z auth.users a auth.identities,
-- aby ho šlo vytvořit čistě přes Admin API (které GoTrue akceptuje).
--
-- POZOR: Toto smaže starý auth záznam. Uživatel nemá žádná data vázaná na auth.users.id
-- (přihlášky jsou vázané přes app_user → player → entry, ne přes auth.users).
--
-- Po spuštění tohoto SQL pak v terminálu spusť:
--   node scripts/set-user-password.js
-- (skript uživatele vytvoří přes Admin API a doplní app_user)

-- 1) Smazat identities
DELETE FROM auth.identities
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'filip.marsik@tiscali.cz' LIMIT 1);

-- 2) Smazat starý auth záznam
DELETE FROM auth.users
WHERE email = 'filip.marsik@tiscali.cz';

-- 3) app_user necháváme (je navázaný přes email, ne přes auth.users.id)
-- Jen zkontroluj, že existuje:
SELECT id, email, role FROM app_user WHERE email = 'filip.marsik@tiscali.cz';
