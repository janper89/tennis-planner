import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'];
type TournamentInsertType = Database['public']['Tables']['tournament']['Insert'];
type EntryInsertType = Database['public']['Tables']['entry']['Insert'];

/** Row from tournament_cache (explicit type for select result) */
type TournamentCacheRow = {
  tournament_key: string;
  name: string;
  city: string;
  start_date: string;
  category: string | null;
  country?: string | null;
  venue?: string | null;
  end_date?: string | null;
  draw_size?: string | null;
  entry_deadline?: string | null;
  withdrawal_deadline?: string | null;
  tournament_director_name?: string | null;
  official_ball?: string | null;
  tournament_key_factsheet?: string | null;
};

/**
 * Result from ITF cache search (tournament_cache, optionally with factsheet fields).
 */
export interface ITFTournamentSearchResult {
  tournamentKey: string;
  name: string;
  city: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  category?: string;
  country?: string | null;
  venue?: string | null;
  endDate?: string | null;
  drawSize?: string | null;
  entryDeadline?: string | null;
  withdrawalDeadline?: string | null;
  tournamentDirectorName?: string | null;
  officialBall?: string | null;
}

/** Remove duplicated pattern e.g. "J100 LOUGHBOROUGHJ100 LOUGHBOROUGH (GBR)" → "J100 LOUGHBOROUGH (GBR)" */
function normalizeTournamentName(name: string): string {
  if (!name || typeof name !== 'string') return name || '';
  return name.replace(/^([JW]\d+\s+[A-Za-z]+)\1/i, '$1').trim();
}

function mapCacheRowToSearchResult(row: TournamentCacheRow): ITFTournamentSearchResult {
  return {
    tournamentKey: row.tournament_key,
    name: normalizeTournamentName(row.name),
    city: row.city,
    startDate: row.start_date,
    category: row.category ?? undefined,
    country: row.country ?? undefined,
    venue: row.venue ?? undefined,
    endDate: row.end_date ?? undefined,
    drawSize: row.draw_size ?? undefined,
    entryDeadline: row.entry_deadline ?? undefined,
    withdrawalDeadline: row.withdrawal_deadline ?? undefined,
    tournamentDirectorName: row.tournament_director_name ?? undefined,
    officialBall: row.official_ball ?? undefined,
  };
}

function isCanonicalTournamentKey(key?: string | null): boolean {
  return !!key && /^J-[A-Z0-9-]+$/.test(key);
}

function tournamentMetadataScore(tournament: Tournament): number {
  let score = 0;
  if (tournament.sign_in_deadline_text) score += 2;
  if (tournament.withdrawal_deadline_text) score += 2;
  if (tournament.tournament_director_name) score += 2;
  if (tournament.official_ball) score += 2;
  if (tournament.draw_size) score += 2;
  if (isCanonicalTournamentKey(tournament.tournament_key)) score += 3;
  return score;
}

function buildTournamentEnrichmentUpdate(
  existing: Tournament,
  source: ITFTournamentSearchResult
): Partial<TournamentInsertType> {
  const patch: Partial<TournamentInsertType> = {};
  const normalizedName = normalizeTournamentName(source.name);

  if (!existing.nazev && normalizedName) patch.nazev = normalizedName;
  if (!existing.kategorie && source.category) patch.kategorie = source.category;
  if (!existing.misto && source.city) patch.misto = source.city;
  if (!existing.datum && source.startDate) patch.datum = source.startDate;
  if (!existing.sign_in_deadline_text && source.entryDeadline) {
    patch.sign_in_deadline_text = source.entryDeadline;
  }
  if (!existing.withdrawal_deadline_text && source.withdrawalDeadline) {
    patch.withdrawal_deadline_text = source.withdrawalDeadline;
  }
  if (!existing.tournament_director_name && source.tournamentDirectorName) {
    patch.tournament_director_name = source.tournamentDirectorName;
  }
  if (!existing.official_ball && source.officialBall) {
    patch.official_ball = source.officialBall;
  }
  if (!existing.draw_size && source.drawSize) {
    patch.draw_size = source.drawSize;
  }

  // Upgrade legacy cache key to canonical ITF key where safe.
  if (
    source.tournamentKey &&
    isCanonicalTournamentKey(source.tournamentKey) &&
    !existing.tournament_key
  ) {
    patch.tournament_key = source.tournamentKey;
  }

  return patch;
}

async function enrichTournamentIfMissing(
  existing: Tournament,
  source: ITFTournamentSearchResult,
  supabase: SupabaseClient<Database>
): Promise<Tournament> {
  const update = buildTournamentEnrichmentUpdate(existing, source);
  if (Object.keys(update).length === 0) return existing;

  const { data, error } = await supabase
    .from('tournament')
    // Supabase types can infer never for update payload in some environments.
    .update(update as never)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) throw error;
  return data ?? existing;
}

