/**
 * Database Module
 *
 * This is the main entry point for database operations.
 * It provides access to repositories through the DI container.
 *
 * Usage:
 * ```typescript
 * import { getOrganizationRepository, getUserRepository } from '@/lib/db'
 *
 * const orgRepo = await getOrganizationRepository()
 * const org = await orgRepo.findById('org-id')
 * ```
 *
 * Configuration:
 * - DATABASE_MODE: 'sqlite' | 'turso' (default: 'sqlite')
 * - AUTH_MODE: 'mock' | 'betterauth' (default: 'betterauth')
 */

// Re-export container functions
export {
  getOrganizationRepository,
  getUserRepository,
  getAuditLogRepository,
  getAuthProvider,
  getDatabaseMode,
  getAuthMode,
  resetContainer,
  Container
} from '@/lib/container'

// Re-export interfaces
export * from './repositories/interfaces'
