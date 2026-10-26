
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
            "ai_limits": {
                  Row: {
                    "id": boolean,"max_report_cost_usd": number,"max_workspace_budget_usd": number,"platform_daily_usd": number,"report_reserve_usd": number,"reports_per_user_day": number,"reports_per_workspace_hour": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: boolean,"max_report_cost_usd"?: number,"max_workspace_budget_usd"?: number,"platform_daily_usd"?: number,"report_reserve_usd"?: number,"reports_per_user_day"?: number,"reports_per_workspace_hour"?: number
                  }
                  Update: {
                    "id"?: boolean,"max_report_cost_usd"?: number,"max_workspace_budget_usd"?: number,"platform_daily_usd"?: number,"report_reserve_usd"?: number,"reports_per_user_day"?: number,"reports_per_workspace_hour"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "cache_read_tokens": number,"cache_write_tokens": number,"cost_usd": number,"created_at": string,"feature": string,"id": number,"input_tokens": number,"model": string,"output_tokens": number,"report_id": string | null,"settled_at": string | null,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_read_tokens"?: number,"cache_write_tokens"?: number,"cost_usd": number,"created_at"?: string,"feature": string,"id"?: never,"input_tokens"?: number,"model": string,"output_tokens"?: number,"report_id"?: string | null,"settled_at"?: string | null,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "cache_read_tokens"?: number,"cache_write_tokens"?: number,"cost_usd"?: number,"created_at"?: string,"feature"?: string,"id"?: never,"input_tokens"?: number,"model"?: string,"output_tokens"?: number,"report_id"?: string | null,"settled_at"?: string | null,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_usage_workspace_id_report_id_fkey"
      columns: ["workspace_id","report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"alert_reads": {
                  Row: {
                    "alert_id": string,"read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id": string,"read_at"?: string,"user_id": string
                  }
                  Update: {
                    "alert_id"?: string,"read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_reads_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_rules": {
                  Row: {
                    "club_id": string | null,"created_at": string,"created_by": string | null,"days": number | null,"drop_pct": number | null,"enabled": boolean,"id": string,"last_run_at": string | null,"type": Database["public"]['Enums']["alert_rule_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"days"?: number | null,"drop_pct"?: number | null,"enabled"?: boolean,"id"?: string,"last_run_at"?: string | null,"type": Database["public"]['Enums']["alert_rule_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Update: {
                    "club_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"days"?: number | null,"drop_pct"?: number | null,"enabled"?: boolean,"id"?: string,"last_run_at"?: string | null,"type"?: Database["public"]['Enums']["alert_rule_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_rules_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_rules_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_rules_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_runs": {
                  Row: {
                    "last_run_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_run_at": string,"workspace_id": string
                  }
                  Update: {
                    "last_run_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_runs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts": {
                  Row: {
                    "body": string,"club_id": string | null,"created_at": string,"dedup_key": string,"id": string,"opportunity_id": string | null,"rule_id": string | null,"title": string,"type": Database["public"]['Enums']["alert_rule_type"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"club_id"?: string | null,"created_at"?: string,"dedup_key": string,"id"?: string,"opportunity_id"?: string | null,"rule_id"?: string | null,"title": string,"type": Database["public"]['Enums']["alert_rule_type"],"workspace_id": string
                  }
                  Update: {
                    "body"?: string,"club_id"?: string | null,"created_at"?: string,"dedup_key"?: string,"id"?: string,"opportunity_id"?: string | null,"rule_id"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["alert_rule_type"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_workspace_id_opportunity_id_fkey"
      columns: ["workspace_id","opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "alerts_workspace_id_rule_id_fkey"
      columns: ["workspace_id","rule_id"]
isOneToOne: false
      referencedRelation: "alert_rules"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"club_seasons": {
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
                },"reports": {
                  Row: {
                    "content": Json | null,"created_at": string,"created_by": string | null,"error": string | null,"focus": string | null,"id": string,"model": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["report_status"],"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: Json | null,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"focus"?: string | null,"id"?: string,"model"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "content"?: Json | null,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"focus"?: string | null,"id"?: string,"model"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "ai_monthly_budget_usd": number,"created_at": string,"created_by": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_monthly_budget_usd"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "ai_monthly_budget_usd"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string
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
"ai_budget_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "budget_usd": number,"platform_cap_usd": number,"spent_usd": number,"workspace_budget_usd": number
            }[]
                           },
"ai_effective_budget":
{ Args: { "ws": string }; Returns: number
                           },
"ai_spend_this_month":
{ Args: { "ws": string }; Returns: number
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
"dashboard_kpis":
{ Args: { "ws"?: string }; Returns: {
              "avg_won_value": number,"lost_12m_count": number,"open_count": number,"open_value": number,"stale_count": number,"won_12m_count": number,"won_quarter_count": number,"won_quarter_value": number
            }[]
                           },
"dashboard_pipeline_by_stage":
{ Args: { "ws"?: string }; Returns: {
              "deals": number,"stage": Database["public"]['Enums']["opportunity_stage"],"value": number
            }[]
                           },
"dashboard_upcoming":
{ Args: { "ws"?: string }; Returns: {
              "club_name": string,"expected_close_date": string,"id": string,"overdue": boolean,"stage": Database["public"]['Enums']["opportunity_stage"],"title": string,"value_gbp": number
            }[]
                           },
"dashboard_value_by_tier":
{ Args: { "ws"?: string }; Returns: {
              "deals": number,"tier": number,"value": number
            }[]
                           },
"dashboard_won_by_month":
{ Args: { "ws"?: string }; Returns: {
              "deals": number,"month": string,"value": number
            }[]
                           },
"evaluate_all_alerts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"evaluate_rules":
{ Args: { "ws": string }; Returns: number
                           },
"fail_report":
{ Args: { "p_error": string,"p_id": string,"p_model"?: string,"p_workspace": string }; Returns: undefined
                           },
"finish_report":
{ Args: { "p_content": Json,"p_id": string,"p_model": string,"p_workspace": string }; Returns: undefined
                           },
"is_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"mark_alert_read":
{ Args: { "p_alert": string }; Returns: undefined
                           },
"mark_all_alerts_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_permissions":
{ Args: { "ws": string }; Returns: (string)[]
                           },
"my_role":
{ Args: { "ws": string }; Returns: Database["public"]['Enums']["workspace_role"]
                           },
"national_attendance_by_tier":
{ Args: Record<PropertyKey, never>; Returns: {
              "avg_attendance": number,"avg_capacity": number,"clubs": number,"season": number,"tier": number
            }[]
                           },
"plural_days":
{ Args: { "n": number }; Returns: string
                           },
"remove_member":
{ Args: { "p_user": string,"ws": string }; Returns: undefined
                           },
"review_report":
{ Args: { "p_decision": Database["public"]['Enums']["report_status"],"p_id": string }; Returns: undefined
                           },
"role_permissions":
{ Args: { "r": Database["public"]['Enums']["workspace_role"] }; Returns: (string)[]
                           },
"role_rank":
{ Args: { "r": Database["public"]['Enums']["workspace_role"] }; Returns: number
                           },
"run_alert_checks":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"set_member_role":
{ Args: { "p_role": Database["public"]['Enums']["workspace_role"],"p_user": string,"ws": string }; Returns: undefined
                           },
"settle_ai_usage":
{ Args: { "p_cache_read": number,"p_cache_write": number,"p_cost": number,"p_input": number,"p_model": string,"p_output": number,"p_report": string,"p_workspace": string }; Returns: undefined
                           },
"start_report":
{ Args: { "p_focus"?: string,"p_user": string,"p_workspace": string }; Returns: string
                           },
"switch_workspace":
{ Args: { "ws": string }; Returns: undefined
                           },
"unread_alert_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"user_can":
{ Args: { "p_user": string,"perm": string,"ws": string }; Returns: boolean
                           },
"workspace_members":
{ Args: { "ws": string }; Returns: {
              "email": string,"full_name": string,"joined_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string
            }[]
                           }
          }
          Enums: {
            "alert_rule_type": "stale_opportunity"|"close_date_passed"|"attendance_drop","club_region": "england-north"|"england-midlands"|"england-south"|"scotland"|"wales"|"northern-ireland"|"ireland","opportunity_category": "sponsorship"|"hospitality"|"media"|"partnership"|"other","opportunity_stage": "lead"|"qualified"|"proposal"|"negotiation"|"won"|"lost","report_status": "generating"|"draft"|"failed"|"approved"|"discarded","workspace_role": "owner"|"admin"|"analyst"|"viewer"
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
            "alert_rule_type": ["stale_opportunity", "close_date_passed", "attendance_drop"],"club_region": ["england-north", "england-midlands", "england-south", "scotland", "wales", "northern-ireland", "ireland"],"opportunity_category": ["sponsorship", "hospitality", "media", "partnership", "other"],"opportunity_stage": ["lead", "qualified", "proposal", "negotiation", "won", "lost"],"report_status": ["generating", "draft", "failed", "approved", "discarded"],"workspace_role": ["owner", "admin", "analyst", "viewer"]
          }
        }
} as const
