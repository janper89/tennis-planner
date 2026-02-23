-- One-off cleanup: merge legacy/light tournament rows into canonical factsheet rows.
-- Safe to run repeatedly.
--
-- Current target:
-- - Canonical J200 Piestany key: J-J200-SVK-2026-002
-- - Legacy/light key: itf-juniors-j200-piestany-svk-2026-04-01

begin;

do $$
declare
  canonical_id uuid;
  legacy_id uuid;
  moved_count int := 0;
  deleted_dup_entries int := 0;
  deleted_tournaments int := 0;
begin
  select t.id
    into canonical_id
  from tournament t
  where upper(coalesce(t.tournament_key, '')) = 'J-J200-SVK-2026-002'
  order by t.created_at asc
  limit 1;

  select t.id
    into legacy_id
  from tournament t
  where lower(coalesce(t.tournament_key, '')) = 'itf-juniors-j200-piestany-svk-2026-04-01'
  order by t.created_at asc
  limit 1;

  if canonical_id is null then
    raise notice 'Cleanup skipped: canonical tournament not found.';
    return;
  end if;

  if legacy_id is null then
    raise notice 'Cleanup skipped: legacy tournament not found.';
    return;
  end if;

  if canonical_id = legacy_id then
    raise notice 'Cleanup skipped: canonical and legacy IDs are identical.';
    return;
  end if;

  -- Move entries to canonical row when there is no conflicting entry for the same player.
  update entry e
     set tournament_id = canonical_id
   where e.tournament_id = legacy_id
     and not exists (
       select 1
         from entry e2
        where e2.player_id = e.player_id
          and e2.tournament_id = canonical_id
     );
  get diagnostics moved_count = row_count;

  -- Remove duplicate leftovers that could not be moved because canonical entry already exists.
  delete from entry e
   where e.tournament_id = legacy_id;
  get diagnostics deleted_dup_entries = row_count;

  delete from tournament t
   where t.id = legacy_id;
  get diagnostics deleted_tournaments = row_count;

  raise notice 'Cleanup summary: moved_entries=%, deleted_duplicate_entries=%, deleted_tournaments=%',
    moved_count, deleted_dup_entries, deleted_tournaments;
end
$$;

commit;

-- Validation:
-- select id, nazev, misto, datum, kategorie, tournament_key
-- from tournament
-- where misto ilike '%piestany%'
-- order by datum;
