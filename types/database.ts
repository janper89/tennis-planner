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
          role: 'parent' | 'coach' | 'manager'
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          role?: 'parent' | 'coach' | 'manager'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'parent' | 'coach' | 'manager'
          created_at?: string
        }
      }
      player: {
        Row: {
          id: string
          name: string
          birth_date: string
          rocnik: number
          category: string | null
          coach_id: string | null
          parent_id: string | null
          limit_turnaju: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          birth_date: string
          rocnik: number
          category?: string | null
          coach_id?: string | null
          parent_id?: string | null
          limit_turnaju?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          birth_date?: string
          rocnik?: number
          category?: string | null
          coach_id?: string | null
          parent_id?: string | null
          limit_turnaju?: number
          created_at?: string
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
    }
  }
}

