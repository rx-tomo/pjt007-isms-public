/**
 * SQLite Risk Repository
 *
 * Implements IRiskRepository using Drizzle ORM with SQLite.
 * Handles all risk-related data operations with organization-scoped data isolation.
 *
 * Key implementation details:
 * - Uses crypto.randomUUID() for unique ID generation
 * - All queries include organization_id filtering for multi-tenant isolation
 * - risk_score computed at app layer: impact_level * likelihood_level
 * - assessment_period computed at app layer from identified_date (YYYY-MM format)
 * - Supports pagination via limit/offset
 * - Relations loaded via explicit JOINs (no nested select)
 *
 * @module lib/db/repositories/sqlite/RiskRepository
 */

import { eq, and, or, asc, desc, isNull, inArray } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  risks,
  riskCategories,
  riskCriteria,
  riskTreatments,
  riskAssessmentHistory,
  riskAssets,
  riskControlLinks,
  isoControls,
  informationAssets,
} from '@/lib/db/drizzle/schema/risks'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import type {
  IRiskRepository,
  Risk,
  RiskRepositoryInsert,
  RiskRepositoryUpdate,
  RiskCategory,
  RiskTreatment,
  RiskCriteria,
  RiskWithRelations,
  RiskTreatmentWithControls,
  RiskMatrixData,
  RiskMatrixEntry,
  RiskStats,
  RiskFilters,
} from '../interfaces/IRiskRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { RiskAssetWithDetails } from '@/lib/services/informationAsset'
import type { DrizzleDb } from '@/lib/db/drizzle/client'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'

export class SQLiteRiskRepository extends BaseSQLiteRepository implements IRiskRepository {
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
  // Helper: compute risk_score from impact_level * likelihood_level
  // =========================================

  private computeRiskScore(impactLevel: number | null | undefined, likelihoodLevel: number | null | undefined): number | null {
    if (impactLevel != null && likelihoodLevel != null) {
      return impactLevel * likelihoodLevel
    }
    return null
  }

  // =========================================
  // Helper: compute assessment_period from identified_date (YYYY-MM)
  // =========================================

  private computeAssessmentPeriod(identifiedDate: string | null | undefined): string | null {
    if (!identifiedDate) return null
    // Extract YYYY-MM from an ISO date string or YYYY-MM-DD
    const match = identifiedDate.match(/^(\d{4}-\d{2})/)
    return match ? match[1] : null
  }

  // =========================================
  // Base repository methods
  // =========================================

  /**
   * Find a risk by its ID (without relations)
   */
  async findById(id: string): Promise<Risk | null> {
    const rows = await this.db
      .select()
      .from(risks)
      .where(eq(risks.id, id))

    if (rows.length === 0) return null

    return this.mapRiskRowToEntity(rows[0])
  }

  /**
   * Find a risk by ID with all relations (category, treatments, owner, assets)
   */
  async findByIdWithRelations(id: string): Promise<RiskWithRelations | null> {
    // 1. Fetch the risk itself
    const riskRows = await this.db
      .select()
      .from(risks)
      .where(eq(risks.id, id))

    if (riskRows.length === 0) return null

    const risk = this.mapRiskRowToEntity(riskRows[0])

    // 2. Fetch category
    let category: RiskCategory | null = null
    if (riskRows[0].categoryId) {
      const catRows = await this.db
        .select()
        .from(riskCategories)
        .where(eq(riskCategories.id, riskRows[0].categoryId))

      if (catRows.length > 0) {
        category = this.mapCategoryRowToEntity(catRows[0])
      }
    }

    // 3. Fetch owner
    let owner = null
    if (riskRows[0].ownerId) {
      const ownerRows = await this.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, riskRows[0].ownerId))

