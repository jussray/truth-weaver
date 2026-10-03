export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      custody_events: {
        Row: {
          authority_decision_id: string | null
          command_id: string | null
          correlation_id: string
          created_at: string
          event_hash: string
          event_type: string
          evidence_id: string
          external_object_id: string | null
          id: string
          payload: Json
          previous_event_hash: string | null
          provider: string | null
          sequence_no: number
        }
        Insert: {
          authority_decision_id?: string | null
          command_id?: string | null
          correlation_id: string
          created_at?: string
          event_hash: string
          event_type: string
          evidence_id: string
          external_object_id?: string | null
          id?: string
          payload: Json
          previous_event_hash?: string | null
          provider?: string | null
          sequence_no?: never
        }
        Update: {
          authority_decision_id?: string | null
          command_id?: string | null
          correlation_id?: string
          created_at?: string
          event_hash?: string
          event_type?: string
          evidence_id?: string
          external_object_id?: string | null
          id?: string
          payload?: Json
          previous_event_hash?: string | null
          provider?: string | null
          sequence_no?: never
        }
        Relationships: []
      }
      findings: {
        Row: {
          citation: string | null
          contrary_source_ids: string[]
          created_at: string
          currentness_checked_at: string | null
          id: string
          issue_id: string
          jurisdiction_id: string | null
          pinpoint: string | null
          proposition: string
          reasoning_summary: string | null
          source_ids: string[]
          truth_state: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          citation?: string | null
          contrary_source_ids?: string[]
          created_at?: string
          currentness_checked_at?: string | null
          id?: string
          issue_id: string
          jurisdiction_id?: string | null
          pinpoint?: string | null
          proposition: string
          reasoning_summary?: string | null
          source_ids?: string[]
          truth_state?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          citation?: string | null
          contrary_source_ids?: string[]
          created_at?: string
          currentness_checked_at?: string | null
          id?: string
          issue_id?: string
          jurisdiction_id?: string | null
          pinpoint?: string | null
          proposition?: string
          reasoning_summary?: string | null
          source_ids?: string[]
          truth_state?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_books: {
        Row: {
          book_id: string
          created_at: string
          id: string
          issue_id: string
          relevance_note: string | null
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          issue_id: string
          relevance_note?: string | null
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          issue_id?: string
          relevance_note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "legal_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_books_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_elements: {
        Row: {
          burden_side: string | null
          created_at: string
          element: string
          evidence_needed: string | null
          id: string
          issue_id: string
          legal_source_ids: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          burden_side?: string | null
          created_at?: string
          element: string
          evidence_needed?: string | null
          id?: string
          issue_id: string
          legal_source_ids?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          burden_side?: string | null
          created_at?: string
          element?: string
          evidence_needed?: string | null
          id?: string
          issue_id?: string
          legal_source_ids?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_elements_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_sources: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          relevance_note: string | null
          source_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          relevance_note?: string | null
          source_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          relevance_note?: string | null
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_sources_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "legal_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          as_of_date: string | null
          created_at: string
          description: string | null
          event_date: string | null
          facts: string | null
          id: string
          issue_area: string | null
          jurisdiction_id: string | null
          jurisdiction_note: string | null
          parties: string | null
          sides: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          as_of_date?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          facts?: string | null
          id?: string
          issue_area?: string | null
          jurisdiction_id?: string | null
          jurisdiction_note?: string | null
          parties?: string | null
          sides?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          as_of_date?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          facts?: string | null
          id?: string
          issue_area?: string | null
          jurisdiction_id?: string | null
          jurisdiction_note?: string | null
          parties?: string | null
          sides?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisdictions: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          layer: string
          legal_system: string | null
          metadata: Json
          name: string
          notes: string | null
          official_languages: string[]
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          layer: string
          legal_system?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          official_languages?: string[]
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          layer?: string
          legal_system?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          official_languages?: string[]
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jurisdictions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_books: {
        Row: {
          author: string | null
          book_type: string
          catalog_url: string | null
          created_at: string
          edition: string | null
          id: string
          isbn: string | null
          jurisdiction_id: string | null
          licensing_note: string | null
          metadata: Json
          publisher: string | null
          secondary_role_note: string
          title: string
          topic: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          author?: string | null
          book_type?: string
          catalog_url?: string | null
          created_at?: string
          edition?: string | null
          id?: string
          isbn?: string | null
          jurisdiction_id?: string | null
          licensing_note?: string | null
          metadata?: Json
          publisher?: string | null
          secondary_role_note?: string
          title: string
          topic?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          author?: string | null
          book_type?: string
          catalog_url?: string | null
          created_at?: string
          edition?: string | null
          id?: string
          isbn?: string | null
          jurisdiction_id?: string | null
          licensing_note?: string | null
          metadata?: Json
          publisher?: string | null
          secondary_role_note?: string
          title?: string
          topic?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_books_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_sources: {
        Row: {
          authority_weight: string | null
          base_url: string | null
          coverage_description: string | null
          created_at: string
          currentness_strategy: string | null
          id: string
          integration_status: string
          is_authentic: boolean | null
          is_official: boolean
          issuing_body: string | null
          jurisdiction_id: string | null
          metadata: Json
          name: string
          source_role: string
          source_type: string
          updated_at: string
        }
        Insert: {
          authority_weight?: string | null
          base_url?: string | null
          coverage_description?: string | null
          created_at?: string
          currentness_strategy?: string | null
          id?: string
          integration_status?: string
          is_authentic?: boolean | null
          is_official?: boolean
          issuing_body?: string | null
          jurisdiction_id?: string | null
          metadata?: Json
          name: string
          source_role?: string
          source_type: string
          updated_at?: string
        }
        Update: {
          authority_weight?: string | null
          base_url?: string | null
          coverage_description?: string | null
          created_at?: string
          currentness_strategy?: string | null
          id?: string
          integration_status?: string
          is_authentic?: boolean | null
          is_official?: boolean
          issuing_body?: string | null
          jurisdiction_id?: string | null
          metadata?: Json
          name?: string
          source_role?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_sources_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      red_team_checks: {
        Row: {
          category: string
          created_at: string
          finding_id: string | null
          id: string
          issue_id: string
          prompt: string
          response: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          finding_id?: string | null
          id?: string
          issue_id: string
          prompt: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          finding_id?: string | null
          id?: string
          issue_id?: string
          prompt?: string
          response?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_team_checks_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_team_checks_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      remedies_defenses: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          issue_id: string
          kind: string
          legal_source_ids: string[]
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issue_id: string
          kind: string
          legal_source_ids?: string[]
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issue_id?: string
          kind?: string
          legal_source_ids?: string[]
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remedies_defenses_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      research_log: {
        Row: {
          created_at: string
          entry: string
          entry_type: string
          id: string
          issue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry: string
          entry_type?: string
          id?: string
          issue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry?: string
          entry_type?: string
          id?: string
          issue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_log_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
