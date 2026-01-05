-- Zkontroluj co už je v databázi
-- Spusť tyto dotazy v Supabase SQL Editoru

-- 1. Zkontroluj uživatele v Authentication (auth.users)
-- POZNÁMKA: Tento dotaz možná nebude fungovat kvůli RLS, zkus to
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Zkontroluj uživatele v app_user tabulce
SELECT 
  id,
  email,
  role,
  created_at
FROM app_user
ORDER BY created_at DESC;

-- 3. Zkontroluj hráče (pokud nějaké jsou)
SELECT 
  id,
  name,
  birth_date,
  rocnik,
  category,
  parent_id,
  coach_id,
  limit_turnaju
FROM player
ORDER BY created_at DESC;

-- 4. Zkontroluj turnaje (pokud nějaké jsou)
SELECT 
  id,
  nazev,
  kategorie,
  misto,
  datum,
  created_by
FROM tournament
ORDER BY datum DESC;

-- 5. Zkontroluj přihlášky (pokud nějaké jsou)
SELECT 
  id,
  player_id,
  tournament_id,
  priority,
  status,
  created_at
FROM entry
ORDER BY created_at DESC;