      if (ownerRows.length > 0) {
        owner = this.mapUserProfileRowToEntity(ownerRows[0])
      }
    }

    // 4. Fetch treatments with control links
    const treatments = await this.loadTreatmentsWithControls(id)

    // 5. Fetch assets
    const assets = await this.getRiskAssets(id)

    return {
      ...risk,
      category,
      treatments,
      owner,
      assets,
    }
  }

  /**
   * Find multiple risks with optional filters
   */
  async findMany(filters?: Record<string, unknown>): Promise<Risk[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db
        .select()
        .from(risks)

      return rows.map(row => this.mapRiskRowToEntity(row))
    }

    const conditions = Object.entries(filters).map(([key, value]) => {
      const column = risks[key as keyof typeof risks.$inferSelect]
      if (column) {
        return eq(column as never, value as never)
      }
      return null
    }).filter(Boolean)

    if (conditions.length === 0) {
      const rows = await this.db
        .select()
        .from(risks)

      return rows.map(row => this.mapRiskRowToEntity(row))
    }

    const rows = await this.db
      .select()
      .from(risks)
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions as never[]))

    return rows.map(row => this.mapRiskRowToEntity(row))
  }

  /**
   * Find risks by organization ID with filters and relations
   */
  async findByOrganizationId(
    organizationId: string,
    filters?: RiskFilters,
    _options?: QueryOptions
  ): Promise<RiskWithRelations[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    // Build conditions
    const conditions = [eq(risks.organizationId, organizationId)]

    if (filters?.status) {
      conditions.push(eq(risks.status, filters.status))
    }

    if (filters?.assessmentPeriod) {
      conditions.push(eq(risks.assessmentPeriod, filters.assessmentPeriod))
    }

    // Department filter (temporary inference via owner's primaryDepartmentId; BL-022)
    const departmentIds = filters?.departmentIds !== undefined
      ? [...new Set(filters.departmentIds)]
      : typeof filters?.departmentId === 'string' && filters.departmentId !== DEPARTMENT_UNASSIGNED_VALUE
        ? [filters.departmentId]
        : []
    const includeNoDepartment = filters?.includeNoDepartment === true
      || filters?.departmentId === null
      || filters?.departmentId === DEPARTMENT_UNASSIGNED_VALUE
    const needsDepartmentJoin = filters?.departmentIds !== undefined
      || filters?.departmentId !== undefined
      || filters?.includeNoDepartment === true

    if (needsDepartmentJoin && departmentIds.length === 0 && !includeNoDepartment) {
      return []
    }

    if (needsDepartmentJoin) {
      if (departmentIds.length > 0 && includeNoDepartment) {
        conditions.push(
          or(
            inArray(userProfiles.primaryDepartmentId, departmentIds),
            isNull(userProfiles.primaryDepartmentId)
          ) as never
        )
      } else if (departmentIds.length > 0) {
        conditions.push(inArray(userProfiles.primaryDepartmentId, departmentIds) as never)
      } else {
        conditions.push(isNull(userProfiles.primaryDepartmentId) as never)
      }
    }

    const baseRiskQuery = this.db
      .select({
        id: risks.id,
        organizationId: risks.organizationId,
        categoryId: risks.categoryId,
        title: risks.title,
        description: risks.description,
        impactLevel: risks.impactLevel,
        likelihoodLevel: risks.likelihoodLevel,
        riskScore: risks.riskScore,
        status: risks.status,
        identifiedDate: risks.identifiedDate,
        identifiedBy: risks.identifiedBy,
        ownerId: risks.ownerId,
        assessmentPeriod: risks.assessmentPeriod,
        createdAt: risks.createdAt,
        updatedAt: risks.updatedAt,
      })
      .from(risks)

    // Conditionally add userProfiles JOIN for department filtering
    const queryWithJoins = needsDepartmentJoin
      ? baseRiskQuery.leftJoin(
          userProfiles,
          and(
            eq(risks.ownerId, userProfiles.id),
            eq(userProfiles.organizationId, organizationId)
          )
        )
      : baseRiskQuery

    const rows = await queryWithJoins
      .where(and(...conditions))
      .orderBy(desc(risks.riskScore))

    this.logDataAccess('findByOrganizationId', organizationId, { count: rows.length })

    // Load relations for each risk
    const results: RiskWithRelations[] = []

    for (const row of rows) {
      const risk = this.mapRiskRowToEntity(row)

      // Category
      let category: RiskCategory | null = null
      if (row.categoryId) {
        const catRows = await this.db
          .select()
          .from(riskCategories)
          .where(eq(riskCategories.id, row.categoryId))

        if (catRows.length > 0) {
          category = this.mapCategoryRowToEntity(catRows[0])
        }
      }

      // Owner
      let owner = null
      if (row.ownerId) {
        const ownerRows = await this.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, row.ownerId))

        if (ownerRows.length > 0) {
          owner = this.mapUserProfileRowToEntity(ownerRows[0])
        }
      }

      // Treatments with controls
      const treatments = await this.loadTreatmentsWithControls(row.id)

      // Assets
      const assets = await this.getRiskAssets(row.id)

      results.push({
        ...risk,
        category,
        treatments,
        owner,
        assets,
      })
    }

    return results
  }

  /**
   * Create a new risk
   */
  async create(data: RiskRepositoryInsert): Promise<Risk> {
    if ('owner_id' in data) {
      throw new Error('Risk owner assignment must use RiskTenantLifecycleService')
    }
    this.requireOrganizationId(data.organization_id, 'create risk')

    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const riskScore = this.computeRiskScore(data.impact_level, data.likelihood_level)
    const assessmentPeriod = this.computeAssessmentPeriod(data.identified_date)

    const row = {
      id,
      organizationId: data.organization_id,
      categoryId: data.category_id ?? null,
      title: data.title,
      description: data.description ?? null,
      impactLevel: data.impact_level ?? null,
      likelihoodLevel: data.likelihood_level ?? null,
      riskScore,
      status: data.status ?? 'identified',
      identifiedDate: data.identified_date ?? null,
      identifiedBy: data.identified_by ?? null,
      ownerId: null,
      assessmentPeriod,
      createdAt: data.created_at ?? now,
      updatedAt: data.updated_at ?? now,
    }

    await this.db.insert(risks).values(row)

    this.logDataAccess('create risk', data.organization_id, { id })

    return this.mapRiskRowToEntity(row)
  }

  /**
   * Update an existing risk
   */
  async update(id: string, updates: RiskRepositoryUpdate): Promise<Risk | null> {
    if ('owner_id' in updates) {
      throw new Error('Risk owner changes must use RiskTenantLifecycleService')
    }
    const now = new Date().toISOString()

    // We need to fetch current data to compute risk_score if only one of impact/likelihood is updated
    let currentRow = null
    if (updates.impact_level !== undefined || updates.likelihood_level !== undefined) {
      const currentRows = await this.db
        .select()
        .from(risks)
        .where(eq(risks.id, id))

      if (currentRows.length > 0) {
        currentRow = currentRows[0]
      }
    }

    const setPayload: Record<string, unknown> = {
      updatedAt: now,
    }

    if (updates.category_id !== undefined) setPayload.categoryId = updates.category_id
    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.impact_level !== undefined) setPayload.impactLevel = updates.impact_level
    if (updates.likelihood_level !== undefined) setPayload.likelihoodLevel = updates.likelihood_level
    if (updates.status !== undefined) setPayload.status = updates.status
    if (updates.identified_date !== undefined) {
      setPayload.identifiedDate = updates.identified_date
      setPayload.assessmentPeriod = this.computeAssessmentPeriod(updates.identified_date)
    }
    if (updates.identified_by !== undefined) setPayload.identifiedBy = updates.identified_by

    // Compute risk_score
    if (updates.impact_level !== undefined || updates.likelihood_level !== undefined) {
      const impact = updates.impact_level !== undefined ? updates.impact_level : currentRow?.impactLevel
      const likelihood = updates.likelihood_level !== undefined ? updates.likelihood_level : currentRow?.likelihoodLevel
      setPayload.riskScore = this.computeRiskScore(impact, likelihood)
    }

    await this.db
      .update(risks)
      .set(setPayload)
      .where(eq(risks.id, id))

    // Re-fetch the updated row
    const rows = await this.db
      .select()
      .from(risks)
      .where(eq(risks.id, id))

    if (rows.length === 0) return null

    return this.mapRiskRowToEntity(rows[0])
  }

  /**
   * Delete a risk
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(risks)
      .where(eq(risks.id, id))
  }

  // =========================================
  // Risk Asset operations
  // =========================================

  /**
   * Get assets linked to a specific risk
   */
  async getRiskAssets(riskId: string): Promise<RiskAssetWithDetails[]> {
    const rows = await this.db
      .select({
        id: riskAssets.id,
        risk_id: riskAssets.riskId,
        asset_id: riskAssets.assetId,
        created_at: riskAssets.createdAt,
        // asset details
        asset_full_id: informationAssets.id,
        asset_organization_id: informationAssets.organizationId,
        asset_name: informationAssets.name,
        asset_type: informationAssets.assetType,
        asset_classification: informationAssets.classification,
        asset_criticality: informationAssets.criticality,
        asset_owner_id: informationAssets.ownerId,
        asset_location: informationAssets.location,
        asset_status: informationAssets.status,
        asset_description: informationAssets.description,
        asset_created_at: informationAssets.createdAt,
        asset_updated_at: informationAssets.updatedAt,
      })
      .from(riskAssets)
      .leftJoin(informationAssets, eq(riskAssets.assetId, informationAssets.id))
      .where(eq(riskAssets.riskId, riskId))
      .orderBy(asc(riskAssets.createdAt))

    return rows.map(row => ({
      id: row.id,
      risk_id: row.risk_id,
      asset_id: row.asset_id,
      created_at: row.created_at,
      asset: row.asset_full_id
        ? {
            id: row.asset_full_id,
            organization_id: row.asset_organization_id!,
            name: row.asset_name!,
            asset_type: row.asset_type,
            classification: row.asset_classification,
            criticality: row.asset_criticality,
            owner_id: row.asset_owner_id,
            location: row.asset_location,
            status: row.asset_status,
            description: row.asset_description,
            created_at: row.asset_created_at,
            updated_at: row.asset_updated_at,
          }
        : null,
    }))
  }

  /**
   * Set risk assets (replace all existing)
   */
  async setRiskAssets(riskId: string, assetIds: string[]): Promise<void> {
    // Delete all existing
    await this.db
      .delete(riskAssets)
      .where(eq(riskAssets.riskId, riskId))

    if (assetIds.length === 0) return

    // Insert new
    const now = new Date().toISOString()
    for (const assetId of assetIds) {
      await this.db.insert(riskAssets).values({
        id: crypto.randomUUID(),
        riskId,
        assetId,
        createdAt: now,
      })
    }

    this.logDataAccess('setRiskAssets', 'n/a', { riskId, count: assetIds.length })
  }

  // =========================================
  // Category operations
  // =========================================

  /**
   * Get risk categories for an organization
   */
  async getCategories(organizationId: string, _options?: QueryOptions): Promise<RiskCategory[]> {
    this.requireOrganizationId(organizationId, 'getCategories')

    const rows = await this.db
      .select()
      .from(riskCategories)
      .where(eq(riskCategories.organizationId, organizationId))
      .orderBy(asc(riskCategories.displayOrder))

    this.logDataAccess('getCategories', organizationId, { count: rows.length })

    return rows.map(row => this.mapCategoryRowToEntity(row))
  }

  /**
   * Create a risk category
   */
  async createCategory(
    organizationId: string,
    payload: {
      name: string
      description?: string | null
      color?: string | null
      display_order?: number | null
    }
  ): Promise<RiskCategory> {
    this.requireOrganizationId(organizationId, 'createCategory')

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId,
      name: payload.name,
      description: payload.description ?? null,
      color: payload.color ?? null,
      displayOrder: payload.display_order ?? 0,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(riskCategories).values(row)

    this.logDataAccess('createCategory', organizationId, { id })

    return this.mapCategoryRowToEntity(row)
  }

  /**
   * Update a risk category
   */
  async updateCategory(
    id: string,
    payload: {
      name?: string
      description?: string | null
      color?: string | null
      display_order?: number | null
    }
  ): Promise<RiskCategory> {
    const now = new Date().toISOString()

    const setPayload: Record<string, unknown> = {
      updatedAt: now,
    }

    if (payload.name !== undefined) setPayload.name = payload.name
    if (payload.description !== undefined) setPayload.description = payload.description
    if (payload.color !== undefined) setPayload.color = payload.color
    if (payload.display_order !== undefined) setPayload.displayOrder = payload.display_order

    await this.db
      .update(riskCategories)
      .set(setPayload)
      .where(eq(riskCategories.id, id))

    // Re-fetch
    const rows = await this.db
      .select()
      .from(riskCategories)
      .where(eq(riskCategories.id, id))

    if (rows.length === 0) {
      throw new Error('カテゴリの更新に失敗しました')
    }

    return this.mapCategoryRowToEntity(rows[0])
  }

  /**
   * Delete a risk category
   */
  async deleteCategory(id: string): Promise<void> {
    await this.db
      .delete(riskCategories)
      .where(eq(riskCategories.id, id))
  }

  // =========================================
  // Risk Criteria operations
  // =========================================

  /**
   * Get risk criteria for an organization
   */
  async getCriteria(organizationId: string, _options?: QueryOptions): Promise<RiskCriteria[]> {
    this.requireOrganizationId(organizationId, 'getCriteria')

    const rows = await this.db
      .select()
      .from(riskCriteria)
      .where(eq(riskCriteria.organizationId, organizationId))
      .orderBy(asc(riskCriteria.type), asc(riskCriteria.level))

    this.logDataAccess('getCriteria', organizationId, { count: rows.length })

    return rows.map(row => this.mapCriteriaRowToEntity(row))
  }

  // =========================================
  // Risk Assessment History
  // =========================================

  /**
   * Create an assessment history entry based on the current risk state
   */
  async createAssessmentHistory(
    riskId: string,
    assessedBy: string,
    previous?: {
      impactLevel?: number | null
      likelihoodLevel?: number | null
    }
  ): Promise<void> {
    // Get current risk info
    const riskRows = await this.db
      .select()
      .from(risks)
      .where(eq(risks.id, riskId))

    if (riskRows.length === 0) return

    const risk = riskRows[0]
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await this.db.insert(riskAssessmentHistory).values({
      id,
      riskId,
      assessedBy,
      assessmentDate: now,
      previousImpactLevel: previous?.impactLevel ?? risk.impactLevel,
      newImpactLevel: risk.impactLevel,
      previousLikelihoodLevel: previous?.likelihoodLevel ?? risk.likelihoodLevel,
      newLikelihoodLevel: risk.likelihoodLevel,
      notes: null,
    })

    this.logDataAccess('createAssessmentHistory', 'n/a', { riskId })
  }

  // =========================================
  // Statistics and Matrix
  // =========================================

  /**
   * Get risk matrix data for visualization (5x5 grid)
   */
  async getRiskMatrix(organizationId: string): Promise<RiskMatrixData> {
    this.requireOrganizationId(organizationId, 'getRiskMatrix')

    const rows = await this.db
      .select()
      .from(risks)
      .where(eq(risks.organizationId, organizationId))

    // Create 5x5 matrix
    const matrix: number[][] = Array(5).fill(null).map(() => Array(5).fill(0))

    rows.forEach(row => {
      if (row.impactLevel && row.likelihoodLevel) {
        matrix[row.impactLevel - 1][row.likelihoodLevel - 1]++
      }
    })

    const riskEntries: RiskMatrixEntry[] = rows.map(row => ({
      id: row.id,
      title: row.title,
      impact: row.impactLevel ?? null,
      likelihood: row.likelihoodLevel ?? null,
      score: row.riskScore ?? null,
    }))

    this.logDataAccess('getRiskMatrix', organizationId, { count: rows.length })

    return {
      matrix,
      risks: riskEntries,
    }
  }

  /**
   * Get risk statistics for an organization
   */
  async getRiskStats(organizationId: string): Promise<RiskStats | null> {
    this.requireOrganizationId(organizationId, 'getRiskStats')

    const rows = await this.db
      .select({
        status: risks.status,
        riskScore: risks.riskScore,
      })
      .from(risks)
      .where(eq(risks.organizationId, organizationId))

    if (rows.length === 0) return null

    const stats: RiskStats = {
      total: rows.length,
      byStatus: {} as Record<string, number>,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
      averageScore: 0,
    }

    let totalScore = 0

    rows.forEach(row => {
      // Status breakdown
      if (row.status) {
        stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + 1
      }

      // Risk level breakdown
      if (row.riskScore) {
        totalScore += row.riskScore
        if (row.riskScore >= 15) stats.highRisk++
        else if (row.riskScore >= 8) stats.mediumRisk++
        else stats.lowRisk++
      }
    })

    stats.averageScore = rows.length > 0 ? totalScore / rows.length : 0

    this.logDataAccess('getRiskStats', organizationId, { total: stats.total })

    return stats
  }

  // =========================================
  // Private: load treatments with control links
  // =========================================

  private async loadTreatmentsWithControls(riskId: string): Promise<RiskTreatmentWithControls[]> {
    const treatmentRows = await this.db
      .select()
      .from(riskTreatments)
      .where(eq(riskTreatments.riskId, riskId))
      .orderBy(asc(riskTreatments.createdAt))

    const results: RiskTreatmentWithControls[] = []

    for (const tRow of treatmentRows) {
      const treatment = this.mapTreatmentRowToEntity(tRow)

      // Load control links with ISO control details
      const linkRows = await this.db
        .select({
          linkId: riskControlLinks.id,
          linkRiskTreatmentId: riskControlLinks.riskTreatmentId,
          linkIsoControlId: riskControlLinks.isoControlId,
          linkCreatedAt: riskControlLinks.createdAt,
          linkUpdatedAt: riskControlLinks.updatedAt,
          // iso_control details
          controlId: isoControls.id,
          controlOrganizationId: isoControls.organizationId,
          controlCode: isoControls.controlCode,
          controlCategory: isoControls.category,
          controlTitle: isoControls.title,
          controlDescription: isoControls.description,
          controlTags: isoControls.tags,
          controlTemplateKey: isoControls.templateKey,
          controlSoaStatus: isoControls.soaStatus,
          controlSoaApplicabilityReason: isoControls.soaApplicabilityReason,
          controlSoaExclusionReason: isoControls.soaExclusionReason,
          controlSoaReviewedBy: isoControls.soaReviewedBy,
          controlSoaReviewedAt: isoControls.soaReviewedAt,
          controlSoaApprovalStatus: isoControls.soaApprovalStatus,
          controlSoaApprovedBy: isoControls.soaApprovedBy,
          controlSoaApprovedAt: isoControls.soaApprovedAt,
          controlSoaRejectionReason: isoControls.soaRejectionReason,
          controlCreatedAt: isoControls.createdAt,
          controlUpdatedAt: isoControls.updatedAt,
        })
        .from(riskControlLinks)
        .leftJoin(isoControls, eq(riskControlLinks.isoControlId, isoControls.id))
        .where(eq(riskControlLinks.riskTreatmentId, tRow.id))

      const controlLinks = linkRows.map(lr => {
        let parsedTags: string[] | null = null
        if (lr.controlTags) {
          try {
            parsedTags = JSON.parse(lr.controlTags)
          } catch {
            parsedTags = []
          }
        }

        return {
          id: lr.linkId,
          risk_treatment_id: lr.linkRiskTreatmentId,
          iso_control_id: lr.linkIsoControlId,
          created_at: lr.linkCreatedAt,
          updated_at: lr.linkUpdatedAt,
          iso_control: lr.controlId
            ? {
                id: lr.controlId,
                organization_id: lr.controlOrganizationId ?? '',
                control_code: lr.controlCode,
                category: lr.controlCategory ?? '',
                title: lr.controlTitle ?? '',
                description: lr.controlDescription,
                tags: parsedTags,
                template_key: lr.controlTemplateKey,
                soa_status: lr.controlSoaStatus ?? 'not_reviewed',
                soa_applicability_reason: lr.controlSoaApplicabilityReason,
                soa_exclusion_reason: lr.controlSoaExclusionReason,
                soa_reviewed_by: lr.controlSoaReviewedBy,
                soa_reviewed_at: lr.controlSoaReviewedAt,
                soa_approval_status: lr.controlSoaApprovalStatus ?? 'draft',
                soa_approved_by: lr.controlSoaApprovedBy,
                soa_approved_at: lr.controlSoaApprovedAt,
                soa_rejection_reason: lr.controlSoaRejectionReason,
                created_at: lr.controlCreatedAt,
                updated_at: lr.controlUpdatedAt,
              }
            : null,
        }
      })

      results.push({
        ...treatment,
        control_links: controlLinks,
      })
    }

    return results
  }

  // =========================================
  // Private: row-to-entity mappers
  // =========================================

  private mapRiskRowToEntity(row: {
    id: string
    organizationId: string | null
    categoryId: string | null
    title: string
    description: string | null
    impactLevel: number | null
    likelihoodLevel: number | null
    riskScore: number | null
    status: string | null
    identifiedDate: string | null
    identifiedBy: string | null
    ownerId: string | null
    assessmentPeriod: string | null
    createdAt: string | null
    updatedAt: string | null
  }): Risk {
    return {
      id: row.id,
      organization_id: row.organizationId,
      category_id: row.categoryId,
      department_id: null, // Not in Drizzle SQLite schema; always null
      title: row.title,
      description: row.description,
      impact_level: row.impactLevel,
      likelihood_level: row.likelihoodLevel,
      risk_score: row.riskScore,
      status: row.status,
      identified_date: row.identifiedDate,
      identified_by: row.identifiedBy,
      owner_id: row.ownerId,
      assessment_period: row.assessmentPeriod,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapCategoryRowToEntity(row: {
    id: string
    organizationId: string | null
    name: string
    description: string | null
    color: string | null
    displayOrder: number | null
    createdAt: string | null
    updatedAt: string | null
  }): RiskCategory {
    return {
      id: row.id,
      organization_id: row.organizationId,
      name: row.name,
      description: row.description,
      color: row.color,
      display_order: row.displayOrder,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapTreatmentRowToEntity(row: {
    id: string
    riskId: string | null
    treatmentType: string
    description: string
    responsibleId: string | null
    dueDate: string | null
    status: string | null
    residualApprovalStatus?: string | null
    residualApprovedBy?: string | null
    residualApprovedAt?: string | null
    residualRejectionReason?: string | null
    residualReviewDueDate?: string | null
    materialVersion?: number
    costEstimate: number | null
    actualCost: number | null
    effectivenessRating: number | null
    createdAt: string | null
    updatedAt: string | null
  }): RiskTreatment {
    return {
      id: row.id,
      risk_id: row.riskId,
      treatment_type: row.treatmentType,
      description: row.description,
      responsible_id: row.responsibleId,
      due_date: row.dueDate,
      status: row.status,
      residual_approval_status: row.residualApprovalStatus ?? 'draft',
      residual_approved_by: row.residualApprovedBy ?? null,
      residual_approved_at: row.residualApprovedAt ?? null,
      residual_rejection_reason: row.residualRejectionReason ?? null,
      residual_review_due_date: row.residualReviewDueDate ?? null,
      material_version: row.materialVersion ?? 1,
      cost_estimate: row.costEstimate,
      actual_cost: row.actualCost,
      effectiveness_rating: row.effectivenessRating,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    } as RiskTreatment
  }

  private mapCriteriaRowToEntity(row: {
    id: string
    organizationId: string | null
    type: string
    level: number
    label: string
    description: string | null
    createdAt: string | null
  }): RiskCriteria {
    return {
      id: row.id,
      organization_id: row.organizationId,
      type: row.type,
      level: row.level,
      label: row.label,
      description: row.description,
      created_at: row.createdAt,
    }
  }

  /**
   * Maps a Drizzle userProfiles row to the UserProfile entity (snake_case)
   */
  private mapUserProfileRowToEntity(row: {
    id: string
    organizationId: string | null
    email: string
    fullName: string
    fullNameEn: string | null
    role: string
    department: string | null
    position: string | null
    phone: string | null
    isActive: boolean | null
    avatarUrl: string | null
    languagePreference: string | null
    primaryDepartmentId: string | null
    isCiso: boolean | null
    isSecurityManager: boolean | null
    isOrgAdmin: boolean | null
    isAuditCommittee: boolean | null
    isIsmsPromoter: boolean | null
    createdAt: string | null
    updatedAt: string | null
    lastLoginAt: string | null
  }) {
    return {
      id: row.id,
      organization_id: row.organizationId,
      email: row.email,
      full_name: row.fullName,
      full_name_en: row.fullNameEn,
      role: row.role as 'super_admin' | 'system_operator' | 'org_admin' | 'user' | 'auditor' | 'approver',
      department: row.department,
      position: row.position,
      phone: row.phone,
      is_active: row.isActive,
      avatar_url: row.avatarUrl,
      language_preference: row.languagePreference,
      primary_department_id: row.primaryDepartmentId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      last_login_at: row.lastLoginAt,
    }
  }
}
