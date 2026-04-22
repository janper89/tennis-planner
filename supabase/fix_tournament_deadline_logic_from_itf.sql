-- Oprava logiky termínů v tabulce tournament:
--  - Uzávěrka (entry_deadline) má odpovídat ITF "Entry Deadline"
--  - Odhlášení (withdraw_deadline) má odpovídat ITF "Withdrawal Deadline" (freeze deadline)
-- Pokud textová hodnota z factsheetu není dostupná, zůstane fallback z datum (-10 / -2 dny).

CREATE OR REPLACE FUNCTION parse_itf_deadline_date(deadline_text TEXT)
RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
  t TEXT;
  m TEXT[];
  month_num INT;
BEGIN
  IF deadline_text IS NULL OR btrim(deadline_text) = '' THEN
    RETURN NULL;
  END IF;

  t := lower(deadline_text);

  -- ISO YYYY-MM-DD
  m := regexp_match(t, '(\d{4})-(\d{2})-(\d{2})');
  IF m IS NOT NULL THEN
    RETURN make_date(m[1]::INT, m[2]::INT, m[3]::INT);
  END IF;

  -- DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  m := regexp_match(t, '(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})');
  IF m IS NOT NULL THEN
    RETURN make_date(
      CASE WHEN length(m[3]) = 2 THEN (2000 + m[3]::INT) ELSE m[3]::INT END,
      m[2]::INT,
      m[1]::INT
    );
  END IF;

  -- "Tue 14 Apr 2026 by 15:00GMT" / "14 April 2026"
  m := regexp_match(t, '(\d{1,2})(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\w*\s+(20\d{2})');
  IF m IS NOT NULL THEN
    month_num := CASE left(m[3], 3)
      WHEN 'jan' THEN 1
      WHEN 'feb' THEN 2
      WHEN 'mar' THEN 3
      WHEN 'apr' THEN 4
      WHEN 'may' THEN 5
      WHEN 'jun' THEN 6
      WHEN 'jul' THEN 7
      WHEN 'aug' THEN 8
      WHEN 'sep' THEN 9
      WHEN 'oct' THEN 10
      WHEN 'nov' THEN 11
      WHEN 'dec' THEN 12
      ELSE NULL
    END;
    IF month_num IS NOT NULL THEN
      RETURN make_date(m[4]::INT, month_num, m[1]::INT);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_tournament_deadlines()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_entry DATE;
  parsed_withdraw DATE;
BEGIN
  parsed_entry := parse_itf_deadline_date(NEW.sign_in_deadline_text);
  parsed_withdraw := parse_itf_deadline_date(NEW.withdrawal_deadline_text);

  NEW.entry_deadline := COALESCE(parsed_entry, NEW.datum - INTERVAL '10 days');
  NEW.withdraw_deadline := COALESCE(parsed_withdraw, NEW.datum - INTERVAL '2 days');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_deadlines_trigger ON tournament;
CREATE TRIGGER tournament_deadlines_trigger
  BEFORE INSERT OR UPDATE OF datum, sign_in_deadline_text, withdrawal_deadline_text ON tournament
  FOR EACH ROW
  EXECUTE FUNCTION calculate_tournament_deadlines();

-- 1) Sesynchronizuj tournament.datum s aktualnim start_date z tournament_cache,
--    pokud je tournament_key napojeny a datumy se lisi (typicky historicky fallback YYYY-MM-01).
--    Pri tomto UPDATE vystreli trigger a prepocita entry_deadline/withdraw_deadline podle nove logiky.
UPDATE tournament t
SET datum = c.start_date::DATE
FROM tournament_cache c
WHERE t.tournament_key = c.tournament_key
  AND c.start_date IS NOT NULL
  AND c.start_date::DATE <> t.datum;

-- 2) Backfill entry_deadline/withdraw_deadline i pro radky, kterych se krok 1 netykal
--    (shodna `datum`, jen doted nebyl pouzit ITF text).
UPDATE tournament
SET
  entry_deadline = COALESCE(parse_itf_deadline_date(sign_in_deadline_text), datum - INTERVAL '10 days'),
  withdraw_deadline = COALESCE(parse_itf_deadline_date(withdrawal_deadline_text), datum - INTERVAL '2 days')
WHERE true;