async function findTournamentBySemanticMatch(
  search: ITFTournamentSearchResult,
  supabase: SupabaseClient<Database>
): Promise<Tournament | null> {
  const normalizedName = normalizeTournamentName(search.name);
  const category = search.category || 'N/A';
  const baseDate = new Date(`${search.startDate}T00:00:00Z`);
  if (Number.isNaN(baseDate.getTime())) return null;

  const from = new Date(baseDate);
  from.setUTCDate(from.getUTCDate() - 14);
  const to = new Date(baseDate);
  to.setUTCDate(to.getUTCDate() + 14);

  const { data, error } = await supabase
    .from('tournament')
    .select('*')
    .ilike('nazev', `%${normalizedName}%`)
    .eq('misto', search.city)
    .eq('kategorie', category)
    .gte('datum', from.toISOString().slice(0, 10))
    .lte('datum', to.toISOString().slice(0, 10))
    .limit(10);

  if (error) return null;
  const rows = (data ?? []) as Tournament[];
  if (rows.length === 0) return null;

  const scored = [...rows].sort((a, b) => {
    const dateA = new Date(`${a.datum}T00:00:00Z`).getTime();
    const dateB = new Date(`${b.datum}T00:00:00Z`).getTime();
    const distanceA = Math.abs(dateA - baseDate.getTime());
    const distanceB = Math.abs(dateB - baseDate.getTime());
    if (distanceA !== distanceB) return distanceA - distanceB;
    return tournamentMetadataScore(b) - tournamentMetadataScore(a);
  });

  return scored[0] ?? null;
}

