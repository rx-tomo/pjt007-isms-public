/**
 * AI Usage Log Repository Interface
 *
 * Handles all AI usage log-related data operations including:
 * - Recording token usage for AI API calls
 * - Tracking errors and failures
 * - Organization-based usage queries
 *
 * @module lib/db/repositories/interfaces/IAIUsageLogRepository
 */

/**
 * Request type enum matching database constraint
 */
export type RequestType = 'risk_identification' | 'risk_assessment' | 'treatment_suggestion'
export type AIRunStatus = 'started' | 'succeeded' | 'failed' | 'cancelled'

/**
 * AI Usage Log entity (domain model)
 */
export interface AIUsageLog {
  id: string
  organizationId: string
  userId: string | null
  provider: string
  providerMode: string
  modelLabel: string | null
  requestType: RequestType
  status: AIRunStatus
  inputScope: Record<string, unknown> | null
  targetRecords: Record<string, unknown> | null
  redactionSummary: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cached: boolean | null
  latencyMs: number | null
  errorMessage: string | null
  createdAt: string
}

/**
 * AI Usage Log database row type (snake_case DB row)
 */
export interface AIUsageLogRow {
  id: string
  organization_id: string
  user_id: string | null
  provider: string
  provider_mode: string
  model_label: string | null
  request_type: RequestType
  status: AIRunStatus
  input_scope: Record<string, unknown> | null
  target_records: Record<string, unknown> | null
  redaction_summary: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cached: boolean | null
  latency_ms: number | null
  error_message: string | null
  created_at: string
}

/**
 * Input for creating a new AI usage log
 */
export interface CreateUsageLogInput {
  organizationId: string
  userId?: string | null
  provider: string
  providerMode?: string
  modelLabel?: string | null
  requestType: RequestType
  status?: AIRunStatus
  inputScope?: Record<string, unknown> | null
  targetRecords?: Record<string, unknown> | null
  redactionSummary?: Record<string, unknown> | null
  startedAt?: string | null
  completedAt?: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cached: boolean
  latencyMs?: number | null
  errorMessage?: string | null
}

/**
 * Usage statistics for a time period
 */
export interface UsageStatistics {
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  cachedRequests: number
  errorCount: number
}

/**
 * AI Usage Log Repository Interface
 */
export interface IAIUsageLogRepository {
  /**
   * Create a new AI usage log entry
   */
  create(input: CreateUsageLogInput): Promise<AIUsageLog>

  /**
   * Find a usage log by ID
   */
  findById(id: string): Promise<AIUsageLog | null>

  /**
   * Find all usage logs for an organization
   * @param limit - Maximum number of records to return (default 100)
   */
  findByOrganizationId(organizationId: string, limit?: number): Promise<AIUsageLog[]>

  /**
   * Find usage logs by user
   */
  findByUserId(userId: string): Promise<AIUsageLog[]>

  /**
   * Get usage statistics for an organization within a date range
   */
  getStatistics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageStatistics>
}
