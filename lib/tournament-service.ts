import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

type Tournament = Database['public']['Tables']['tournament']['Row'];
type TournamentInsert = Database['public']['Tables']['tournament']['Insert'];
type Entry = Database['public']['Tables']['entry']['Row'];
type EntryInsert = Database['public']['Tables']['entry']['Insert'];

// Helper type to ensure correct typing
type TournamentInsertType = Database['public']['Tables']['tournament']['Insert'];

/**
 * Result from ITF API search (placeholder - to be replaced with actual API)
 */
export interface ITFTournamentSearchResult {
  tournamentKey: string;
  name: string;
  city: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  category?: string;
  // Additional fields can be added based on actual ITF API response
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
      .select('tournament_key, name, city, start_date, category')
      .ilike('name', `%${query}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error searching tournament cache:', error);
      return null;
    }

    if (!data) return null;

    return {
      tournamentKey: data.tournament_key,
      name: data.name,
      city: data.city,
      startDate: data.start_date,
      category: data.category ?? undefined,
    };
  } catch (error) {
    console.error('Error searching tournament:', error);
    return null;
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
    // Map ITF data to our database schema
    const tournamentInsert: TournamentInsertType = {
      nazev: tournamentData.name,
      kategorie: tournamentData.category || 'N/A',
      misto: tournamentData.city,
      datum: tournamentData.startDate,
      tournament_key: tournamentData.tournamentKey,
      created_by: userId,
      // entry_deadline and withdraw_deadline are calculated by trigger
    };

    const { data, error } = await supabase
      .from('tournament')
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
    const entryInsert: EntryInsert = {
      player_id: playerId,
      tournament_id: tournamentId,
      priority,
      status: 'planovano',
      poznamka_rodic: poznamka || null,
    };

    const { data, error } = await supabase
      .from('entry')
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
    // Step 1: Search for tournament by name in cache (no live ITF API)
    const searchResult = await searchTournamentByName(supabase, params.tournamentName);

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
      } catch (error: any) {
        // If tournament creation fails due to duplicate key, try to fetch it
        if (error.message?.includes('již existuje')) {
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
  } catch (error: any) {
    console.error('Error registering player for tournament:', error);
    
    // Return user-friendly error message
    const errorMessage = error.message || 'Došlo k chybě při přihlašování na turnaj';
    
    return {
      success: false,
      tournamentId: '',
      entryId: '',
      message: errorMessage,
      error: error.code || 'UNKNOWN_ERROR',
    };
  }
}