function normalizeSearchText(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isoWeekKey(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'unknown-week';
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function hasRichMetadata(row: TournamentCacheRow): boolean {
  return !!(
    row.entry_deadline ||
    row.withdrawal_deadline ||
    row.tournament_director_name ||
    row.official_ball ||
    row.draw_size
  );
}

function extractCategoryToken(query: string): string | null {
  const m = query.toUpperCase().match(/\b([JW]\d{2,3})\b/);
  return m ? m[1] : null;
}

function rankAndDedupeMatches(
  rows: TournamentCacheRow[],
  query: string,
  limit: number
): TournamentCacheRow[] {
  const normalizedQuery = normalizeSearchText(query);
  const categoryToken = extractCategoryToken(query);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  const scoreRow = (row: TournamentCacheRow): number => {
    const nameNorm = normalizeSearchText(row.name);
    const cityNorm = normalizeSearchText(row.city);
    const categoryNorm = (row.category || '').toUpperCase();
    let score = 0;

    if (categoryToken && categoryNorm === categoryToken) score += 40;
    if (nameNorm.startsWith(normalizedQuery)) score += 30;
    if (nameNorm.includes(normalizedQuery)) score += 20;
    if (cityNorm.includes(normalizedQuery)) score += 8;

    for (const token of queryTokens) {
      if (nameNorm.includes(token)) score += 6;
      if (cityNorm.includes(token)) score += 3;
    }

    if (hasRichMetadata(row)) score += 25;
    if (row.tournament_key_factsheet) score += 8;
    if (/^J-[A-Z0-9-]+$/.test(row.tournament_key)) score += 6;
    return score;
  };

  const sorted = [...rows].sort((a, b) => {
    const diff = scoreRow(b) - scoreRow(a);
    if (diff !== 0) return diff;
    return a.start_date.localeCompare(b.start_date);
  });

  const byGroup = new Map<string, TournamentCacheRow>();
  for (const row of sorted) {
    const groupKey = [
      normalizeSearchText(row.name),
      normalizeSearchText(row.city),
      normalizeSearchText(row.category || ''),
      isoWeekKey(row.start_date),
    ].join('|');
    const existing = byGroup.get(groupKey);
    if (!existing) {
      byGroup.set(groupKey, row);
      continue;
    }
    const preferCurrent = scoreRow(row) > scoreRow(existing);
    if (preferCurrent) byGroup.set(groupKey, row);
  }

  return Array.from(byGroup.values())
    .sort((a, b) => {
      const diff = scoreRow(b) - scoreRow(a);
      if (diff !== 0) return diff;
      return a.start_date.localeCompare(b.start_date);
    })
    .slice(0, limit);
}

/**
 * Parameters for registering a player for a tournament
 */
export interface RegisterTournamentParams {
  tournamentName: string;
  playerId: string;
  priority: number;
  poznamka?: string;
  userId: string; // app_user.id
  /** Předvybraný turnaj (při výběru z více výsledků) – přeskočí vyhledávání */
  selectedTournament?: ITFTournamentSearchResult;
}

/**
 * Result of tournament registration
 */
export interface RegisterTournamentResult {
  success: boolean;
  tournamentId: string;
  entryId: string;
  message: string;
  tournament?: Tournament;
  error?: string;
}

/**
 * Search for a tournament by name in the tournament_cache table.
 * Cache is populated periodically from factsheets (e.g. every 2 months).
 *
 * @param supabase Supabase client instance
 * @param name Tournament name to search for (partial match)
 * @returns Tournament details or null if not found in cache
 */
export async function searchTournamentByName(
  supabase: SupabaseClient<Database>,
  name: string
): Promise<ITFTournamentSearchResult | null> {
  try {
    const query = name.trim();
    if (!query) return null;

    const results = await searchTournamentsByName(supabase, query, 1);
    return results[0] ?? null;
  } catch (error) {
    console.error('Error searching tournament:', error);
    return null;
  }
}

/**
 * Vyhledá více turnajů podle názvu v tournament_cache (pro výběr z více shod).
 *
 * @param supabase Supabase client instance
 * @param name Hledaný název (částečná shoda)
 * @param limit Maximální počet výsledků (výchozí 10)
 */
export async function searchTournamentsByName(
  supabase: SupabaseClient<Database>,
  name: string,
  limit = 20
): Promise<ITFTournamentSearchResult[]> {
  try {
    const query = name.trim();
    if (!query) return [];

    // Sloupce factsheetu zvyšují kvalitu řazení výsledků, ale cache zůstává použitelná i bez nich.
    const { data, error } = await supabase
      .from('tournament_cache')
      .select('tournament_key, name, city, start_date, category, country, venue, end_date, draw_size, entry_deadline, withdrawal_deadline, tournament_director_name, official_ball, tournament_key_factsheet')
      .or(`name.ilike.%${query}%,city.ilike.%${query}%`)
      .order('start_date', { ascending: true })
      .limit(Math.max(limit * 4, 80));

    if (error) {
      console.error('Error searching tournament cache:', error);
      // Pokud je chyba kvůli RLS nebo autentizaci, zkus to ještě jednou s lepším error handlingem
      if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('RLS')) {
        console.error('RLS or permission error - check if tournament_cache policies are set correctly');
      }
      return [];
    }

    const rows = (data ?? []) as TournamentCacheRow[];
    const rankedRows = rankAndDedupeMatches(rows, query, limit);
    return rankedRows.map((row) => mapCacheRowToSearchResult(row));
  } catch (error) {
    console.error('Error searching tournaments:', error);
    return [];
  }
}

/**
 * Find tournament in database by tournament_key
 * 
 * @param tournamentKey Unique tournament identifier from ITF
 * @param supabase Supabase client instance
 * @returns Tournament if found, null otherwise
 */
export async function findTournamentByKey(
  tournamentKey: string,
  supabase: SupabaseClient<Database>
): Promise<Tournament | null> {
  try {
    const { data, error } = await supabase
      .from('tournament')
      .select('*')
      .eq('tournament_key', tournamentKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - tournament doesn't exist
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error finding tournament by key:', error);
    throw error;
  }
}

/**
 * Create a new tournament in the database
 * 
 * @param tournamentData Tournament data from ITF API
 * @param userId app_user.id who is creating the tournament
 * @param supabase Supabase client instance
 * @returns Created tournament
 */
export async function createTournament(
  tournamentData: ITFTournamentSearchResult,
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<Tournament> {
  try {
    // Map ITF data to our database schema (normalize name to fix duplicates like "J100 LOUGHBOROUGHJ100 LOUGHBOROUGH (GBR)")
    const tournamentInsert: TournamentInsertType = {
      nazev: normalizeTournamentName(tournamentData.name),
      kategorie: tournamentData.category || 'N/A',
      misto: tournamentData.city,
      datum: tournamentData.startDate,
      tournament_key: tournamentData.tournamentKey,
      created_by: userId,
      sign_in_deadline_text: tournamentData.entryDeadline ?? null,
      withdrawal_deadline_text: tournamentData.withdrawalDeadline ?? null,
      tournament_director_name: tournamentData.tournamentDirectorName ?? null,
      official_ball: tournamentData.officialBall ?? null,
      draw_size: tournamentData.drawSize ?? null,
      // entry_deadline and withdraw_deadline are calculated by trigger
    };

    const { data, error } = await supabase
      .from('tournament')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Insert infers never when DB types are out of sync
      .insert(tournamentInsert as any)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation (duplicate tournament_key)
      if (error.code === '23505') {
        throw new Error(
          `Turnaj s tímto klíčem již existuje v databázi: ${tournamentData.tournamentKey}`
        );
      }
      throw error;
    }

    if (!data) {
      throw new Error('Turnaj nebyl vytvořen, ale žádná chyba nebyla vrácena');
    }

    return data;
  } catch (error) {
    console.error('Error creating tournament:', error);
    throw error;
  }
}

/**
 * Create an entry (registration) for a player on a tournament
 * 
 * @param playerId Player ID
 * @param tournamentId Tournament ID
 * @param priority Priority (1-3)
 * @param poznamka Optional note
 * @param supabase Supabase client instance
 * @returns Created entry
 */
export async function createEntry(
  playerId: string,
  tournamentId: string,
  priority: number,
  poznamka: string | null,
  supabase: SupabaseClient<Database>
): Promise<Entry> {
  try {
    const entryInsert: EntryInsertType = {
      player_id: playerId,
      tournament_id: tournamentId,
      priority,
      status: 'planovano',
      poznamka_rodic: poznamka || null,
    };

    const { data, error } = await supabase
      .from('entry')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Insert infers never when DB types are out of sync
      .insert(entryInsert as any)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation (player already registered)
      if (error.code === '23505') {
        throw new Error('Hráč je již na tento turnaj přihlášen');
      }
      throw error;
    }

    if (!data) {
      throw new Error('Přihláška nebyla vytvořena, ale žádná chyba nebyla vrácena');
    }

    return data;
  } catch (error) {
    console.error('Error creating entry:', error);
    throw error;
  }
}

/**
 * Main function: Register a player for a tournament
 * 
 * This function orchestrates the entire process:
 * 1. Search for tournament by name
 * 2. Check if tournament exists in DB by tournament_key
 * 3. Create tournament if it doesn't exist
 * 4. Create entry for the player
 * 5. Return result
 * 
 * @param params Registration parameters
 * @param supabase Supabase client instance
 * @returns Registration result
 */
export async function registerPlayerForTournament(
  params: RegisterTournamentParams,
  supabase: SupabaseClient<Database>
): Promise<RegisterTournamentResult> {
  try {
    // Step 1: Use selected tournament or search in cache
    let searchResult: ITFTournamentSearchResult | null = params.selectedTournament ?? null;
    if (!searchResult) {
      searchResult = await searchTournamentByName(supabase, params.tournamentName);
    }

    if (!searchResult) {
      // Tournament not found in cache
      return {
        success: false,
        tournamentId: '',
        entryId: '',
        message: 'Turnaj nebyl nalezen v seznamu turnajů. Použijte prosím ruční zadání.',
        error: 'TOURNAMENT_NOT_FOUND',
      };
    }

    // Step 2: Check if tournament already exists in our database
    let tournament: Tournament | null = null;
    
    if (searchResult.tournamentKey) {
      tournament = await findTournamentByKey(searchResult.tournamentKey, supabase);
    }
    if (tournament) {
      tournament = await enrichTournamentIfMissing(tournament, searchResult, supabase);
    }

    // Fallback: semantic match (same name/city/category around the same date)
    if (!tournament) {
      tournament = await findTournamentBySemanticMatch(searchResult, supabase);
      if (tournament) {
        tournament = await enrichTournamentIfMissing(tournament, searchResult, supabase);
      }
    }

    // Step 3: Create tournament if it doesn't exist
    if (!tournament) {
      try {
        tournament = await createTournament(searchResult, params.userId, supabase);
      } catch (error: unknown) {
        // If tournament creation fails due to duplicate key, try to fetch it
        const message = error instanceof Error ? error.message : String(error);
        if (typeof message === 'string' && message.includes('již existuje')) {
          tournament = await findTournamentByKey(searchResult.tournamentKey, supabase);
          if (!tournament) {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    if (!tournament) {
      throw new Error('Nepodařilo se získat nebo vytvořit turnaj');
    }

    // Step 4: Create entry for the player
    const entry = await createEntry(
      params.playerId,
      tournament.id,
      params.priority,
      params.poznamka || null,
      supabase
    );

    // Step 5: Return success result
    return {
      success: true,
      tournamentId: tournament.id,
      entryId: entry.id,
      message: `Hráč byl úspěšně přihlášen na turnaj "${tournament.nazev}"`,
      tournament,
    };
  } catch (error: unknown) {
    console.error('Error registering player for tournament:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Došlo k chybě při přihlašování na turnaj';
    
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : 'UNKNOWN_ERROR';
    return {
      success: false,
      tournamentId: '',
      entryId: '',
      message: errorMessage,
      error: code,
    };
  }
}
