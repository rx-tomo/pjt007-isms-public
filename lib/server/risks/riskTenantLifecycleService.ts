import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  auditLogs,
  informationAssets,
  isoControls,
  organizationDepartments,
  residualAcceptanceApprovalBindings,
  riskAssessmentHistory,
  riskAssets,
  riskCategories,
  riskControlLinks,
  risks,
  riskTreatments,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationContext,
} from '@/lib/server/auth/authorizationContext'
import type {
  RiskFilters,
  RiskStatus,
  RiskWithRelations,
} from '@/lib/db/repositories/interfaces/IRiskRepository'
import type { Database } from '@/types/database.types'
import type { UserRole } from '@/lib/db/drizzle/schema/users'
import {
  ResidualAcceptanceSubmissionError,
  ResidualAcceptanceSubmissionService,
} from '@/lib/server/approvals/residualAcceptanceSubmissionService'

type Db = ReturnType<typeof getDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type QueryDb = Db | Tx
type RiskUpdate = Database['public']['Tables']['risks']['Update']

export type RiskFailureStage =
  | 'after_risk'
  | 'after_assets'
  | 'after_history'
  | 'after_residual_reset'
  | 'after_audit'
export type RiskFailureInjection = (stage: RiskFailureStage, db: QueryDb) => void | Promise<void>

export class RiskTenantLifecycleError extends Error {
  constructor(
    readonly kind: 'malformed' | 'not_found' | 'conflict',
    message = kind
  ) {
    super(message)
    this.name = 'RiskTenantLifecycleError'
  }
}

export interface RiskPatchInput {
  updates: RiskUpdate
  assetIds?: string[]
  expectedUpdatedAt: string
}

export interface RiskCreateInput {
  organizationId: string
  title: string
  description: string | null
  categoryId: string | null
  impactLevel: 1 | 2 | 3 | 4 | 5
  likelihoodLevel: 1 | 2 | 3 | 4 | 5
  ownerId: string | null
  identifiedDate: string | null
  status: RiskStatus
  assetIds: string[]
}

interface CanonicalOwner {
  departmentId: string | null
  owner: RiskWithRelations['owner']
}

function notFound(): never {
  throw new RiskTenantLifecycleError('not_found')
}

function canAccessDepartment(
  access: TenantAuthorizationContext['departmentAccess'],
  departmentId: string | null
): boolean {
  if (access.mode === 'all') return true
  if (departmentId === null) return access.includeUnassigned
  return access.departmentIds.includes(departmentId)
}

