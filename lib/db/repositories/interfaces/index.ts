/**
 * Repository Interfaces
 *
 * This module exports all repository interfaces used for data access abstraction.
 * These interfaces allow switching between different data backends (libSQL/Turso)
 * without changing the service layer.
 */

export * from './IBaseRepository'
export * from './IOrganizationRepository'
export * from './IUserRepository'
export * from './IAuditLogRepository'
export * from './IDocumentRepository'
export * from './IInformationAssetRepository'
export * from './IRiskRepository'
export * from './ITaskRepository'
export * from './IAuditPlanRepository'
export * from './IIsoControlRepository'
export * from './IAISuggestionRepository'
export * from './IAIUsageLogRepository'
