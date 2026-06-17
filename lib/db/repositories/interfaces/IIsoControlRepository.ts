/**
 * ISO Control Repository Interface
 *
 * Handles all ISO 27001 control-related data operations including:
 * - ISO Controls CRUD
 * - Control Templates
 * - Risk-Control Links
 */

import type { Database } from '@/types/database.types'
import type { IOrganizationScopedRepository, QueryOptions } from './IBaseRepository'

// Database types
type IsoControl = Database['public']['Tables']['iso_controls']['Row']
type IsoControlInsert = Database['public']['Tables']['iso_controls']['Insert']
type IsoControlUpdate = Database['public']['Tables']['iso_controls']['Update']
type ControlTemplate = Database['public']['Tables']['control_templates']['Row']
type RiskControlLink = Database['public']['Tables']['risk_control_links']['Row']

// Re-export for convenience
export type {
  IsoControl,
  IsoControlInsert,
  IsoControlUpdate,
  ControlTemplate,
  RiskControlLink
}

/**
 * Search filters for ISO controls
 */
export interface IsoControlSearchFilters {
  keyword?: string
  category?: string
}

/**
 * Payload for creating ISO control
 */
export type IsoControlCreatePayload = Omit<IsoControlInsert, 'id' | 'created_at' | 'updated_at'>

/**
 * ISO Control Repository Interface
 *
 * Provides data access methods for ISO 27001 controls, templates, and risk-control links.
 * Implementations should handle data operations for libSQL/Turso backends.
 */
export interface IIsoControlRepository extends IOrganizationScopedRepository<IsoControl, IsoControlInsert, IsoControlUpdate> {
  // Search operations
  /**
   * Search ISO controls with optional keyword and category filters
   */
  search(organizationId: string, filters?: IsoControlSearchFilters, options?: QueryOptions): Promise<IsoControl[]>

  /**
   * Get unique categories for an organization
   */
  getCategories(organizationId: string): Promise<string[]>

  // Template operations
  /**
   * Get control templates for a specific locale
   */
  getTemplates(locale: string): Promise<ControlTemplate[]>

  // Risk-Control Link operations
  /**
   * Get controls linked to a specific risk treatment
   */
  getControlsForTreatment(treatmentId: string): Promise<IsoControl[]>

  /**
   * Link a control to a risk treatment
   */
  linkControlToTreatment(treatmentId: string, controlId: string): Promise<RiskControlLink>

  /**
   * Unlink a control from a risk treatment
   */
  unlinkControlFromTreatment(treatmentId: string, controlId: string): Promise<void>

  /**
   * Set all controls for a risk treatment (sync operation)
   * Adds new links, removes old links, and keeps existing ones
   */
  setTreatmentControls(treatmentId: string, controlIds: string[]): Promise<void>
}
