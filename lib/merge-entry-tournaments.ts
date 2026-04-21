import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Tournament = Database['public']['Tables']['tournament']['Row'];

/**
 * Doplní `tournament` u záznamů přihlášek, pokud embed z PostgRESTu vrátil null,
 * ale máme k dispozici stejná data z samostatného dotazu na `tournament`.
 */
export function mergeTournamentsFromMap<
  T extends { tournament_id: string; tournament?: Tournament | null },
>(entries: T[], tournamentsById: Map<string, Tournament>): T[] {
  return entries.map((row) => {
    if (row.tournament) return row;
    const t = tournamentsById.get(row.tournament_id);
    return t ? ({ ...row, tournament: t } as T) : row;
  });
}

/** Načte chybějící turnaje podle id a vrátí mapu id → řádek. */
export async function fetchTournamentsByIds(
  supabase: SupabaseClient<Database>,
  ids: string[]
): Promise<Map<string, Tournament>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.from('tournament').select('*').in('id', unique);

  if (error) throw error;
  const rows = (data ?? []) as Tournament[];
  return new Map(rows.map((t) => [t.id, t]));
}
