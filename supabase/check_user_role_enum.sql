-- Kontrola: jaké hodnoty má enum user_role?
-- Spusť v Supabase SQL Editoru. Měl bys vidět parent, coach, manager a po kroku 1 i player.

SELECT enumlabel AS role_value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;
