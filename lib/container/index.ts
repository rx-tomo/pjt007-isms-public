/**
 * Dependency Injection Container
 *
 * This module provides a simple DI container that instantiates the appropriate
 * implementations based on the current environment configuration.
 *
 * Environment Variables:
 * - DATABASE_MODE: 'sqlite' | 'turso' (default: 'sqlite')
 * - AUTH_MODE: 'mock' | 'betterauth' (default: 'betterauth')
 * - AI_PROVIDER_MODE: 'claude' | 'mock' | 'ollama' (default: 'claude')
 */

import type { IOrganizationRepository } from '@/lib/db/repositories/interfaces/IOrganizationRepository'
import type { IUserRepository } from '@/lib/db/repositories/interfaces/IUserRepository'
import type { IAuditLogRepository } from '@/lib/db/repositories/interfaces/IAuditLogRepository'
import type { IDocumentRepository } from '@/lib/db/repositories/interfaces/IDocumentRepository'
import type { IInformationAssetRepository } from '@/lib/db/repositories/interfaces/IInformationAssetRepository'
import type { IRiskRepository } from '@/lib/db/repositories/interfaces/IRiskRepository'
import type { ITaskRepository } from '@/lib/db/repositories/interfaces/ITaskRepository'
import type { IIsoControlRepository } from '@/lib/db/repositories/interfaces/IIsoControlRepository'
import type { IAuditPlanRepository } from '@/lib/db/repositories/interfaces/IAuditPlanRepository'
import type { IAISuggestionRepository } from '@/lib/db/repositories/interfaces/IAISuggestionRepository'
import type { IAIUsageLogRepository } from '@/lib/db/repositories/interfaces/IAIUsageLogRepository'
import type { IAuthProvider } from '@/lib/auth/interfaces/IAuthProvider'
import type { IAIProvider } from '@/lib/ai/interfaces/IAIProvider'
import type { AIRiskAssessmentService } from '@/lib/services/aiRiskAssessment'
import type { IAlertStore } from '@/lib/ai/monitoring/AlertStore'
import type { IConfigStore } from '@/lib/ai/config/ConfigStore'
import type { IEducationRepository } from '@/lib/db/repositories/interfaces/IEducationRepository'

/**
 * Database mode configuration
 */
export type DatabaseMode = 'sqlite' | 'turso'

/**
 * Auth mode configuration
 */
export type AuthMode = 'mock' | 'betterauth'

/**
 * AI Provider mode configuration
 * - 'claude': Anthropic Claude API (production)
 * - 'mock': Mock provider for testing
 * - 'ollama': Local LLM via Ollama
 */
export type AIProviderMode = 'claude' | 'mock' | 'ollama'

/**
 * Get the current database mode from environment
 */
export function getDatabaseMode(): DatabaseMode {
  const mode = process.env.DATABASE_MODE || 'sqlite'
  if (mode !== 'sqlite' && mode !== 'turso') {
    console.warn(`Invalid DATABASE_MODE: ${mode}, falling back to 'sqlite'`)
    return 'sqlite'
  }
  return mode
}

/**
 * Get the current auth mode from environment
 */
export function getAuthMode(): AuthMode {
  const mode = process.env.AUTH_MODE || 'betterauth'
  if (mode !== 'mock' && mode !== 'betterauth') {
    console.warn(`Invalid AUTH_MODE: ${mode}, falling back to 'betterauth'`)
    return 'betterauth'
  }
  return mode
}

/**
 * Get the current AI provider mode from environment
 */
function hasUsableAnthropicKey(): boolean {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (key === '') return false
  const lower = key.toLowerCase()
  return !['your_', 'xxx', '...', 'sample', 'placeholder'].some((token) => lower.includes(token))
}

export function getAIProviderMode(): AIProviderMode {
  const mode = process.env.AI_PROVIDER_MODE || 'claude'
  if (mode !== 'claude' && mode !== 'mock' && mode !== 'ollama') {
    console.warn(`Invalid AI_PROVIDER_MODE: ${mode}, falling back to 'mock'`)
    return 'mock'
  }
  if (mode === 'claude' && !hasUsableAnthropicKey()) {
    // 実キーなしでもAI機能のフロー全体が通るようにモックへフォールバック（DoD: スタブで全フロー通過）
    console.info("AI_PROVIDER_MODE=claude but ANTHROPIC_API_KEY is not usable, falling back to 'mock'")
    return 'mock'
  }
  return mode
}

/**
 * Container configuration
 */
export interface ContainerConfig {
  databaseMode: DatabaseMode
  authMode: AuthMode
}

/**
 * Container interface
 */
