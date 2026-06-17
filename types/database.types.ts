export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_suggestions: {
        Row: {
          id: string
          organization_id: string
          risk_id: string | null
          suggestion_type: string
          input_context: Json
          suggestion_content: Json
          accepted: boolean | null
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          risk_id?: string | null
          suggestion_type: string
          input_context: Json
          suggestion_content: Json
          accepted?: boolean | null
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          risk_id?: string | null
          suggestion_type?: string
          input_context?: Json
          suggestion_content?: Json
          accepted?: boolean | null
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_usage_logs: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          provider: string
          request_type: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          cached: boolean | null
          latency_ms: number | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          provider: string
          request_type: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          cached?: boolean | null
          latency_ms?: number | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string | null
          provider?: string
          request_type?: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          cached?: boolean | null
          latency_ms?: number | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_checklists: {
        Row: {
          audit_plan_id: string | null
          auditor_id: string | null
          check_item: string
          created_at: string | null
          department_id: string | null
          evidence_provided: string | null
          evidence_required: string | null
          findings: string | null
          id: string
          requirement_id: string | null
          result: string | null
          reviewed_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          audit_plan_id?: string | null
          auditor_id?: string | null
          check_item: string
          created_at?: string | null
          department_id?: string | null
          evidence_provided?: string | null
          evidence_required?: string | null
          findings?: string | null
          id?: string
          requirement_id?: string | null
          result?: string | null
          reviewed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          audit_plan_id?: string | null
          auditor_id?: string | null
          check_item?: string
          created_at?: string | null
          department_id?: string | null
          evidence_provided?: string | null
          evidence_required?: string | null
          findings?: string | null
          id?: string
          requirement_id?: string | null
          result?: string | null
          reviewed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_checklists_audit_plan_id_fkey"
            columns: ["audit_plan_id"]
            isOneToOne: false
            referencedRelation: "audit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklists_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklists_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklists_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "iso27001_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_evidence: {
        Row: {
          audit_checklist_id: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          audit_checklist_id?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          audit_checklist_id?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_evidence_audit_checklist_id_fkey"
            columns: ["audit_checklist_id"]
            isOneToOne: false
            referencedRelation: "audit_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          id: string
          ip_address: unknown
          organization_id: string
          resource_id: string | null
          resource_type: string
          scope: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          organization_id: string
          resource_id?: string | null
          resource_type: string
          scope?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
          scope?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_plans: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          audit_period: string | null
          audit_type: string | null
          created_at: string | null
          description: string | null
          id: string
          lead_auditor_id: string | null
          organization_id: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          standard: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          audit_period?: string | null
          audit_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_auditor_id?: string | null
          organization_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          standard?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          audit_period?: string | null
          audit_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lead_auditor_id?: string | null
          organization_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          standard?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_plans_lead_auditor_id_fkey"
            columns: ["lead_auditor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audit_plan_id: string | null
          conclusion: string | null
          created_at: string | null
          executive_summary: string | null
          id: string
          improvement_opportunities: string | null
          methodology: string | null
          positive_findings: string | null
          report_date: string | null
          scope: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audit_plan_id?: string | null
          conclusion?: string | null
          created_at?: string | null
          executive_summary?: string | null
          id?: string
          improvement_opportunities?: string | null
          methodology?: string | null
          positive_findings?: string | null
          report_date?: string | null
          scope?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audit_plan_id?: string | null
          conclusion?: string | null
          created_at?: string | null
          executive_summary?: string | null
          id?: string
          improvement_opportunities?: string | null
          methodology?: string | null
          positive_findings?: string | null
          report_date?: string | null
          scope?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_reports_audit_plan_id_fkey"
            columns: ["audit_plan_id"]
            isOneToOne: false
            referencedRelation: "audit_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_team_members: {
        Row: {
          assigned_at: string | null
          audit_plan_id: string | null
          id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          audit_plan_id?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          audit_plan_id?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_team_members_audit_plan_id_fkey"
            columns: ["audit_plan_id"]
            isOneToOne: false
            referencedRelation: "audit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_mfa_challenges: {
        Row: {
          channel: string
          code_hash: string
          consumed_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_mfa_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_info: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_contact_name: string | null
          billing_email: string | null
          city: string | null
          company_name: string | null
          company_name_kana: string | null
          created_at: string | null
          id: string
          organization_id: string | null
          phone: string | null
          postal_code: string | null
          prefecture: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_contact_name?: string | null
          billing_email?: string | null
          city?: string | null
          company_name?: string | null
          company_name_kana?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          prefecture?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_contact_name?: string | null
          billing_email?: string | null
          city?: string | null
          company_name?: string | null
          company_name_kana?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          prefecture?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_info_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_templates: {
        Row: {
          annex_reference: string | null
          category: string
          control_code: string | null
          created_at: string
          default_tags: string[] | null
          description: string | null
          id: string
          is_default_selected: boolean
          locale: string
          template_key: string
          title: string
          updated_at: string
        }
        Insert: {
          annex_reference?: string | null
          category: string
          control_code?: string | null
          created_at?: string
          default_tags?: string[] | null
          description?: string | null
          id?: string
          is_default_selected?: boolean
          locale?: string
          template_key: string
          title: string
          updated_at?: string
        }
        Update: {
          annex_reference?: string | null
          category?: string
          control_code?: string | null
          created_at?: string
          default_tags?: string[] | null
          description?: string | null
          id?: string
          is_default_selected?: boolean
          locale?: string
          template_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      corrective_actions: {
        Row: {
          action_description: string
          completion_date: string | null
          created_at: string | null
          effectiveness_review: string | null
          id: string
          nonconformity_id: string | null
          planned_date: string | null
          responsible_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action_description: string
          completion_date?: string | null
          created_at?: string | null
          effectiveness_review?: string | null
          id?: string
          nonconformity_id?: string | null
          planned_date?: string | null
          responsible_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action_description?: string
          completion_date?: string | null
          created_at?: string | null
          effectiveness_review?: string | null
          id?: string
          nonconformity_id?: string | null
          planned_date?: string | null
          responsible_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_nonconformity_id_fkey"
            columns: ["nonconformity_id"]
            isOneToOne: false
            referencedRelation: "nonconformities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_approvals: {
        Row: {
          acted_at: string | null
          approver_id: string
          comment: string | null
          created_at: string | null
          created_by: string
          document_id: string
          id: string
          status: string
          step: number
        }
        Insert: {
          acted_at?: string | null
          approver_id: string
          comment?: string | null
          created_at?: string | null
          created_by: string
          document_id: string
          id?: string
          status?: string
          step: number
        }
        Update: {
          acted_at?: string | null
          approver_id?: string
          comment?: string | null
          created_at?: string | null
          created_by?: string
          document_id?: string
          id?: string
          status?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_approvals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_approvals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          path: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          path: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          content_template: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          iso_reference: string | null
          language: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content_template: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          iso_reference?: string | null
          language?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content_template?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          iso_reference?: string | null
          language?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      document_versions: {
        Row: {
          changes: string | null
          created_at: string | null
          created_by: string
          description: string | null
          document_id: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          title: string
          version_number: number
        }
        Insert: {
          changes?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          document_id: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          title: string
          version_number: number
        }
        Update: {
          changes?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          document_id?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string | null
          created_by: string
          department_id: string | null
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          folder_id: string | null
          id: string
          mime_type: string | null
          organization_id: string
          retention_delete_at: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
          version_number: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string | null
          created_by: string
          department_id?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          organization_id: string
          retention_delete_at?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          version_number?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string
          department_id?: string | null
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          retention_delete_at?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          notification_id: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          sent_at?: string | null
          status: string
          subject: string
          to_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      export_events: {
        Row: {
          context: Json | null
          created_at: string
          document_id: string | null
          format: string
          id: string
          organization_id: string
          status: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          document_id?: string | null
          format: string
          id?: string
          organization_id: string
          status: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          document_id?: string | null
          format?: string
          id?: string
          organization_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      information_asset_import_jobs: {
        Row: {
          backup_snapshot: Json | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number
          error_summary: string | null
          id: string
          mode: string
          organization_id: string
          original_filename: string | null
          started_at: string | null
          status: string
          success_count: number
          total_rows: number
          updated_at: string
        }
        Insert: {
          backup_snapshot?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          error_summary?: string | null
          id?: string
          mode?: string
          organization_id: string
          original_filename?: string | null
          started_at?: string | null
          status?: string
          success_count?: number
          total_rows?: number
          updated_at?: string
        }
        Update: {
          backup_snapshot?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          error_summary?: string | null
          id?: string
          mode?: string
          organization_id?: string
          original_filename?: string | null
          started_at?: string | null
          status?: string
          success_count?: number
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "information_asset_import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "information_asset_import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      information_asset_import_rows: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          job_id: string
          line_number: number
          message: string | null
          raw_data: Json
          status: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          line_number: number
          message?: string | null
          raw_data: Json
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          line_number?: number
          message?: string | null
          raw_data?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "information_asset_import_rows_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "information_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "information_asset_import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "information_asset_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      information_assets: {
        Row: {
          asset_type: string | null
          classification: string | null
          created_at: string | null
          criticality: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          organization_id: string
          owner_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asset_type?: string | null
          classification?: string | null
          created_at?: string | null
          criticality?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          organization_id: string
          owner_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_type?: string | null
          classification?: string | null
          created_at?: string | null
          criticality?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          organization_id?: string
          owner_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "information_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "information_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_controls: {
        Row: {
          category: string
          control_code: string | null
          created_at: string | null
          description: string | null
          id: string
          organization_id: string
          soa_approval_status: string
          soa_approved_at: string | null
          soa_approved_by: string | null
          soa_applicability_reason: string | null
          soa_exclusion_reason: string | null
          soa_rejection_reason: string | null
          soa_reviewed_at: string | null
          soa_reviewed_by: string | null
          soa_status: string
          tags: string[] | null
          template_key: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          control_code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id: string
          soa_approval_status?: string
          soa_approved_at?: string | null
          soa_approved_by?: string | null
          soa_applicability_reason?: string | null
          soa_exclusion_reason?: string | null
          soa_rejection_reason?: string | null
          soa_reviewed_at?: string | null
          soa_reviewed_by?: string | null
          soa_status?: string
          tags?: string[] | null
          template_key?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          control_code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          soa_approval_status?: string
          soa_approved_at?: string | null
          soa_approved_by?: string | null
          soa_applicability_reason?: string | null
          soa_exclusion_reason?: string | null
          soa_rejection_reason?: string | null
          soa_reviewed_at?: string | null
          soa_reviewed_by?: string | null
          soa_status?: string
          tags?: string[] | null
          template_key?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iso_controls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      soa_versions: {
        Row: {
          approved_control_count: number
          change_summary: string | null
          control_count: number
          created_at: string
          id: string
          organization_id: string
          published_at: string
          published_by: string | null
          rejection_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          snapshot: Json
          title: string
          version_number: number
        }
        Insert: {
          approved_control_count?: number
          change_summary?: string | null
          control_count?: number
          created_at?: string
          id?: string
          organization_id: string
          published_at?: string
          published_by?: string | null
          rejection_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot: Json
          title: string
          version_number: number
        }
        Update: {
          approved_control_count?: number
          change_summary?: string | null
          control_count?: number
          created_at?: string
          id?: string
          organization_id?: string
          published_at?: string
          published_by?: string | null
          rejection_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot?: Json
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "soa_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soa_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iso27001_requirements: {
        Row: {
          clause_number: string
          created_at: string | null
          description: string | null
          id: string
          is_applicable: boolean | null
          parent_id: string | null
          title: string
        }
        Insert: {
          clause_number: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_applicable?: boolean | null
          parent_id?: string | null
          title: string
        }
        Update: {
          clause_number?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_applicable?: boolean | null
          parent_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "iso27001_requirements_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "iso27001_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      nonconformities: {
        Row: {
          audit_checklist_id: string | null
          corrective_action: string | null
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          nc_number: string
          preventive_action: string | null
          resolution_date: string | null
          responsible_id: string | null
          root_cause: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          verification_date: string | null
          verified_by: string | null
        }
        Insert: {
          audit_checklist_id?: string | null
          corrective_action?: string | null
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          nc_number: string
          preventive_action?: string | null
          resolution_date?: string | null
          responsible_id?: string | null
          root_cause?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          verification_date?: string | null
          verified_by?: string | null
        }
        Update: {
          audit_checklist_id?: string | null
          corrective_action?: string | null
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          nc_number?: string
          preventive_action?: string | null
          resolution_date?: string | null
          responsible_id?: string | null
          root_cause?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          verification_date?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nonconformities_audit_checklist_id_fkey"
            columns: ["audit_checklist_id"]
            isOneToOne: false
            referencedRelation: "audit_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nonconformities_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nonconformities_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          app_enabled: boolean
          audit_schedules: boolean
          created_at: string
          document_approvals: boolean
          email_enabled: boolean
          id: string
          reminder_days_before: number
          risk_alerts: boolean
          task_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          app_enabled?: boolean
          audit_schedules?: boolean
          created_at?: string
          document_approvals?: boolean
          email_enabled?: boolean
          id?: string
          reminder_days_before?: number
          risk_alerts?: boolean
          task_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          app_enabled?: boolean
          audit_schedules?: boolean
          created_at?: string
          document_approvals?: boolean
          email_enabled?: boolean
          id?: string
          reminder_days_before?: number
          risk_alerts?: boolean
          task_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          link: string | null
          message: string
          metadata: Json | null
          organization_id: string
          priority: string
          read_at: string | null
          status: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          organization_id: string
          priority?: string
          read_at?: string | null
          status?: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          organization_id?: string
          priority?: string
          read_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_departments: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          manager: string | null
          member_count: number | null
          name: string
          name_en: string | null
          organization_id: string
          parent_department_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          manager?: string | null
          member_count?: number | null
          name: string
          name_en?: string | null
          organization_id: string
          parent_department_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          manager?: string | null
          member_count?: number | null
          name?: string
          name_en?: string | null
          organization_id?: string
          parent_department_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_departments_parent_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "organization_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_isms_scopes: {
        Row: {
          created_at: string | null
          departments: string[]
          exclusions: string[]
          id: string
          it_systems: string[]
          organization_id: string
          physical_locations: string[]
          processes: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          departments?: string[]
          exclusions?: string[]
          id?: string
          it_systems?: string[]
          organization_id: string
          physical_locations?: string[]
          processes?: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          departments?: string[]
          exclusions?: string[]
          id?: string
          it_systems?: string[]
          organization_id?: string
          physical_locations?: string[]
          processes?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_isms_scopes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_notification_channel_logs: {
        Row: {
          attempt: number
          channel_id: string
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          notification_id: string | null
          response_body: string | null
          response_status: number | null
          status: string
        }
        Insert: {
          attempt: number
          channel_id: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          response_body?: string | null
          response_status?: number | null
          status: string
        }
        Update: {
          attempt?: number
          channel_id?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          response_body?: string | null
          response_status?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_notification_channel_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "organization_notification_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_notification_channel_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_notification_channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["notification_channel_type"]
          created_at: string
          custom_headers: Json | null
          custom_payload_template: Json | null
          failure_count: number
          id: string
          is_enabled: boolean
          last_attempted_at: string | null
          last_error: string | null
          last_status: string | null
          notification_type: string
          organization_id: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          channel_type: Database["public"]["Enums"]["notification_channel_type"]
          created_at?: string
          custom_headers?: Json | null
          custom_payload_template?: Json | null
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_attempted_at?: string | null
          last_error?: string | null
          last_status?: string | null
          notification_type: string
          organization_id: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["notification_channel_type"]
          created_at?: string
          custom_headers?: Json | null
          custom_payload_template?: Json | null
          failure_count?: number
          id?: string
          is_enabled?: boolean
          last_attempted_at?: string | null
          last_error?: string | null
          last_status?: string | null
          notification_type?: string
          organization_id?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_notification_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_phase_history: {
        Row: {
          changed_by: string | null
          id: string
          notes: string | null
          organization_id: string
          phase: string
          recorded_at: string
          source: string
        }
        Insert: {
          changed_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          phase: string
          recorded_at?: string
          source?: string
        }
        Update: {
          changed_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phase?: string
          recorded_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_phase_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_phase_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          employee_count_range: string | null
          id: string
          industry: string | null
          isms_phase: string | null
          isms_phase_set_at: string | null
          iso_certification_status: string | null
          name: string
          name_en: string | null
          subscription_plan: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_count_range?: string | null
          id?: string
          industry?: string | null
          isms_phase?: string | null
          isms_phase_set_at?: string | null
          iso_certification_status?: string | null
          name: string
          name_en?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_count_range?: string | null
          id?: string
          industry?: string | null
          isms_phase?: string | null
          isms_phase_set_at?: string | null
          iso_certification_status?: string | null
          name?: string
          name_en?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          organization_id: string | null
          paid_at: string | null
          payment_method_type: string | null
          status: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          paid_at?: string | null
          payment_method_type?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          paid_at?: string | null
          payment_method_type?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_storage_gb: number | null
          max_users: number | null
          name: string
          price_monthly: number
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_storage_gb?: number | null
          max_users?: number | null
          name: string
          price_monthly: number
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_storage_gb?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          invitation_id: string | null
          note: string | null
          organization_id: string
          role_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          invitation_id?: string | null
          note?: string | null
          organization_id: string
          role_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          invitation_id?: string | null
          note?: string | null
          organization_id?: string
          role_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "organization_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_roles: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
          key: string
          name: string
          name_en: string | null
          organization_id: string
          responsibilities: string[] | null
          seed_source: string | null
          seeded_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          key: string
          name: string
          name_en?: string | null
          organization_id: string
          responsibilities?: string[] | null
          seed_source?: string | null
          seeded_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          key?: string
          name?: string
          name_en?: string | null
          organization_id?: string
          responsibilities?: string[] | null
          seed_source?: string | null
          seeded_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessment_history: {
        Row: {
          assessed_by: string | null
          assessment_date: string | null
          id: string
          new_impact_level: number | null
          new_likelihood_level: number | null
          notes: string | null
          previous_impact_level: number | null
          previous_likelihood_level: number | null
          risk_id: string | null
        }
        Insert: {
          assessed_by?: string | null
          assessment_date?: string | null
          id?: string
          new_impact_level?: number | null
          new_likelihood_level?: number | null
          notes?: string | null
          previous_impact_level?: number | null
          previous_likelihood_level?: number | null
          risk_id?: string | null
        }
        Update: {
          assessed_by?: string | null
          assessment_date?: string | null
          id?: string
          new_impact_level?: number | null
          new_likelihood_level?: number | null
          notes?: string | null
          previous_impact_level?: number | null
          previous_likelihood_level?: number | null
          risk_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_history_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessment_history_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assets: {
        Row: {
          asset_id: string
          created_at: string | null
          id: string
          risk_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          id?: string
          risk_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          id?: string
          risk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "information_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assets_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_control_links: {
        Row: {
          created_at: string | null
          id: string
          iso_control_id: string
          risk_treatment_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          iso_control_id: string
          risk_treatment_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          iso_control_id?: string
          risk_treatment_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_control_links_iso_control_id_fkey"
            columns: ["iso_control_id"]
            isOneToOne: false
            referencedRelation: "iso_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_control_links_risk_treatment_id_fkey"
            columns: ["risk_treatment_id"]
            isOneToOne: false
            referencedRelation: "risk_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_criteria: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          label: string
          level: number
          organization_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          level: number
          organization_id?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          level?: number
          organization_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_criteria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_treatments: {
        Row: {
          actual_cost: number | null
          cost_estimate: number | null
          created_at: string | null
          description: string
          due_date: string | null
          effectiveness_rating: number | null
          id: string
          residual_approval_status: string | null
          residual_approved_at: string | null
          residual_approved_by: string | null
          residual_rejection_reason: string | null
          residual_review_due_date: string | null
          responsible_id: string | null
          risk_id: string | null
          status: string | null
          treatment_type: string
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          cost_estimate?: number | null
          created_at?: string | null
          description: string
          due_date?: string | null
          effectiveness_rating?: number | null
          id?: string
          residual_approval_status?: string | null
          residual_approved_at?: string | null
          residual_approved_by?: string | null
          residual_rejection_reason?: string | null
          residual_review_due_date?: string | null
          responsible_id?: string | null
          risk_id?: string | null
          status?: string | null
          treatment_type: string
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          cost_estimate?: number | null
          created_at?: string | null
          description?: string
          due_date?: string | null
          effectiveness_rating?: number | null
          id?: string
          residual_approval_status?: string | null
          residual_approved_at?: string | null
          residual_approved_by?: string | null
          residual_rejection_reason?: string | null
          residual_review_due_date?: string | null
          responsible_id?: string | null
          risk_id?: string | null
          status?: string | null
          treatment_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_treatments_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_treatments_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          assessment_period: string | null
          category_id: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          id: string
          identified_by: string | null
          identified_date: string | null
          impact_level: number | null
          likelihood_level: number | null
          organization_id: string | null
          owner_id: string | null
          risk_score: number | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assessment_period?: string | null
          category_id?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          identified_by?: string | null
          identified_date?: string | null
          impact_level?: number | null
          likelihood_level?: number | null
          organization_id?: string | null
          owner_id?: string | null
          risk_score?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assessment_period?: string | null
          category_id?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          identified_by?: string | null
          identified_date?: string | null
          impact_level?: number | null
          likelihood_level?: number | null
          organization_id?: string | null
          owner_id?: string | null
          risk_score?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "risk_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_identified_by_fkey"
            columns: ["identified_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_bucket_thresholds: {
        Row: {
          bucket_id: string
          hard_limit_bytes: number
          soft_limit_bytes: number
          updated_at: string
        }
        Insert: {
          bucket_id: string
          hard_limit_bytes?: number
          soft_limit_bytes?: number
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          hard_limit_bytes?: number
          soft_limit_bytes?: number
          updated_at?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_data: Json | null
          event_type: string
          id: string
          processed: boolean | null
          processed_at: string | null
          stripe_event_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          stripe_event_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string | null
          pricing_plan_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string | null
          pricing_plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string | null
          pricing_plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_pricing_plan_id_fkey"
            columns: ["pricing_plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          task_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          task_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          task_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          created_at: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reminders: {
        Row: {
          created_at: string | null
          id: string
          is_sent: boolean | null
          reminder_date: string
          reminder_type: string | null
          sent_at: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_sent?: boolean | null
          reminder_date: string
          reminder_type?: string | null
          sent_at?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_sent?: boolean | null
          reminder_date?: string
          reminder_type?: string | null
          sent_at?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tag_relations: {
        Row: {
          display_order: number
          tag_id: string
          task_id: string
        }
        Insert: {
          display_order?: number
          tag_id: string
          task_id: string
        }
        Update: {
          display_order?: number
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "task_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tag_relations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          category_id: string | null
          completed_at: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          organization_id: string | null
          parent_task_id: string | null
          priority: string | null
          progress: number | null
          related_document_id: string | null
          related_risk_id: string | null
          reporter_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id?: string | null
          parent_task_id?: string | null
          priority?: string | null
          progress?: number | null
          related_document_id?: string | null
          related_risk_id?: string | null
          reporter_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id?: string | null
          parent_task_id?: string | null
          priority?: string | null
          progress?: number | null
          related_document_id?: string | null
          related_risk_id?: string | null
          reporter_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_risk_id_fkey"
            columns: ["related_risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          created_at: string | null
          current_value: number | null
          id: string
          limit_value: number | null
          measured_at: string | null
          metric_type: string | null
          organization_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          id?: string
          limit_value?: number | null
          measured_at?: string | null
          metric_type?: string | null
          organization_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          id?: string
          limit_value?: number | null
          measured_at?: string | null
          metric_type?: string | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memberships: {
        Row: {
          assigned_by: string | null
          created_at: string
          department_scope:
            | Database["public"]["Enums"]["department_scope_type"]
            | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          department_scope?:
            | Database["public"]["Enums"]["department_scope_type"]
            | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          department_scope?:
            | Database["public"]["Enums"]["department_scope_type"]
            | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memberships_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_sets: {
        Row: {
          can_manage_assets: boolean | null
          can_manage_audit: boolean | null
          can_manage_controls: boolean | null
          can_manage_documents: boolean | null
          can_manage_risks: boolean | null
          can_manage_tasks: boolean | null
          created_at: string | null
          id: string
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_manage_assets?: boolean | null
          can_manage_audit?: boolean | null
          can_manage_controls?: boolean | null
          can_manage_documents?: boolean | null
          can_manage_risks?: boolean | null
          can_manage_tasks?: boolean | null
          created_at?: string | null
          id?: string
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_manage_assets?: boolean | null
          can_manage_audit?: boolean | null
          can_manage_controls?: boolean | null
          can_manage_documents?: boolean | null
          can_manage_risks?: boolean | null
          can_manage_tasks?: boolean | null
          created_at?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_sets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_scopes: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_scopes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_scopes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          email: string
          full_name: string
          full_name_en: string | null
          id: string
          is_active: boolean | null
          language_preference: string | null
          last_login_at: string | null
          organization_id: string | null
          phone: string | null
          position: string | null
          primary_department_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          full_name: string
          full_name_en?: string | null
          id: string
          is_active?: boolean | null
          language_preference?: string | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          primary_department_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string
          full_name_en?: string | null
          id?: string
          is_active?: boolean | null
          language_preference?: string | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          primary_department_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_primary_department_id_fkey"
            columns: ["primary_department_id"]
            isOneToOne: false
            referencedRelation: "organization_departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_period_statistics: {
        Row: {
          audit_period: string | null
          cancelled_plans: number | null
          closed_nonconformities: number | null
          completed_checklist_items: number | null
          completed_corrective_actions: number | null
          completed_plans: number | null
          follow_up_completed_plans: number | null
          follow_up_on_hold_plans: number | null
          follow_up_reopened_plans: number | null
          in_progress_checklist_items: number | null
          in_progress_corrective_actions: number | null
          in_progress_nonconformities: number | null
          in_progress_plans: number | null
          not_started_checklist_items: number | null
          open_corrective_actions: number | null
          open_nonconformities: number | null
          organization_id: string | null
          overdue_corrective_actions: number | null
          overdue_nonconformities: number | null
          planned_corrective_actions: number | null
          planning_plans: number | null
          resolved_nonconformities: number | null
          scheduled_plans: number | null
          total_checklist_items: number | null
          total_nonconformities: number | null
          total_plans: number | null
          verified_corrective_actions: number | null
          verified_nonconformities: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_metrics: {
        Row: {
          bucket_id: string | null
          hard_limit_bytes: number | null
          last_activity_at: string | null
          object_count: number | null
          soft_limit_bytes: number | null
          usage_bytes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_document_version_usage: {
        Args: { p_org_id: string }
        Returns: number
      }
      check_usage_limit: {
        Args: { metric: string; org_id: string }
        Returns: boolean
      }
      create_default_risk_categories: {
        Args: { org_id: string }
        Returns: undefined
      }
      create_default_risk_criteria: {
        Args: { org_id: string }
        Returns: undefined
      }
      create_default_task_categories: {
        Args: { org_id: string }
        Returns: undefined
      }
      create_tenant: {
        Args: {
          p_name: string
          p_plan?: string
          p_status?: string
          p_trial_days?: number
        }
        Returns: {
          created_at: string
          id: string
          name: string
          subscription_plan: string
          subscription_status: string
          trial_ends_at: string
          updated_at: string
        }[]
      }
      current_user_admin_org_ids: { Args: never; Returns: string[] }
      current_user_organization_ids: { Args: never; Returns: string[] }
      get_organization_storage_usage: {
        Args: { org_id: string }
        Returns: number
      }
      get_user_accessible_department_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      list_all_tenants: {
        Args: never
        Returns: {
          audit_log_count: number
          created_at: string
          id: string
          last_audit_at: string
          locked: boolean
          name: string
          subscription_plan: string
          subscription_status: string
          trial_ends_at: string
          updated_at: string
        }[]
      }
      list_global_audit_logs: {
        Args: { p_before?: string; p_limit?: number; p_scope?: string }
        Returns: {
          action: string
          changes: Json
          created_at: string
          id: string
          organization_id: string
          organization_name: string
          scope: string
          user_email: string
          user_id: string
        }[]
      }
      prune_expired_documents: { Args: never; Returns: number }
      recalc_parent_task_progress: {
        Args: { p_parent_id: string }
        Returns: undefined
      }
      refresh_document_version_usage: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      refresh_user_usage: { Args: { p_org_id: string }; Returns: undefined }
      run_information_asset_import:
        | {
            Args: {
              p_created_by: string
              p_filename?: string
              p_organization_id: string
              p_rows: Json
            }
            Returns: {
              error_count: number
              errors: Json
              job_id: string
              success_count: number
              total_rows: number
            }[]
          }
        | {
            Args: {
              p_created_by: string
              p_filename?: string
              p_mode?: string
              p_organization_id: string
              p_rows: Json
            }
            Returns: {
              error_count: number
              errors: Json
              job_id: string
              success_count: number
              total_rows: number
              upsert_count: number
            }[]
          }
      seed_project_roles: {
        Args: { payload: Json; target_org: string }
        Returns: Json
      }
      seed_risk_demo: {
        Args: {
          desired_count?: number
          refresh_existing?: boolean
          target_org_id?: string
        }
        Returns: number
      }
      set_organization_phase: {
        Args: { new_phase: string; org_id: string; phase_source?: string }
        Returns: {
          created_at: string | null
          employee_count_range: string | null
          id: string
          industry: string | null
          isms_phase: string | null
          isms_phase_set_at: string | null
          iso_certification_status: string | null
          name: string
          name_en: string | null
          subscription_plan: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_task_tags: {
        Args: { p_tag_ids: string[]; p_task_id: string }
        Returns: undefined
      }
      toggle_tenant_lock: {
        Args: { p_org_id: string; p_reason?: string }
        Returns: {
          id: string
          locked: boolean
          subscription_status: string
          updated_at: string
        }[]
      }
      soft_delete_tenant: {
        Args: { p_org_id: string; p_reason?: string }
        Returns: {
          id: string
          name: string
          deleted_at: string
          updated_at: string
        }[]
      }
      restore_tenant: {
        Args: { p_org_id: string; p_reason?: string }
        Returns: {
          id: string
          name: string
          deleted_at: string | null
          updated_at: string
        }[]
      }
      transfer_project_assignments: {
        Args: { invitation: string; new_user: string }
        Returns: undefined
      }
      update_usage_tracking: {
        Args: { metric: string; new_value: number; org_id: string }
        Returns: undefined
      }
      user_can_access_department: {
        Args: { p_target_department_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_global_role: { Args: never; Returns: boolean }
      user_has_role:
        | { Args: { required_roles: string[] }; Returns: boolean }
        | {
            Args: {
              required_roles: Database["public"]["Enums"]["user_role"][]
              target_org?: string
            }
            Returns: boolean
          }
      user_is_member_of: { Args: { p_org: string }; Returns: boolean }
    }
    Enums: {
      department_scope_type: "own" | "subtree" | "all"
      notification_channel_type: "slack" | "teams" | "custom"
      user_role:
        | "super_admin"
        | "system_operator"
        | "org_admin"
        | "user"
        | "auditor"
        | "approver"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_level: { Args: { name: string }; Returns: number }
      get_prefix: { Args: { name: string }; Returns: string }
      get_prefixes: { Args: { name: string }; Returns: string[] }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Database

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      department_scope_type: ["own", "subtree", "all"],
      notification_channel_type: ["slack", "teams", "custom"],
      user_role: [
        "super_admin",
        "system_operator",
        "org_admin",
        "user",
        "auditor",
        "approver",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
