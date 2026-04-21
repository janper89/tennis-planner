export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      app_user: {
        Row: {
          id: string
          email: string
          role: 'parent' | 'coach' | 'manager' | 'player'
          created_at: string
          name: string | null
        }
        Insert: {
          id?: string
          email: string
          role?: 'parent' | 'coach' | 'manager' | 'player'
          created_at?: string
          name?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: 'parent' | 'coach' | 'manager' | 'player'
          created_at?: string
          name?: string | null
        }
      }
      player: {
        Row: {
          id: string
          name: string
          birth_date: string
          rocnik: number
          category: string[] | null
          coach_id: string | null
          parent_id: string | null
          self_managed_by: string | null
          limit_turnaju: number
          manual_played_adjustment: number
          created_at: string
          parent_connection_code: string | null
          parent_connection_code_expires_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          birth_date: string
          rocnik: number
          category?: string[] | null
          coach_id?: string | null
          parent_id?: string | null
          self_managed_by?: string | null
          limit_turnaju?: number
          manual_played_adjustment?: number
          created_at?: string
          parent_connection_code?: string | null
          parent_connection_code_expires_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          birth_date?: string
          rocnik?: number
          category?: string[] | null
          coach_id?: string | null
          parent_id?: string | null
          self_managed_by?: string | null
          limit_turnaju?: number
          manual_played_adjustment?: number
          created_at?: string
          parent_connection_code?: string | null
          parent_connection_code_expires_at?: string | null
        }
      }
      tournament: {
        Row: {
          id: string
          nazev: string
          kategorie: string
          misto: string
          datum: string
          entry_deadline: string | null
          withdraw_deadline: string | null
          poznamka: string | null
          created_by: string | null
          created_at: string
          tournament_key: string | null
          sign_in_deadline_text: string | null
          withdrawal_deadline_text: string | null
          tournament_director_name: string | null
          official_ball: string | null
          draw_size: string | null
        }
        Insert: {
          id?: string
          nazev: string
          kategorie: string
          misto: string
          datum: string
          entry_deadline?: string | null
          withdraw_deadline?: string | null
          poznamka?: string | null
          created_by?: string | null
          created_at?: string
          tournament_key?: string | null
          sign_in_deadline_text?: string | null
          withdrawal_deadline_text?: string | null
          tournament_director_name?: string | null
          official_ball?: string | null
          draw_size?: string | null
        }
        Update: {
          id?: string
          nazev?: string
          kategorie?: string
          misto?: string
          datum?: string
          entry_deadline?: string | null
          withdraw_deadline?: string | null
          poznamka?: string | null
          created_by?: string | null
          created_at?: string
          tournament_key?: string | null
          sign_in_deadline_text?: string | null
          withdrawal_deadline_text?: string | null
          tournament_director_name?: string | null
          official_ball?: string | null
          draw_size?: string | null
        }
      }
      tournament_cache: {
        Row: {
          tournament_key: string
          name: string
          city: string
          start_date: string
          category: string | null
          created_at: string
          country: string | null
          venue: string | null
          end_date: string | null
          draw_size: string | null
          entry_deadline: string | null
          withdrawal_deadline: string | null
          tournament_director_name: string | null
          official_ball: string | null
        }
        Insert: {
          tournament_key: string
          name: string
          city: string
          start_date: string
          category?: string | null
          created_at?: string
          country?: string | null
          venue?: string | null
          end_date?: string | null
          draw_size?: string | null
          entry_deadline?: string | null
          withdrawal_deadline?: string | null
          tournament_director_name?: string | null
          official_ball?: string | null
        }
        Update: {
          tournament_key?: string
          name?: string
          city?: string
          start_date?: string
          category?: string | null
          created_at?: string
          country?: string | null
          venue?: string | null
          end_date?: string | null
          draw_size?: string | null
          entry_deadline?: string | null
          withdrawal_deadline?: string | null
          tournament_director_name?: string | null
          official_ball?: string | null
        }
      }
      entry: {
        Row: {
          id: string
          player_id: string
          tournament_id: string
          priority: number
          status: 'planovano' | 'prihlasen' | 'odhlasen' | 'odehrano'
          poznamka_rodic: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          player_id: string
          tournament_id: string
          priority: number
          status?: 'planovano' | 'prihlasen' | 'odhlasen' | 'odehrano'
          poznamka_rodic?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          tournament_id?: string
          priority?: number
          status?: 'planovano' | 'prihlasen' | 'odhlasen' | 'odehrano'
          poznamka_rodic?: string | null
          created_at?: string
        }
      }
      trip: {
        Row: {
          id: string
          coach_id: string
          title: string
          destination: string
          start_at: string
          end_at: string | null
          tournament_id: string | null
          transport: string | null
          meeting_point: string | null
          accommodation: string | null
          cost_note: string | null
          notes: string | null
          status: 'planovano' | 'probiha' | 'ukonceno' | 'zruseno'
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          title: string
          destination: string
          start_at: string
          end_at?: string | null
          tournament_id?: string | null
          transport?: string | null
          meeting_point?: string | null
          accommodation?: string | null
          cost_note?: string | null
          notes?: string | null
          status?: 'planovano' | 'probiha' | 'ukonceno' | 'zruseno'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          title?: string
          destination?: string
          start_at?: string
          end_at?: string | null
          tournament_id?: string | null
          transport?: string | null
          meeting_point?: string | null
          accommodation?: string | null
          cost_note?: string | null
          notes?: string | null
          status?: 'planovano' | 'probiha' | 'ukonceno' | 'zruseno'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      trip_player: {
        Row: {
          trip_id: string
          player_id: string
          added_at: string
        }
        Insert: {
          trip_id: string
          player_id: string
          added_at?: string
        }
        Update: {
          trip_id?: string
          player_id?: string
          added_at?: string
        }
      }
    }
  }
}

