
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "club_seasons": {
                  Row: {
                    "avg_attendance": number,"capacity": number,"club_id": string,"league_id": string,"league_position": number,"season": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_attendance": number,"capacity": number,"club_id": string,"league_id": string,"league_position": number,"season": number
                  }
                  Update: {
                    "avg_attendance"?: number,"capacity"?: number,"club_id"?: string,"league_id"?: string,"league_position"?: number,"season"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_seasons_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_seasons_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_seasons_league_id_fkey"
      columns: ["league_id"]
isOneToOne: false
      referencedRelation: "club_directory"
      referencedColumns: ["league_id"]
    },{
      foreignKeyName: "club_seasons_league_id_fkey"
      columns: ["league_id"]
isOneToOne: false
      referencedRelation: "leagues"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "capacity": number,"city": string,"founded": number | null,"id": string,"league_id": string,"name": string,"region": Database["public"]['Enums']["club_region"],"short_name": string,"stadium": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity": number,"city": string,"founded"?: number | null,"id"?: string,"league_id": string,"name": string,"region": Database["public"]['Enums']["club_region"],"short_name": string,"stadium": string
                  }
                  Update: {
                    "capacity"?: number,"city"?: string,"founded"?: number | null,"id"?: string,"league_id"?: string,"name"?: string,"region"?: Database["public"]['Enums']["club_region"],"short_name"?: string,"stadium"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clubs_league_id_fkey"
      columns: ["league_id"]
isOneToOne: false
      referencedRelation: "club_directory"
      referencedColumns: ["league_id"]
    },{
      foreignKeyName: "clubs_league_id_fkey"
      columns: ["league_id"]
isOneToOne: false
      referencedRelation: "leagues"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "club_id": string | null,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"name": string,"notes": string | null,"phone": string | null,"role_title": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"role_title"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Update: {
                    "club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"role_title"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"leagues": {
                  Row: {
                    "id": string,"name": string,"tier": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"name": string,"tier": number
                  }
                  Update: {
                    "id"?: string,"name"?: string,"tier"?: number
                  }
                  Relationships: [
                    
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunities": {
                  Row: {
                    "category": Database["public"]['Enums']["opportunity_category"],"club_id": string,"contact_id": string | null,"created_at": string,"created_by": string | null,"expected_close_date": string | null,"id": string,"notes": string | null,"owner_id": string | null,"partner_name": string,"search_text": string | null,"stage": Database["public"]['Enums']["opportunity_stage"],"stage_changed_at": string,"title": string,"updated_at": string,"value_gbp": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["opportunity_category"],"club_id": string,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"expected_close_date"?: string | null,"id"?: string,"notes"?: string | null,"owner_id"?: string | null,"partner_name": string,"search_text"?: never,"stage"?: Database["public"]['Enums']["opportunity_stage"],"stage_changed_at"?: string,"title": string,"updated_at"?: string,"value_gbp"?: number,"workspace_id"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["opportunity_category"],"club_id"?: string,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"expected_close_date"?: string | null,"id"?: string,"notes"?: string | null,"owner_id"?: string | null,"partner_name"?: string,"search_text"?: never,"stage"?: Database["public"]['Enums']["opportunity_stage"],"stage_changed_at"?: string,"title"?: string,"updated_at"?: string,"value_gbp"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_workspace_id_contact_id_fkey"
      columns: ["workspace_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "opportunities_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_workspace_id_owner_id_fkey"
      columns: ["workspace_id","owner_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["workspace_id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"current_workspace_id": string | null,"full_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_workspace_id"?: string | null,"full_name"?: string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"current_workspace_id"?: string | null,"full_name"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_current_workspace_id_fkey"
      columns: ["current_workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "club_directory": {
                  Row: {
                    "avg_attendance": number | null,"capacity": number,"city": string,"founded": number | null,"id": string,"latest_season": number | null,"league_id": string,"league_name": string,"league_position": number | null,"name": string,"region": Database["public"]['Enums']["club_region"],"short_name": string,"stadium": string,"tier": number
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_member_by_email":
{ Args: { "p_email": string,"p_role": Database["public"]['Enums']["workspace_role"],"ws": string }; Returns: string
                           },
"assert_can_assign":
{ Args: { "p_role": Database["public"]['Enums']["workspace_role"],"ws": string }; Returns: undefined
                           },
"assert_can_manage_member":
{ Args: { "p_user": string,"ws": string }; Returns: undefined
                           },
"can":
{ Args: { "perm": string,"ws": string }; Returns: boolean
                           },
"create_workspace":
{ Args: { "p_name": string }; Returns: string
                           },
"current_workspace":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name": string,"role": Database["public"]['Enums']["workspace_role"]
            }[]
                           },
"current_workspace_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"my_permissions":
{ Args: { "ws": string }; Returns: (string)[]
                           },
"my_role":
{ Args: { "ws": string }; Returns: Database["public"]['Enums']["workspace_role"]
                           },
"remove_member":
{ Args: { "p_user": string,"ws": string }; Returns: undefined
                           },
"role_permissions":
{ Args: { "r": Database["public"]['Enums']["workspace_role"] }; Returns: (string)[]
                           },
"role_rank":
{ Args: { "r": Database["public"]['Enums']["workspace_role"] }; Returns: number
                           },
"set_member_role":
{ Args: { "p_role": Database["public"]['Enums']["workspace_role"],"p_user": string,"ws": string }; Returns: undefined
                           },
"switch_workspace":
{ Args: { "ws": string }; Returns: undefined
                           },
"workspace_members":
{ Args: { "ws": string }; Returns: {
              "email": string,"full_name": string,"joined_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string
            }[]
                           }
          }
          Enums: {
            "club_region": "england-north"|"england-midlands"|"england-south"|"scotland"|"wales"|"northern-ireland"|"ireland","opportunity_category": "sponsorship"|"hospitality"|"media"|"partnership"|"other","opportunity_stage": "lead"|"qualified"|"proposal"|"negotiation"|"won"|"lost","workspace_role": "owner"|"admin"|"analyst"|"viewer"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "club_region": ["england-north", "england-midlands", "england-south", "scotland", "wales", "northern-ireland", "ireland"],"opportunity_category": ["sponsorship", "hospitality", "media", "partnership", "other"],"opportunity_stage": ["lead", "qualified", "proposal", "negotiation", "won", "lost"],"workspace_role": ["owner", "admin", "analyst", "viewer"]
          }
        }
} as const