export interface IContainer {
  getOrganizationRepository(): IOrganizationRepository
  getUserRepository(): IUserRepository
  getAuditLogRepository(): IAuditLogRepository
  getDocumentRepository(): IDocumentRepository
  getInformationAssetRepository(): IInformationAssetRepository
  getRiskRepository(): IRiskRepository
  getTaskRepository(): ITaskRepository
  getIsoControlRepository(): IIsoControlRepository
  getAuditPlanRepository(): IAuditPlanRepository
  getAuthProvider(): IAuthProvider
}

/**
 * Singleton instances cache
 */
let organizationRepository: IOrganizationRepository | null = null
let userRepository: IUserRepository | null = null
let auditLogRepository: IAuditLogRepository | null = null
let documentRepository: IDocumentRepository | null = null
let informationAssetRepository: IInformationAssetRepository | null = null
let riskRepository: IRiskRepository | null = null
let taskRepository: ITaskRepository | null = null
let isoControlRepository: IIsoControlRepository | null = null
let auditPlanRepository: IAuditPlanRepository | null = null
let aiSuggestionRepository: IAISuggestionRepository | null = null
let aiUsageLogRepository: IAIUsageLogRepository | null = null
let authProvider: IAuthProvider | null = null
let aiProvider: IAIProvider | null = null
let aiRiskAssessmentService: AIRiskAssessmentService | null = null
let alertStore: IAlertStore | null = null
let configStore: IConfigStore | null = null
let educationRepository: IEducationRepository | null = null

/**
 * Reset all cached instances (useful for testing)
 */
export function resetContainer(): void {
  organizationRepository = null
  userRepository = null
  auditLogRepository = null
  documentRepository = null
  informationAssetRepository = null
  riskRepository = null
  taskRepository = null
  isoControlRepository = null
  auditPlanRepository = null
  aiSuggestionRepository = null
  aiUsageLogRepository = null
  authProvider = null
  aiProvider = null
  aiRiskAssessmentService = null
  alertStore = null
  configStore = null
  educationRepository = null
}

/**
 * Reset AI Provider cached instance (useful for testing)
 */
export function resetAIProvider(): void {
  aiProvider = null
}

/**
 * Reset AI Risk Assessment Service cached instance (useful for testing)
 */
export function resetAIRiskAssessmentService(): void {
  aiRiskAssessmentService = null
}

/**
 * Get Organization Repository instance
 */
export async function getOrganizationRepository(): Promise<IOrganizationRepository> {
  if (organizationRepository) {
    return organizationRepository
  }

  const { SQLiteOrganizationRepository } = await import('@/lib/db/repositories/sqlite/OrganizationRepository')
  organizationRepository = new SQLiteOrganizationRepository()

  return organizationRepository
}

/**
 * Get User Repository instance
 */
export async function getUserRepository(): Promise<IUserRepository> {
  if (userRepository) {
    return userRepository
  }

  const { SQLiteUserRepository } = await import('@/lib/db/repositories/sqlite/UserRepository')
  userRepository = new SQLiteUserRepository()

  return userRepository
}

/**
 * Get Audit Log Repository instance
 */
export async function getAuditLogRepository(): Promise<IAuditLogRepository> {
  if (auditLogRepository) {
    return auditLogRepository
  }

  const { SQLiteAuditLogRepository } = await import('@/lib/db/repositories/sqlite/AuditLogRepository')
  auditLogRepository = new SQLiteAuditLogRepository()

  return auditLogRepository
}

/**
 * Get Document Repository instance
 */
export async function getDocumentRepository(): Promise<IDocumentRepository> {
  if (documentRepository) {
    return documentRepository
  }

  const { SQLiteDocumentRepository } = await import('@/lib/db/repositories/sqlite/DocumentRepository')
  documentRepository = new SQLiteDocumentRepository()

  return documentRepository
}

/**
 * Get Information Asset Repository instance
 */
export async function getInformationAssetRepository(): Promise<IInformationAssetRepository> {
  if (informationAssetRepository) {
    return informationAssetRepository
  }

  const { SQLiteInformationAssetRepository } = await import('@/lib/db/repositories/sqlite/InformationAssetRepository')
  informationAssetRepository = new SQLiteInformationAssetRepository()

  return informationAssetRepository
}

/**
 * Get Risk Repository instance
 */
export async function getRiskRepository(): Promise<IRiskRepository> {
  if (riskRepository) {
    return riskRepository
  }

  const { SQLiteRiskRepository } = await import('@/lib/db/repositories/sqlite/RiskRepository')
  riskRepository = new SQLiteRiskRepository()

  return riskRepository
}

/**
 * Get Task Repository instance
 */
