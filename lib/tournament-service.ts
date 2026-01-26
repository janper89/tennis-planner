import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

type Tournament = Database['public']['Tables']['tournament']['Row'];
type TournamentInsert = Database['public']['Tables']['tournament']['Insert'];
type Entry = Database['public']['Tables']['entry']['Row'];
type EntryInsert = Database['public']['Tables']['entry']['Insert'];

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
 * Search for a tournament by name using ITF API
 * 
 * @param name Tournament name to search for
 * @returns Tournament details or null if not found/API unavailable
 */
export async function searchTournamentByName(
  name: string
): Promise<ITFTournamentSearchResult | null> {
  try {
    // TODO: Replace with actual ITF API call
    // For now, this is a placeholder that simulates API behavior
    
    // Check if ITF API URL is configured
    const itfApiUrl = process.env.NEXT_PUBLIC_ITF_API_URL;
    
    if (!itfApiUrl) {
      console.warn('ITF API URL not configured, using placeholder');
      // Return null to trigger fallback to manual entry
      return null;
    }

    // Placeholder: In real implementation, this would call ITF API
    // Example:
    // const response = await fetch(`${itfApiUrl}/search?name=${encodeURIComponent(name)}`, {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.ITF_API_KEY}`,
    //   },
    // });
    // if (!response.ok) return null;
    // const data = await response.json();
    // return mapITFResponseToSearchResult(data);

    // For now, return null to indicate API is not available
    return null;
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
    const tournamentInsert: TournamentInsert = {
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
      .insert(tournamentInsert)
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
      .insert(entryInsert)
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
    // Step 1: Search for tournament by name
    const searchResult = await searchTournamentByName(params.tournamentName);

    if (!searchResult) {
      // Tournament not found in ITF API or API unavailable
      return {
        success: false,
        tournamentId: '',
        entryId: '',
        message: 'Turnaj nebyl nalezen v ITF databázi. Použijte prosím ruční zadání.',
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
