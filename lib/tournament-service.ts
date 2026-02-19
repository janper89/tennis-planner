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

    const { data, error } = await supabase
      .from('tournament_cache')
      .select('tournament_key, name, city, start_date, category, country, venue, end_date, draw_size, entry_deadline, withdrawal_deadline, tournament_director_name, official_ball')
      .ilike('name', `%${query}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error searching tournament cache:', error);
      return null;
    }

    const row = data as TournamentCacheRow | null;
    if (!row) return null;

    return mapCacheRowToSearchResult(row);
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
  limit = 10
): Promise<ITFTournamentSearchResult[]> {
  try {
    const query = name.trim();
    if (!query) return [];

    // Použij základní sloupce, které určitě existují v tournament_cache
    // Rozšířené sloupce (country, venue, draw_size, atd.) jsou volitelné a přidávají se až v factsheet migraci
    const { data, error } = await supabase
      .from('tournament_cache')
      .select('tournament_key, name, city, start_date, category')
      .ilike('name', `%${query}%`)
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error searching tournament cache:', error);
      // Pokud je chyba kvůli RLS nebo autentizaci, zkus to ještě jednou s lepším error handlingem
      if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('RLS')) {
        console.error('RLS or permission error - check if tournament_cache policies are set correctly');
      }
      return [];
    }

    const rows = (data ?? []) as TournamentCacheRow[];
    return rows.map((row) => mapCacheRowToSearchResult(row));
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
