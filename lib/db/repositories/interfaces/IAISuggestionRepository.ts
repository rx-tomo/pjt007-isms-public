/**
 * AI Suggestion Repository Interface
 *
 * Handles all AI suggestion-related data operations including:
 * - CRUD operations for ai_suggestions table
 * - Accept/reject suggestion status updates
 * - Organization and risk-based queries
 */

/**
 * Suggestion type enum matching database constraint
 */
export type SuggestionType = 'threat' | 'vulnerability' | 'impact' | 'likelihood' | 'treatment'
export type SuggestionDecisionStatus = 'draft' | 'accepted' | 'accepted_with_edits' | 'rejected' | 'expired'

/**
 * AI Suggestion entity
 */
export interface AISuggestion {
  id: string
  organizationId: string
  riskId: string | null
  suggestionType: SuggestionType
  inputContext: Record<string, unknown>
  inputScope: Record<string, unknown> | null
  suggestionContent: Record<string, unknown>
  decisionStatus: SuggestionDecisionStatus
  finalContent: Record<string, unknown> | null
  decisionReason: string | null
  accepted: boolean | null
  acceptedAt: string | null
  acceptedBy: string | null
  usageLogId: string | null
  createdAt: string
}

/**
 * AI Suggestion database row type (snake_case DB row)
 */
export interface AISuggestionRow {
  id: string
  organization_id: string
  risk_id: string | null
  suggestion_type: SuggestionType
  input_context: Record<string, unknown>
  input_scope: Record<string, unknown> | null
  suggestion_content: Record<string, unknown>
  decision_status: SuggestionDecisionStatus
  final_content: Record<string, unknown> | null
  decision_reason: string | null
  accepted: boolean | null
  accepted_at: string | null
  accepted_by: string | null
  usage_log_id: string | null
  created_at: string
}

/**
 * Input for creating a new AI suggestion
 */
export interface CreateSuggestionInput {
  organizationId: string
  riskId?: string | null
  suggestionType: SuggestionType
  inputContext: Record<string, unknown>
  inputScope?: Record<string, unknown> | null
  suggestionContent: Record<string, unknown>
  usageLogId?: string | null
}

export interface DecideSuggestionInput {
  id: string
  userId: string
  status: Exclude<SuggestionDecisionStatus, 'draft'>
  finalContent?: Record<string, unknown> | null
  reason?: string | null
}

/**
 * AI Suggestion Repository Interface
 */
export interface IAISuggestionRepository {
  /**
   * Create a new AI suggestion
   */
  create(input: CreateSuggestionInput): Promise<AISuggestion>

  /**
   * Find a suggestion by ID
   */
  findById(id: string): Promise<AISuggestion | null>

  /**
   * Find all suggestions for a specific risk
   */
  findByRiskId(riskId: string): Promise<AISuggestion[]>

  /**
   * Find all suggestions for an organization
   */
  findByOrganizationId(organizationId: string): Promise<AISuggestion[]>

  /**
   * Accept a suggestion (set accepted=true with timestamp and user)
   */
  accept(id: string, userId: string): Promise<AISuggestion>

  decide(input: DecideSuggestionInput): Promise<AISuggestion>

  /**
   * Reject a suggestion (set accepted=false with timestamp and user)
   */
  reject(id: string, userId: string): Promise<AISuggestion>

  /**
   * Delete a suggestion by ID
   */
  delete(id: string): Promise<boolean>
}