function mapRisk(row: typeof risks.$inferSelect): RiskWithRelations {
  return {
    id: row.id,
    organization_id: row.organizationId,
    category_id: row.categoryId,
    department_id: null,
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

function mapCategory(row: typeof riskCategories.$inferSelect) {
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

function mapOwner(row: typeof userProfiles.$inferSelect) {
  return {
    id: row.id,
    organization_id: row.organizationId,
    email: row.email,
    full_name: row.fullName,
    full_name_en: row.fullNameEn,
    role: row.role as UserRole,
    department: row.department,
    position: row.position,
    phone: row.phone,
    is_active: row.isActive,
    avatar_url: row.avatarUrl,
    language_preference: row.languagePreference,
    primary_department_id: row.primaryDepartmentId,
    is_ciso: row.isCiso,
    is_security_manager: row.isSecurityManager,
    is_org_admin: row.isOrgAdmin,
    is_audit_committee: row.isAuditCommittee,
    is_isms_promoter: row.isIsmsPromoter,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    last_login_at: row.lastLoginAt,
  }
}

async function resolveCanonicalOwner(
  db: QueryDb,
  organizationId: string,
  ownerId: string | null
): Promise<CanonicalOwner> {
  if (ownerId === null) return { departmentId: null, owner: null }

  const [row] = await db
    .select({ profile: userProfiles, membershipStatus: userMemberships.status })
    .from(userProfiles)
    .innerJoin(userMemberships, and(
      eq(userMemberships.userId, userProfiles.id),
      eq(userMemberships.organizationId, organizationId),
    ))
    .innerJoin(organizationDepartments, and(
      eq(organizationDepartments.id, userProfiles.primaryDepartmentId),
      eq(organizationDepartments.organizationId, organizationId),
    ))
    .where(and(
      eq(userProfiles.id, ownerId),
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.isActive, true),
      eq(userMemberships.status, 'active'),
    ))
    .limit(1)

  if (!row || !row.profile.primaryDepartmentId) notFound()
  return {
    departmentId: row.profile.primaryDepartmentId,
    owner: mapOwner(row.profile),
  }
}

async function assertCategory(
  db: QueryDb,
  organizationId: string,
  categoryId: string | null
) {
  if (categoryId === null) return null
  const [category] = await db
    .select()
    .from(riskCategories)
    .where(and(
      eq(riskCategories.id, categoryId),
      eq(riskCategories.organizationId, organizationId),
    ))
    .limit(1)
  if (!category) notFound()
  return mapCategory(category)
}

async function assertAssets(
  db: QueryDb,
  organizationId: string,
  assetIds: string[]
) {
  if (assetIds.length === 0) return []
  const rows = await db
    .select()
    .from(informationAssets)
    .where(and(
      inArray(informationAssets.id, assetIds),
      eq(informationAssets.organizationId, organizationId),
    ))
  const byId = new Map(rows.map(row => [row.id, row]))
  if (rows.length !== assetIds.length) notFound()
  return assetIds.map(id => byId.get(id) ?? notFound())
}

async function loadAssets(db: QueryDb, riskId: string, organizationId: string) {
  const links = await db
    .select({ link: riskAssets, asset: informationAssets })
    .from(riskAssets)
    .leftJoin(informationAssets, eq(informationAssets.id, riskAssets.assetId))
    .where(eq(riskAssets.riskId, riskId))
    .orderBy(asc(riskAssets.createdAt))

  if (links.some(({ asset }) => !asset || asset.organizationId !== organizationId)) notFound()

  return links.map(({ link, asset }) => ({
    id: link.id,
    risk_id: link.riskId,
    asset_id: link.assetId,
    created_at: link.createdAt,
    asset: asset ? {
      id: asset.id,
      organization_id: asset.organizationId,
      name: asset.name,
      asset_type: asset.assetType,
      classification: asset.classification,
      criticality: asset.criticality,
      owner_id: asset.ownerId,
      location: asset.location,
      status: asset.status,
      description: asset.description,
      created_at: asset.createdAt,
      updated_at: asset.updatedAt,
    } : null,
  }))
}

async function isValidTreatmentResponsible(
  db: QueryDb,
  organizationId: string,
  userId: string
) {
  const [row] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .innerJoin(userMemberships, and(
      eq(userMemberships.userId, userProfiles.id),
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.status, 'active'),
    ))
    .where(and(
      eq(userProfiles.id, userId),
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.isActive, true),
    ))
    .limit(1)
  return Boolean(row)
}

