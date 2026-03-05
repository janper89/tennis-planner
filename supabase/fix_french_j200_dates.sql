-- Oprava dat začátků turnajů J200 Cap d'Ail a J200 Istres (zpětná vazba od rodičů).
-- Správné termíny: Cap d'Ail 30.3., Istres 6.4. V aplikaci oba vycházely jako 1.4.
--
-- V projektu jsou DVA místa, kde se ukládá datum turnaje – obě je potřeba opravit:
--   1) tournament       – skutečné turnaje klubu (přihlášky); z toho se bere datum v přehledu.
--   2) tournament_cache  – vyhledávací cache (ITF turnaje); z toho se bere datum při vyhledávání.
--
-- Spustit v Supabase Dashboard → SQL Editor.

-- ========== 1) Tabulka tournament (přehled přihlášek, deadline) ==========
-- Trigger tournament_deadlines_trigger po UPDATE přepočte entry_deadline a withdraw_deadline.

UPDATE tournament
SET datum = '2026-03-30'
WHERE tournament_key = 'J-J200-FRA-2026-001';

UPDATE tournament
SET datum = '2026-04-06'
WHERE tournament_key = 'J-J200-FRA-2026-002';

-- ========== 2) Tabulka tournament_cache (vyhledávání turnajů) ==========
-- Na screenshotu byla právě tato tabulka – u obou řádků start_date 2026-04-01.

UPDATE tournament_cache
SET start_date = '2026-03-30'
WHERE tournament_key = 'J-J200-FRA-2026-001';

UPDATE tournament_cache
SET start_date = '2026-04-06'
WHERE tournament_key = 'J-J200-FRA-2026-002';

-- Kontrola (volitelně po spuštění):
-- SELECT id, nazev, misto, datum, tournament_key FROM tournament
-- WHERE tournament_key IN ('J-J200-FRA-2026-001', 'J-J200-FRA-2026-002');
-- SELECT tournament_key, name, city, start_date FROM tournament_cache
-- WHERE tournament_key IN ('J-J200-FRA-2026-001', 'J-J200-FRA-2026-002');
