-- Oprava jména hráče: Josef -> Josef Lebiš
-- Bezpečné opakované spuštění: mění jen konkrétní aktivní záznam.

UPDATE player
SET name = 'Josef Lebiš'
WHERE id = '6d52eb03-f165-4dce-8848-4cec9dfa6776'
  AND deleted_at IS NULL;