async function loadTreatments(db: QueryDb, riskId: string, organizationId: string) {
  const rows = await db
    .select()
    .from(riskTreatments)
    .where(eq(riskTreatments.riskId, riskId))
    .orderBy(asc(riskTreatments.createdAt))

  return Promise.all(rows.map(async treatment => {
    const responsibleId = treatment.responsibleId
      && await isValidTreatmentResponsible(db, organizationId, treatment.responsibleId)
      ? treatment.responsibleId
      : null
    const residualApprovedBy = treatment.residualApprovedBy
      && await isValidTreatmentResponsible(db, organizationId, treatment.residualApprovedBy)
      ? treatment.residualApprovedBy
      : null
    const links = await db
      .select({ link: riskControlLinks, control: isoControls })
      .from(riskControlLinks)
      .leftJoin(isoControls, eq(isoControls.id, riskControlLinks.isoControlId))
      .where(eq(riskControlLinks.riskTreatmentId, treatment.id))
    const safeLinks = links.filter(({ control }) => control?.organizationId === organizationId)

    return {
      id: treatment.id,
      risk_id: treatment.riskId,
      treatment_type: treatment.treatmentType,
      description: treatment.description,
      responsible_id: responsibleId,
      due_date: treatment.dueDate,
      status: treatment.status,
      residual_approval_status: treatment.residualApprovalStatus ?? 'draft',
      residual_approved_by: residualApprovedBy,
      residual_approved_at: treatment.residualApprovedAt,
      residual_rejection_reason: treatment.residualRejectionReason,
      residual_review_due_date: treatment.residualReviewDueDate,
      cost_estimate: treatment.costEstimate,
      actual_cost: treatment.actualCost,
      effectiveness_rating: treatment.effectivenessRating,
      created_at: treatment.createdAt,
      updated_at: treatment.updatedAt,
      control_links: safeLinks.map(({ link, control }) => ({
        id: link.id,
        risk_treatment_id: link.riskTreatmentId,
        iso_control_id: link.isoControlId,
        created_at: link.createdAt,
        updated_at: link.updatedAt,
        iso_control: control ? {
          id: control.id,
          organization_id: control.organizationId ?? '',
          control_code: control.controlCode,
          category: control.category ?? '',
          title: control.title ?? '',
          description: control.description,
          tags: (() => {
            try { return control.tags ? JSON.parse(control.tags) : null }
            catch { return [] }
          })(),
          template_key: control.templateKey,
          soa_status: control.soaStatus ?? 'not_reviewed',
          soa_applicability_reason: control.soaApplicabilityReason,
          soa_exclusion_reason: control.soaExclusionReason,
          soa_reviewed_by: control.soaReviewedBy,
          soa_reviewed_at: control.soaReviewedAt,
          soa_approval_status: control.soaApprovalStatus ?? 'draft',
          soa_approved_by: control.soaApprovedBy,
          soa_approved_at: control.soaApprovedAt,
          soa_rejection_reason: control.soaRejectionReason,
          created_at: control.createdAt,
          updated_at: control.updatedAt,
        } : null,
      })),
    }
  }))
}

async function loadCanonicalRisk(
  db: QueryDb,
  riskId: string,
  organizationId: string
): Promise<{ risk: RiskWithRelations; departmentId: string | null }> {
  const [row] = await db
    .select()
    .from(risks)
    .where(and(eq(risks.id, riskId), eq(risks.organizationId, organizationId)))
    .limit(1)
  if (!row) notFound()

  const [{ departmentId, owner }, category, assets, treatments] = await Promise.all([
    resolveCanonicalOwner(db, organizationId, row.ownerId),
    assertCategory(db, organizationId, row.categoryId),
    loadAssets(db, riskId, organizationId),
    loadTreatments(db, riskId, organizationId),
  ])

  return {
    departmentId,
    risk: { ...mapRisk(row), department_id: departmentId, owner, category, assets, treatments },
  }
}

async function freshAuthorization(db: QueryDb, userId: string, organizationId: string) {
  const result = await resolveTenantAuthorizationContext(db as Db, userId, organizationId)
  if (!result.ok) notFound()
  return result.context
}

function computeAssessmentPeriod(date: string | null | undefined) {
  return date?.match(/^(\d{4}-\d{2})/)?.[1] ?? null
}

function nextUpdatedAt(previous: string) {
  const previousTime = Date.parse(previous)
  const nextTime = Number.isFinite(previousTime)
    ? Math.max(Date.now(), previousTime + 1)
    : Date.now()
  const candidate = new Date(nextTime).toISOString()
  return candidate === previous ? `${candidate}-${crypto.randomUUID()}` : candidate
}

