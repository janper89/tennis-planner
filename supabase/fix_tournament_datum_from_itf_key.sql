-- Oprava data turnaje podle ITF tournament_key (např. J100 Budapest květen 2026 = 12. 5.).
-- Spusť v Supabase SQL editoru, pokud už v tabulce tournament existuje špatné datum.

UPDATE tournament
SET datum = '2026-05-12'::date
WHERE upper(trim(tournament_key)) = 'J-J100-HUN-2026-001'
  AND datum IS DISTINCT FROM '2026-05-12'::date;

-- Volitelně srovnej cache (pokud tam datum nesedí s factsheetem).
UPDATE tournament_cache
SET start_date = '2026-05-12'::date
WHERE upper(trim(tournament_key)) = 'J-J100-HUN-2026-001'
  AND start_date IS DISTINCT FROM '2026-05-12'::date;
