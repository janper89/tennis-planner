-- Sloučení duplicitních hráčů (stejné jméno + datum narození)
-- Pro každou skupinu duplicit: zvolí kanonický záznam (preferuje parent_id IS NOT NULL),
-- přesune entry z duplicit na kanonický, sloučí kategorie, soft-delete duplicit.
-- Spustit v Supabase SQL Editoru PO migraci add_player_category_array.sql

DO $$
DECLARE
  dup RECORD;
  canonical_id UUID;
  dup_id UUID;
  merged_cats text[];
  entry_rec RECORD;
BEGIN
  -- Pro každou skupinu (name, birth_date) s více než 1 aktivním záznamem
  FOR dup IN
    SELECT name, birth_date, array_agg(id ORDER BY (parent_id IS NOT NULL) DESC, created_at) AS ids
    FROM player
    WHERE deleted_at IS NULL
    GROUP BY name, birth_date
    HAVING count(*) > 1
  LOOP
    -- První v pořadí = kanonický (preferujeme parent_id NOT NULL)
    canonical_id := dup.ids[1];

    -- Sloučit kategorie ze všech záznamů do jednoho pole (bez duplicit)
    SELECT array_agg(DISTINCT cat) INTO merged_cats
    FROM (
      SELECT unnest(category) AS cat
      FROM player
      WHERE id = ANY(dup.ids) AND category IS NOT NULL
    ) sub
    WHERE cat IS NOT NULL;

    -- Pro každý duplicitní záznam (kromě kanonického)
    FOR i IN 2..array_length(dup.ids, 1) LOOP
      dup_id := dup.ids[i];

      -- Přesunout entry z duplicity na kanonický
      -- (entry má UNIQUE(player_id, tournament_id), může být konflikt - pak skip)
      FOR entry_rec IN
        SELECT id, tournament_id FROM entry
        WHERE player_id = dup_id AND deleted_at IS NULL
      LOOP
        BEGIN
          UPDATE entry SET player_id = canonical_id
          WHERE id = entry_rec.id;
        EXCEPTION WHEN unique_violation THEN
          -- Konflikt - už existuje entry pro kanonického hráče na tento turnaj
          -- Smazat duplicitní entry (soft delete)
          UPDATE entry SET deleted_at = NOW() WHERE id = entry_rec.id;
        END;
      END LOOP;

      -- Soft-delete duplicity
      UPDATE player SET deleted_at = NOW() WHERE id = dup_id;
    END LOOP;

    -- Aktualizovat kanonický záznam - sloučené kategorie
    UPDATE player
    SET category = merged_cats
    WHERE id = canonical_id
      AND (merged_cats IS NOT NULL AND array_length(merged_cats, 1) > 0);

    RAISE NOTICE 'Sloučeno: % (%), kanonický: %', dup.name, dup.birth_date, canonical_id;
  END LOOP;
END $$;
