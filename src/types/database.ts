// Hand-written to match supabase/migrations/20260921120000_scorely_init.sql.
// Regenerate with `npx supabase gen types typescript` if you prefer; only the
// scorely_* objects are referenced by this app.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type MatchEventRow = {
  id: number;
  match_id: string;
  seq: number;
  type: string;
  payload: Json;
  created_by: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      scorely_profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
        };
        Relationships: [];
      };
      scorely_teams: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          short_name: string;
          color: string;
          sport: string | null;
          players: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          short_name?: string;
          color?: string;
          sport?: string | null;
          players?: Json;
        };
        Update: {
          name?: string;
          short_name?: string;
          color?: string;
          sport?: string | null;
          players?: Json;
        };
        Relationships: [];
      };
      scorely_matches: {
        Row: {
          id: string;
          owner_id: string;
          code: string;
          sport: string;
          title: string;
          venue: string;
          status: string;
          is_public: boolean;
          participants: Json;
          config: Json;
          summary: Json | null;
          last_seq: number;
          last_event: Json | null;
          scheduled_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          sport: string;
          title?: string;
          venue?: string;
          status?: string;
          is_public?: boolean;
          participants?: Json;
          config?: Json;
          summary?: Json | null;
          scheduled_at?: string | null;
        };
        Update: {
          title?: string;
          venue?: string;
          status?: string;
          is_public?: boolean;
          participants?: Json;
          config?: Json;
          summary?: Json | null;
          scheduled_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      scorely_match_events: {
        Row: MatchEventRow;
        // Writes are revoked for API roles — events go through the scorely_* functions.
        Insert: Partial<MatchEventRow>;
        Update: Partial<MatchEventRow>;
        Relationships: [
          {
            foreignKeyName: "scorely_match_events_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "scorely_matches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      scorely_append_event: {
        Args: {
          p_match_id: string;
          p_seq: number;
          p_type: string;
          p_payload?: Json;
          p_summary?: Json;
          p_status?: string;
        };
        Returns: MatchEventRow;
      };
      scorely_undo_event: {
        Args: {
          p_match_id: string;
          p_seq: number;
          p_summary?: Json;
          p_status?: string;
        };
        Returns: number;
      };
      scorely_import_match: {
        Args: { p_match: Json; p_events?: Json };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