export class RiskTenantLifecycleService {
  constructor(private readonly db: Db) {}

  async resolveOrganizationId(riskId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ organizationId: risks.organizationId })
      .from(risks)
      .where(eq(risks.id, riskId))
      .limit(1)
    return row?.organizationId ?? null
  }

  async getRisk(userId: string, riskId: string): Promise<RiskWithRelations> {
    const organizationId = await this.resolveOrganizationId(riskId)
    if (!organizationId) notFound()
    const authorization = await freshAuthorization(this.db, userId, organizationId)
    const canonical = await loadCanonicalRisk(this.db, riskId, organizationId)
    if (!canAccessDepartment(authorization.departmentAccess, canonical.departmentId)) notFound()
    return canonical.risk
  }

  async listRisks(
    authorization: TenantAuthorizationContext,
    filters: RiskFilters = {}
  ): Promise<RiskWithRelations[]> {
    const conditions = [eq(risks.organizationId, authorization.organizationId)]
    if (filters.status) conditions.push(eq(risks.status, filters.status))
    if (filters.assessmentPeriod) conditions.push(eq(risks.assessmentPeriod, filters.assessmentPeriod))
    const rows = await this.db
      .select({ id: risks.id })
      .from(risks)
      .where(and(...conditions))
      .orderBy(desc(risks.riskScore))

    const result: RiskWithRelations[] = []
    for (const row of rows) {
      try {
        const canonical = await loadCanonicalRisk(
          this.db,
          row.id,
          authorization.organizationId
        )
        if (canAccessDepartment(authorization.departmentAccess, canonical.departmentId)) {
          result.push(canonical.risk)
        }
      } catch (error) {
        if (!(error instanceof RiskTenantLifecycleError) || error.kind !== 'not_found') throw error
      }
    }
    return result
  }

  async patchRisk(
    userId: string,
    riskId: string,
    input: RiskPatchInput,
    audit: { userAgent?: string | null },
    injectFailure?: RiskFailureInjection
  ): Promise<RiskWithRelations> {
    const organizationId = await this.resolveOrganizationId(riskId)
    if (!organizationId) notFound()

    return this.db.transaction(async tx => {
      const authorization = await freshAuthorization(tx, userId, organizationId)
      const existing = await loadCanonicalRisk(tx, riskId, organizationId)
      if (!canAccessDepartment(authorization.departmentAccess, existing.departmentId)) notFound()

      const resultingOwnerId = input.updates.owner_id === undefined
        ? existing.risk.owner_id
        : input.updates.owner_id
      const resultingOwner = await resolveCanonicalOwner(tx, organizationId, resultingOwnerId ?? null)
      if (!canAccessDepartment(authorization.departmentAccess, resultingOwner.departmentId)) notFound()
      const ownerChanged = input.updates.owner_id !== undefined
        && resultingOwnerId !== existing.risk.owner_id
      const now = nextUpdatedAt(input.expectedUpdatedAt)
      let ownerChange = { resetTreatmentIds: [] as string[] }
      if (ownerChanged) {
        try {
          ownerChange = await new ResidualAcceptanceSubmissionService(tx as unknown as Db)
            .prepareForRiskOwnerChange({ riskId, now })
        } catch (error) {
          if (error instanceof ResidualAcceptanceSubmissionError && error.status === 409) {
            throw new RiskTenantLifecycleError('conflict')
          }
          throw error
        }
      }
      await assertCategory(
        tx,
        organizationId,
        input.updates.category_id === undefined
          ? existing.risk.category_id
          : input.updates.category_id ?? null
      )
      if (input.assetIds !== undefined) await assertAssets(tx, organizationId, input.assetIds)

      const impactLevel = input.updates.impact_level ?? existing.risk.impact_level
      const likelihoodLevel = input.updates.likelihood_level ?? existing.risk.likelihood_level
      const identifiedDate = input.updates.identified_date === undefined
        ? existing.risk.identified_date
        : input.updates.identified_date
      const setPayload = {
        ...(input.updates.title !== undefined ? { title: input.updates.title } : {}),
        ...(input.updates.description !== undefined ? { description: input.updates.description } : {}),
        ...(input.updates.category_id !== undefined ? { categoryId: input.updates.category_id } : {}),
        ...(input.updates.impact_level !== undefined ? { impactLevel: input.updates.impact_level } : {}),
        ...(input.updates.likelihood_level !== undefined ? { likelihoodLevel: input.updates.likelihood_level } : {}),
        ...(input.updates.status !== undefined ? { status: input.updates.status } : {}),
        ...(input.updates.identified_date !== undefined ? {
          identifiedDate: input.updates.identified_date,
          assessmentPeriod: computeAssessmentPeriod(input.updates.identified_date),
        } : {}),
        ...(input.updates.owner_id !== undefined ? { ownerId: input.updates.owner_id } : {}),
        riskScore: impactLevel != null && likelihoodLevel != null
          ? impactLevel * likelihoodLevel
          : null,
        updatedAt: now,
      }
      const updateResult = await tx
        .update(risks)
        .set(setPayload)
        .where(and(
          eq(risks.id, riskId),
          eq(risks.organizationId, organizationId),
          eq(risks.updatedAt, input.expectedUpdatedAt),
        ))
      if (updateResult.rowsAffected !== 1) {
        throw new RiskTenantLifecycleError('conflict')
      }
      await injectFailure?.('after_risk', tx)

      if (input.assetIds !== undefined) {
        await tx.delete(riskAssets).where(eq(riskAssets.riskId, riskId))
        if (input.assetIds.length > 0) {
          await tx.insert(riskAssets).values(input.assetIds.map(assetId => ({
            id: crypto.randomUUID(), riskId, assetId, createdAt: now,
          })))
        }
      }
      await injectFailure?.('after_assets', tx)

      const assessmentChanged = impactLevel !== existing.risk.impact_level
        || likelihoodLevel !== existing.risk.likelihood_level
      if (assessmentChanged) {
        await tx.insert(riskAssessmentHistory).values({
          id: crypto.randomUUID(),
          riskId,
          assessedBy: userId,
          assessmentDate: now,
          previousImpactLevel: existing.risk.impact_level,
          newImpactLevel: impactLevel,
          previousLikelihoodLevel: existing.risk.likelihood_level,
          newLikelihoodLevel: likelihoodLevel,
          notes: null,
        })
      }
      await injectFailure?.('after_history', tx)

      if (ownerChange.resetTreatmentIds.length > 0) {
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId,
          userId,
          action: 'risk.residual_acceptance.owner_changed_reapproval_required',
          resourceType: 'risk',
          resourceId: riskId,
          changes: JSON.stringify({
            previous_owner_id: existing.risk.owner_id,
            owner_id: resultingOwnerId,
            treatment_ids: ownerChange.resetTreatmentIds,
          }),
          userAgent: audit.userAgent ?? null,
          scope: 'tenant',
          createdAt: now,
        })
      }
      await injectFailure?.('after_residual_reset', tx)

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId,
        action: 'risk.updated',
        resourceType: 'risk',
        resourceId: riskId,
        changes: JSON.stringify({ ...input.updates, ...(input.assetIds ? { assetIds: input.assetIds } : {}) }),
        userAgent: audit.userAgent ?? null,
        scope: 'tenant',
        createdAt: now,
      })
      await injectFailure?.('after_audit', tx)

      const refreshedAuthorization = await freshAuthorization(tx, userId, organizationId)
      const persisted = await loadCanonicalRisk(tx, riskId, organizationId)
      if (!canAccessDepartment(refreshedAuthorization.departmentAccess, persisted.departmentId)) {
        notFound()
      }
      return persisted.risk
    })
  }

  async deleteRisk(
    userId: string,
    riskId: string,
    audit: { userAgent?: string | null },
    injectFailure?: RiskFailureInjection
  ): Promise<void> {
    const organizationId = await this.resolveOrganizationId(riskId)
    if (!organizationId) notFound()

    await this.db.transaction(async tx => {
      const authorization = await freshAuthorization(tx, userId, organizationId)
      const existing = await loadCanonicalRisk(tx, riskId, organizationId)
      if (!canAccessDepartment(authorization.departmentAccess, existing.departmentId)) notFound()

      const treatments = await tx
        .select({ id: riskTreatments.id })
        .from(riskTreatments)
        .where(eq(riskTreatments.riskId, riskId))
        .limit(1)
      const approvalHistory = await tx
        .select({ approvalRequestId: residualAcceptanceApprovalBindings.approvalRequestId })
        .from(residualAcceptanceApprovalBindings)
        .where(eq(residualAcceptanceApprovalBindings.riskId, riskId))
        .limit(1)
      if (treatments.length > 0 || approvalHistory.length > 0) {
        throw new RiskTenantLifecycleError('conflict')
      }

      const result = await tx
        .delete(risks)
        .where(and(eq(risks.id, riskId), eq(risks.organizationId, organizationId)))
      if (result.rowsAffected !== 1) {
        throw new RiskTenantLifecycleError('conflict')
      }
      await injectFailure?.('after_risk', tx)

      const now = new Date().toISOString()
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId,
        action: 'risk.deleted',
        resourceType: 'risk',
        resourceId: riskId,
        changes: JSON.stringify({ title: existing.risk.title }),
        userAgent: audit.userAgent ?? null,
        scope: 'tenant',
        createdAt: now,
      })
      await injectFailure?.('after_audit', tx)
    })
  }

  async createRisk(
    userId: string,
    input: RiskCreateInput,
    audit: { userAgent?: string | null },
    injectFailure?: RiskFailureInjection
  ): Promise<RiskWithRelations> {
    return this.db.transaction(async tx => {
      const authorization = await freshAuthorization(tx, userId, input.organizationId)
      const owner = await resolveCanonicalOwner(tx, input.organizationId, input.ownerId)
      if (!canAccessDepartment(authorization.departmentAccess, owner.departmentId)) notFound()
      await assertCategory(tx, input.organizationId, input.categoryId)
      await assertAssets(tx, input.organizationId, input.assetIds)

      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      await tx.insert(risks).values({
        id,
        organizationId: input.organizationId,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        impactLevel: input.impactLevel,
        likelihoodLevel: input.likelihoodLevel,
        riskScore: input.impactLevel * input.likelihoodLevel,
        status: input.status,
        identifiedDate: input.identifiedDate,
        identifiedBy: userId,
        ownerId: input.ownerId,
        assessmentPeriod: computeAssessmentPeriod(input.identifiedDate),
        createdAt: now,
        updatedAt: now,
      })
      await injectFailure?.('after_risk', tx)

      if (input.assetIds.length > 0) {
        await tx.insert(riskAssets).values(input.assetIds.map(assetId => ({
          id: crypto.randomUUID(), riskId: id, assetId, createdAt: now,
        })))
      }
      await injectFailure?.('after_assets', tx)
      await injectFailure?.('after_history', tx)

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        userId,
        action: 'risk.created',
        resourceType: 'risk',
        resourceId: id,
        changes: JSON.stringify({ title: input.title, assetIds: input.assetIds }),
        userAgent: audit.userAgent ?? null,
        scope: 'tenant',
        createdAt: now,
      })
      await injectFailure?.('after_audit', tx)
      const refreshedAuthorization = await freshAuthorization(tx, userId, input.organizationId)
      const persisted = await loadCanonicalRisk(tx, id, input.organizationId)
      if (!canAccessDepartment(refreshedAuthorization.departmentAccess, persisted.departmentId)) {
        notFound()
      }
      return persisted.risk
    })
  }
}
