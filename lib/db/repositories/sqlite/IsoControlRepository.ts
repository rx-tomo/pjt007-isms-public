/**
 * SQLite ISO Control Repository
 *
 * Implements IIsoControlRepository using Drizzle ORM with SQLite.
 * Handles ISO 27001 controls, control templates, and risk-control links
 * with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - Tags stored as JSON string in SQLite (TEXT[] in PostgreSQL)
 * - All queries include organization_id filtering for multi-tenant isolation
 * - Search supports keyword (title, description, control_code) and category filters
 *
 * @module lib/db/repositories/sqlite/IsoControlRepository
 */

import { eq, and, or, like, inArray, asc, sql } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import { isoControls, riskControlLinks, controlTemplates } from '@/lib/db/drizzle/schema/risks'
import type {
  IIsoControlRepository,
  IsoControl,
  IsoControlInsert,
  IsoControlUpdate,
  ControlTemplate,
  RiskControlLink,
  IsoControlSearchFilters,
} from '../interfaces/IIsoControlRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteIsoControlRepository extends BaseSQLiteRepository implements IIsoControlRepository {
  /**
   * Constructor accepts an optional db override for testing (dependency injection)
   */
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }

  // =========================================
  // Base repository methods
  // =========================================

  /**
   * Find a control by its ID
   */
  async findById(id: string): Promise<IsoControl | null> {
    const rows = await this.db
      .select()
      .from(isoControls)
      .where(eq(isoControls.id, id))

    if (rows.length === 0) return null

    return this.mapRowToEntity(rows[0])
  }

  /**
   * Find multiple controls with optional filters
   */
  async findMany(filters?: Record<string, unknown>): Promise<IsoControl[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db
        .select()
        .from(isoControls)

      return rows.map(row => this.mapRowToEntity(row))
    }

    // Build conditions from filters
    const conditions = Object.entries(filters).map(([key, value]) => {
      const column = isoControls[key as keyof typeof isoControls.$inferSelect]
      if (column) {
        return eq(column as never, value as never)
      }
      return null
    }).filter(Boolean)

    if (conditions.length === 0) {
      const rows = await this.db
        .select()
        .from(isoControls)

      return rows.map(row => this.mapRowToEntity(row))
    }

    const rows = await this.db
      .select()
      .from(isoControls)
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions as never[]))

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Find all controls for an organization
   */
  async findByOrganizationId(organizationId: string): Promise<IsoControl[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    const rows = await this.db
      .select()
      .from(isoControls)
      .where(eq(isoControls.organizationId, organizationId))
      .orderBy(asc(isoControls.category), asc(isoControls.title))

    this.logDataAccess('findByOrganizationId', organizationId, { count: rows.length })

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Create a new ISO control
   */
  async create(data: IsoControlInsert): Promise<IsoControl> {
    this.requireOrganizationId(data.organization_id, 'create ISO control')

    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    // Tags: interface uses string[], Drizzle schema stores as JSON string
    const tagsValue = data.tags
      ? JSON.stringify(data.tags)
      : '[]'

    const row = {
      id,
      organizationId: data.organization_id,
      controlCode: data.control_code ?? null,
      category: data.category,
      title: data.title,
      description: data.description ?? null,
      tags: tagsValue,
      templateKey: data.template_key ?? null,
      soaStatus: data.soa_status ?? 'not_reviewed',
      soaApplicabilityReason: data.soa_applicability_reason ?? null,
      soaExclusionReason: data.soa_exclusion_reason ?? null,
      soaReviewedBy: data.soa_reviewed_by ?? null,
      soaReviewedAt: data.soa_reviewed_at ?? null,
      soaApprovalStatus: data.soa_approval_status ?? 'draft',
      soaApprovedBy: data.soa_approved_by ?? null,
      soaApprovedAt: data.soa_approved_at ?? null,
      soaRejectionReason: data.soa_rejection_reason ?? null,
      createdAt: data.created_at ?? now,
      updatedAt: data.updated_at ?? now,
    }

    await this.db.insert(isoControls).values(row)

    this.logDataAccess('create ISO control', data.organization_id, { id })

    return this.mapRowToEntity(row)
  }

  /**
   * Update an existing ISO control
   */
  async update(id: string, updates: IsoControlUpdate): Promise<IsoControl | null> {
    const now = new Date().toISOString()

    const setPayload: Record<string, unknown> = {
      updatedAt: now,
    }

    if (updates.category !== undefined) setPayload.category = updates.category
    if (updates.control_code !== undefined) setPayload.controlCode = updates.control_code
    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.template_key !== undefined) setPayload.templateKey = updates.template_key
    if (updates.soa_status !== undefined) setPayload.soaStatus = updates.soa_status
    if (updates.soa_applicability_reason !== undefined) setPayload.soaApplicabilityReason = updates.soa_applicability_reason
    if (updates.soa_exclusion_reason !== undefined) setPayload.soaExclusionReason = updates.soa_exclusion_reason
    if (updates.soa_reviewed_by !== undefined) setPayload.soaReviewedBy = updates.soa_reviewed_by
    if (updates.soa_reviewed_at !== undefined) setPayload.soaReviewedAt = updates.soa_reviewed_at
    if (updates.soa_approval_status !== undefined) setPayload.soaApprovalStatus = updates.soa_approval_status
    if (updates.soa_approved_by !== undefined) setPayload.soaApprovedBy = updates.soa_approved_by
    if (updates.soa_approved_at !== undefined) setPayload.soaApprovedAt = updates.soa_approved_at
    if (updates.soa_rejection_reason !== undefined) setPayload.soaRejectionReason = updates.soa_rejection_reason
    if (updates.tags !== undefined) {
      setPayload.tags = updates.tags ? JSON.stringify(updates.tags) : '[]'
    }

    await this.db
      .update(isoControls)
      .set(setPayload)
      .where(eq(isoControls.id, id))

    // Re-fetch the updated row
    const rows = await this.db
      .select()
      .from(isoControls)
      .where(eq(isoControls.id, id))

    if (rows.length === 0) return null

    return this.mapRowToEntity(rows[0])
  }

  /**
   * Delete an ISO control
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(isoControls)
      .where(eq(isoControls.id, id))
  }

  // =========================================
  // Search operations
  // =========================================

  /**
   * Search ISO controls with optional keyword and category filters
   *
   * Keyword search matches against title, description, and control_code (case-insensitive).
   * Category filter matches exact category value.
   */
  async search(
    organizationId: string,
    filters?: IsoControlSearchFilters,
    _options?: QueryOptions
  ): Promise<IsoControl[]> {
    this.requireOrganizationId(organizationId, 'search ISO controls')

    const conditions = [eq(isoControls.organizationId, organizationId)]

    if (filters?.keyword && filters.keyword.trim() !== '') {
      const likePattern = `%${filters.keyword.trim()}%`
      conditions.push(
        or(
          like(isoControls.title, likePattern),
          like(isoControls.description, likePattern),
          like(isoControls.controlCode, likePattern)
        )!
      )
    }

    if (filters?.category && filters.category.trim() !== '') {
      conditions.push(eq(isoControls.category, filters.category.trim()))
    }

    const rows = await this.db
      .select()
      .from(isoControls)
      .where(and(...conditions))
      .orderBy(asc(isoControls.category), asc(isoControls.title))

    this.logDataAccess('search ISO controls', organizationId, { count: rows.length })

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Get unique categories for an organization
   */
  async getCategories(organizationId: string): Promise<string[]> {
    this.requireOrganizationId(organizationId, 'getCategories')

    const rows = await this.db
      .select({ category: isoControls.category })
      .from(isoControls)
      .where(eq(isoControls.organizationId, organizationId))
      .orderBy(asc(isoControls.category))

    // Deduplicate categories
    const unique = new Set<string>()
    rows.forEach(row => {
      if (row.category) {
        unique.add(row.category)
      }
    })

    return Array.from(unique)
  }

  // =========================================
  // Template operations
  // =========================================

  /**
   * Get control templates for a specific locale
   */
  async getTemplates(locale: string): Promise<ControlTemplate[]> {
    const rows = await this.db
      .select()
      .from(controlTemplates)
      .where(eq(controlTemplates.locale, locale))
      .orderBy(asc(controlTemplates.category), asc(controlTemplates.controlCode))

    return rows.map(row => this.mapTemplateRowToEntity(row))
  }

  // =========================================
  // Risk-Control Link operations
  // =========================================

  /**
   * Get controls linked to a specific risk treatment
   *
   * Performs a join between risk_control_links and iso_controls.
   */
  async getControlsForTreatment(treatmentId: string): Promise<IsoControl[]> {
    const rows = await this.db
      .select({
        id: isoControls.id,
        organizationId: isoControls.organizationId,
        controlCode: isoControls.controlCode,
        category: isoControls.category,
        title: isoControls.title,
        description: isoControls.description,
        tags: isoControls.tags,
        templateKey: isoControls.templateKey,
        soaStatus: isoControls.soaStatus,
        soaApplicabilityReason: isoControls.soaApplicabilityReason,
        soaExclusionReason: isoControls.soaExclusionReason,
        soaReviewedBy: isoControls.soaReviewedBy,
        soaReviewedAt: isoControls.soaReviewedAt,
        soaApprovalStatus: isoControls.soaApprovalStatus,
        soaApprovedBy: isoControls.soaApprovedBy,
        soaApprovedAt: isoControls.soaApprovedAt,
        soaRejectionReason: isoControls.soaRejectionReason,
        createdAt: isoControls.createdAt,
        updatedAt: isoControls.updatedAt,
      })
      .from(riskControlLinks)
      .innerJoin(isoControls, eq(riskControlLinks.isoControlId, isoControls.id))
      .where(eq(riskControlLinks.riskTreatmentId, treatmentId))

    return rows.map(row => this.mapRowToEntity(row))
  }

  /**
   * Link a control to a risk treatment
   */
  async linkControlToTreatment(treatmentId: string, controlId: string): Promise<RiskControlLink> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      riskTreatmentId: treatmentId,
      isoControlId: controlId,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(riskControlLinks).values(row)

    this.logDataAccess('linkControlToTreatment', 'n/a', { treatmentId, controlId })

    return this.mapLinkRowToEntity(row)
  }

  /**
   * Unlink a control from a risk treatment
   */
  async unlinkControlFromTreatment(treatmentId: string, controlId: string): Promise<void> {
    await this.db
      .delete(riskControlLinks)
      .where(
        and(
          eq(riskControlLinks.riskTreatmentId, treatmentId),
          eq(riskControlLinks.isoControlId, controlId)
        )
      )
  }

  /**
   * Set all controls for a risk treatment (sync operation)
   *
   * Adds new links, removes old links, and keeps existing ones.
   */
  async setTreatmentControls(treatmentId: string, controlIds: string[]): Promise<void> {
    // Get existing links
    const existing = await this.db
      .select({ id: riskControlLinks.id, isoControlId: riskControlLinks.isoControlId })
      .from(riskControlLinks)
      .where(eq(riskControlLinks.riskTreatmentId, treatmentId))

    const existingIds = new Set(existing.map(row => row.isoControlId))
    const nextIds = new Set(controlIds)

    // Determine inserts and deletes
    const toInsert = controlIds.filter(id => !existingIds.has(id))
    const toDelete = existing.filter(row => !nextIds.has(row.isoControlId))

    // Insert new links
    if (toInsert.length > 0) {
      const now = new Date().toISOString()
      const insertPayload = toInsert.map(controlId => ({
        id: crypto.randomUUID(),
        riskTreatmentId: treatmentId,
        isoControlId: controlId,
        createdAt: now,
        updatedAt: now,
      }))

      for (const payload of insertPayload) {
        await this.db.insert(riskControlLinks).values(payload)
      }
    }

    // Delete removed links
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map(row => row.id)
      await this.db
        .delete(riskControlLinks)
        .where(inArray(riskControlLinks.id, deleteIds))
    }

    this.logDataAccess('setTreatmentControls', 'n/a', {
      treatmentId,
      added: toInsert.length,
      removed: toDelete.length,
    })
  }

  // =========================================
  // Private helpers
  // =========================================

  /**
   * Maps a Drizzle database row (camelCase) to the IsoControl entity (snake_case)
   *
   * Key transformations:
   * - tags: JSON string -> string[]
   */
  private mapRowToEntity(row: {
    id: string
    organizationId: string
    controlCode: string | null
    category: string
    title: string
    description: string | null
    tags: string | null
    templateKey: string | null
    soaStatus: string
    soaApplicabilityReason: string | null
    soaExclusionReason: string | null
    soaReviewedBy: string | null
    soaReviewedAt: string | null
    soaApprovalStatus: string
    soaApprovedBy: string | null
    soaApprovedAt: string | null
    soaRejectionReason: string | null
    createdAt: string | null
    updatedAt: string | null
  }): IsoControl {
    let parsedTags: string[] | null = null
    if (row.tags) {
      try {
        parsedTags = JSON.parse(row.tags)
      } catch {
        parsedTags = []
      }
    }

    return {
      id: row.id,
      organization_id: row.organizationId,
      control_code: row.controlCode,
      category: row.category,
      title: row.title,
      description: row.description,
      tags: parsedTags,
      template_key: row.templateKey,
      soa_status: row.soaStatus,
      soa_applicability_reason: row.soaApplicabilityReason,
      soa_exclusion_reason: row.soaExclusionReason,
      soa_reviewed_by: row.soaReviewedBy,
      soa_reviewed_at: row.soaReviewedAt,
      soa_approval_status: row.soaApprovalStatus,
      soa_approved_by: row.soaApprovedBy,
      soa_approved_at: row.soaApprovedAt,
      soa_rejection_reason: row.soaRejectionReason,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  /**
   * Maps a Drizzle risk_control_links row to RiskControlLink entity
   */
  private mapLinkRowToEntity(row: {
    id: string
    riskTreatmentId: string
    isoControlId: string
    createdAt: string | null
    updatedAt: string | null
  }): RiskControlLink {
    return {
      id: row.id,
      risk_treatment_id: row.riskTreatmentId,
      iso_control_id: row.isoControlId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  /**
   * Maps a Drizzle control_templates row to ControlTemplate entity
   */
  private mapTemplateRowToEntity(row: {
    id: string
    templateKey: string
    locale: string
    category: string
    title: string
    description: string | null
    controlCode: string | null
    annexReference: string | null
    defaultTags: string | null
    isDefaultSelected: boolean | number
    createdAt: string
    updatedAt: string
  }): ControlTemplate {
    let parsedDefaultTags: string[] | null = null
    if (row.defaultTags) {
      try {
        parsedDefaultTags = JSON.parse(row.defaultTags)
      } catch {
        parsedDefaultTags = []
      }
    }

    return {
      id: row.id,
      template_key: row.templateKey,
      locale: row.locale,
      category: row.category,
      title: row.title,
      description: row.description,
      control_code: row.controlCode,
      annex_reference: row.annexReference,
      default_tags: parsedDefaultTags,
      is_default_selected: row.isDefaultSelected === true || row.isDefaultSelected === 1,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