export async function getTaskRepository(): Promise<ITaskRepository> {
  if (taskRepository) {
    return taskRepository
  }

  const { SQLiteTaskRepository } = await import('@/lib/db/repositories/sqlite/TaskRepository')
  taskRepository = new SQLiteTaskRepository()

  return taskRepository
}

/**
 * Get ISO Control Repository instance
 */
export async function getIsoControlRepository(): Promise<IIsoControlRepository> {
  if (isoControlRepository) {
    return isoControlRepository
  }

  const { SQLiteIsoControlRepository } = await import('@/lib/db/repositories/sqlite/IsoControlRepository')
  isoControlRepository = new SQLiteIsoControlRepository()

  return isoControlRepository
}

/**
 * Get Audit Plan Repository instance
 */
export async function getAuditPlanRepository(): Promise<IAuditPlanRepository> {
  if (auditPlanRepository) {
    return auditPlanRepository
  }

  const { SQLiteAuditPlanRepository } = await import('@/lib/db/repositories/sqlite/AuditPlanRepository')
  auditPlanRepository = new SQLiteAuditPlanRepository()

  return auditPlanRepository
}

/**
 * Get Education Repository instance
 */
export async function getEducationRepository(): Promise<IEducationRepository> {
  if (educationRepository) {
    return educationRepository
  }

  const { SQLiteEducationRepository } = await import('@/lib/db/repositories/sqlite/EducationRepository')
  educationRepository = new SQLiteEducationRepository()

  return educationRepository
}

/**
 * Get AI Suggestion Repository instance
 */
export async function getAISuggestionRepository(): Promise<IAISuggestionRepository> {
  if (aiSuggestionRepository) {
    return aiSuggestionRepository
  }

  const { SQLiteAISuggestionRepository } = await import('@/lib/db/repositories/sqlite/AISuggestionRepository')
  aiSuggestionRepository = new SQLiteAISuggestionRepository()

  return aiSuggestionRepository
}

/**
 * Get AI Usage Log Repository instance
 */
export async function getAIUsageLogRepository(): Promise<IAIUsageLogRepository> {
  if (aiUsageLogRepository) {
    return aiUsageLogRepository
  }

  const { SQLiteAIUsageLogRepository } = await import('@/lib/db/repositories/sqlite/AIUsageLogRepository')
  aiUsageLogRepository = new SQLiteAIUsageLogRepository()

  return aiUsageLogRepository
}

/**
 * Get Auth Provider instance
 */
export async function getAuthProvider(): Promise<IAuthProvider> {
  if (authProvider) {
    return authProvider
  }

  // Browser runtime must use the client-side auth provider.
  // This avoids importing server-only auth modules (better-auth.ts -> getDb -> fs).
  if (typeof window !== 'undefined') {
    const { ClientAuthProvider } = await import('@/lib/auth/client/ClientAuthProvider')
    authProvider = new ClientAuthProvider()
    return authProvider
  }

  const mode = getAuthMode()

  if (mode === 'mock') {
    const { MockAuthProvider } = await import('@/lib/auth/mock/MockAuthProvider')
    authProvider = new MockAuthProvider()
  } else {
    const { BetterAuthProvider } = await import('@/lib/auth/betterauth/BetterAuthProvider')
    authProvider = new BetterAuthProvider()
  }

  return authProvider
}

/**
 * Get AI Provider instance
 */
export async function getAIProvider(): Promise<IAIProvider> {
  if (aiProvider) {
    return aiProvider
  }

  const mode = getAIProviderMode()

  if (mode === 'mock') {
    // Dynamic import for Mock implementation
    const { MockProvider } = await import('@/lib/ai/providers/MockProvider')
    aiProvider = new MockProvider()
  } else if (mode === 'ollama') {
    const { OllamaProvider } = await import('@/lib/ai/providers/LocalLLMProvider')
    const timeoutMs = process.env.OLLAMA_TIMEOUT_MS
      ? Number(process.env.OLLAMA_TIMEOUT_MS)
      : undefined

    const providerConfig = {
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3',
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 30000
    }

    aiProvider = new OllamaProvider(providerConfig)
  } else {
    // Claude implementation
    const { ClaudeProvider } = await import('@/lib/ai/providers/ClaudeProvider')
    aiProvider = new ClaudeProvider()
  }

  return aiProvider
}

/**
 * Get Alert Store instance
 */
export async function getAlertStore(): Promise<IAlertStore> {
  if (alertStore) {
    return alertStore
  }

  const { SQLiteAlertStore } = await import('@/lib/ai/monitoring/SQLiteAlertStore')
  alertStore = new SQLiteAlertStore()

  return alertStore
}

/**
 * Get Config Store instance for AI feature configuration
 */
