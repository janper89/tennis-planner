-- Change email for Pavel Dufek: pavel.dufek@storaenso.com → lock.dufek@seznam.cz
-- Run this in Supabase Dashboard → SQL Editor (project where the user exists).
-- Requires service role / run as postgres (Dashboard SQL Editor has full access).

-- 1) Update Supabase Auth (auth.users)
UPDATE auth.users
SET email = 'lock.dufek@seznam.cz'
WHERE email = 'pavel.dufek@storaenso.com';

-- 2) Update app_user so JWT email matches
UPDATE app_user
SET email = 'lock.dufek@seznam.cz'
WHERE email = 'pavel.dufek@storaenso.com';

-- Check result (optional)
SELECT id, email FROM auth.users WHERE email = 'lock.dufek@seznam.cz';
SELECT id, email, role FROM app_user WHERE email = 'lock.dufek@seznam.cz';
