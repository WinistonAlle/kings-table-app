// Tipos gerados manualmente — substitua pelo output de `supabase gen types typescript` após criar o projeto

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface DatabaseSchema {
  public: {
    Tables: {
      account_backups: {
        Row: { owner_id: string; revision: number; snapshot: Json; updated_at: string };
        Insert: { owner_id: string; revision?: number; snapshot: Json; updated_at?: string };
        Update: { revision?: number; snapshot?: Json; updated_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          avatar_url: string | null;
          xp: number;
          streak: number;
          level: number;
          last_active: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      leagues: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          slug: string | null;
          scoring_formula: 'linear' | 'exponential' | 'custom';
          points_win: number;
          points_itm: number;
          bonus_bounty: number;
          is_public: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['leagues']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['leagues']['Insert']>;
      };
      tournaments: {
        Row: {
          id: string;
          league_id: string | null;
          name: string;
          format: 'deep' | 'regular' | 'turbo' | 'hyper' | 'rebuy' | 'bounty';
          status: 'upcoming' | 'running' | 'paused' | 'finished' | 'cancelled';
          buy_in: number;
          re_entry_allowed: boolean;
          max_re_entries: number;
          start_time: string | null;
          end_time: string | null;
          blind_structure_id: string | null;
          current_level: number;
          seconds_remaining: number | null;
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tournaments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tournaments']['Insert']>;
      };
      tournament_players: {
        Row: {
          id: string;
          tournament_id: string;
          user_id: string | null;
          display_name: string;
          buy_ins: number;
          re_entries: number;
          add_ons: number;
          position: number | null;
          prize: number | null;
          payment_status: 'pending' | 'confirmed' | 'disputed';
          eliminated_at: string | null;
          registered_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tournament_players']['Row'], 'id' | 'registered_at'>;
        Update: Partial<Database['public']['Tables']['tournament_players']['Insert']>;
      };
      league_standings: {
        Row: {
          id: string;
          league_id: string;
          user_id: string;
          points: number;
          tournaments_played: number;
          wins: number;
          itm_count: number;
          rank: number | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['league_standings']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['league_standings']['Insert']>;
      };
      payment_proofs: {
        Row: {
          id: string;
          tournament_id: string;
          player_id: string;
          storage_path: string;
          amount: number | null;
          ai_result: Json | null;
          ai_confidence: number | null;
          reviewed_by: string | null;
          status: 'pending' | 'confirmed' | 'disputed' | 'rejected';
          submitted_at: string;
          reviewed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payment_proofs']['Row'], 'id' | 'submitted_at'>;
        Update: Partial<Database['public']['Tables']['payment_proofs']['Insert']>;
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          context: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_messages']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
      study_progress: {
        Row: {
          user_id: string;
          module_id: number;
          completed: boolean;
          score: number | null;
          xp_earned: number;
          completed_at: string | null;
        };
        Insert: Database['public']['Tables']['study_progress']['Row'];
        Update: Partial<Database['public']['Tables']['study_progress']['Row']>;
      };
    };
    Views: {};
    Functions: {
      save_account_backup: {
        Args: { p_snapshot: Json; p_expected_revision: number };
        Returns: Json;
      };
    };
    Enums: {};
  };
}

// Supabase exige metadados de relacionamentos em todas as tabelas do schema.
export type Database = {
  public: Omit<DatabaseSchema['public'], 'Tables'> & {
    Tables: { [K in keyof DatabaseSchema['public']['Tables']]: DatabaseSchema['public']['Tables'][K] & { Relationships: [] } };
  };
};