export async function getConfigStore(): Promise<IConfigStore> {
  if (configStore) {
    return configStore
  }

  const { SQLiteConfigStore } = await import('@/lib/ai/config/SQLiteConfigStore')
  configStore = new SQLiteConfigStore()

  return configStore
}

/**
 * Get AI Risk Assessment Service instance
 *
 * Lazy initializes the service with all required dependencies:
 * - AI Provider (Claude or Mock based on AI_PROVIDER_MODE)
 * - Privacy Filter
 * - Cache Manager
 * - AI Suggestion Repository
 * - AI Usage Log Repository
 */
export async function getAIRiskAssessmentService(): Promise<AIRiskAssessmentService> {
  if (aiRiskAssessmentService) {
    return aiRiskAssessmentService
  }

  // Import dependencies
  const { AIRiskAssessmentService: AIRiskAssessmentServiceClass } = await import(
    '@/lib/services/aiRiskAssessment'
  )
  const { PrivacyFilter } = await import('@/lib/ai/filters/PrivacyFilter')
  const { CacheManager } = await import('@/lib/ai/cache/CacheManager')

  // Get repository and provider instances
  const [provider, suggestionRepo, usageLogRepo] = await Promise.all([
    getAIProvider(),
    getAISuggestionRepository(),
    getAIUsageLogRepository()
  ])

  // Create service instance
  aiRiskAssessmentService = new AIRiskAssessmentServiceClass(
    provider,
    new PrivacyFilter(),
    new CacheManager(),
    suggestionRepo,
    usageLogRepo
  )

  return aiRiskAssessmentService
}

/**
 * Container class for synchronous access after initialization
 */
export class Container implements IContainer {
  private _organizationRepository: IOrganizationRepository
  private _userRepository: IUserRepository
  private _auditLogRepository: IAuditLogRepository
  private _documentRepository: IDocumentRepository
  private _informationAssetRepository: IInformationAssetRepository
  private _riskRepository: IRiskRepository
  private _taskRepository: ITaskRepository
  private _isoControlRepository: IIsoControlRepository
  private _auditPlanRepository: IAuditPlanRepository
  private _authProvider: IAuthProvider

  private constructor(
    organizationRepository: IOrganizationRepository,
    userRepository: IUserRepository,
    auditLogRepository: IAuditLogRepository,
    documentRepository: IDocumentRepository,
    informationAssetRepository: IInformationAssetRepository,
    riskRepository: IRiskRepository,
    taskRepository: ITaskRepository,
    isoControlRepository: IIsoControlRepository,
    auditPlanRepository: IAuditPlanRepository,
    authProvider: IAuthProvider
  ) {
    this._organizationRepository = organizationRepository
    this._userRepository = userRepository
    this._auditLogRepository = auditLogRepository
    this._documentRepository = documentRepository
    this._informationAssetRepository = informationAssetRepository
    this._riskRepository = riskRepository
    this._taskRepository = taskRepository
    this._isoControlRepository = isoControlRepository
    this._auditPlanRepository = auditPlanRepository
    this._authProvider = authProvider
  }

  /**
   * Create a fully initialized container
   */
  static async create(): Promise<Container> {
    const [
      orgRepo,
      userRepo,
      auditRepo,
      docRepo,
      assetRepo,
      riskRepo,
      taskRepo,
      isoRepo,
      auditPlanRepo,
      auth
    ] = await Promise.all([
      getOrganizationRepository(),
      getUserRepository(),
      getAuditLogRepository(),
      getDocumentRepository(),
      getInformationAssetRepository(),
      getRiskRepository(),
      getTaskRepository(),
      getIsoControlRepository(),
      getAuditPlanRepository(),
      getAuthProvider()
    ])

    return new Container(
      orgRepo,
      userRepo,
      auditRepo,
      docRepo,
      assetRepo,
      riskRepo,
      taskRepo,
      isoRepo,
      auditPlanRepo,
      auth
    )
  }

  getOrganizationRepository(): IOrganizationRepository {
    return this._organizationRepository
  }

  getUserRepository(): IUserRepository {
    return this._userRepository
  }

  getAuditLogRepository(): IAuditLogRepository {
    return this._auditLogRepository
  }

  getDocumentRepository(): IDocumentRepository {
    return this._documentRepository
  }

  getInformationAssetRepository(): IInformationAssetRepository {
    return this._informationAssetRepository
  }

  getRiskRepository(): IRiskRepository {
    return this._riskRepository
  }

  getTaskRepository(): ITaskRepository {
    return this._taskRepository
  }

  getIsoControlRepository(): IIsoControlRepository {
    return this._isoControlRepository
  }

  getAuditPlanRepository(): IAuditPlanRepository {
    return this._auditPlanRepository
  }

  getAuthProvider(): IAuthProvider {
    return this._authProvider
  }
}
