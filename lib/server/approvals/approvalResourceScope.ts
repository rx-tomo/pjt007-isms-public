import { and, eq, inArray } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import {
  documents,
  organizationDepartments,
  risks,
  userMemberships,
  userProfiles,
} from '@/lib/db/drizzle/schema'

type ApprovalResourceScopeDb = ReturnType<typeof getDb>

export type ApprovalResourceScopeResolution =
  | { ok: true; departmentId: string | null }
  | { ok: false }

const unresolvedScope: ApprovalResourceScopeResolution = { ok: false }

function resolveDocumentScopeRow(row: {
  creatorId: string | null
  profileId: string | null
  profileOrganizationId: string | null
  profileActive: boolean | null
  departmentId: string | null
  membershipUserId: string | null
  membershipStatus: string | null
  validDepartmentId: string | null
}, organizationId: string): ApprovalResourceScopeResolution {
  if (row.creatorId === null) {
    return { ok: true, departmentId: null }
  }
  if (
    row.profileId === null
    || row.profileOrganizationId !== organizationId
    || row.profileActive !== true
    || row.membershipUserId === null
    || row.membershipStatus !== 'active'
    || (row.departmentId !== null && row.validDepartmentId === null)
  ) {
    return unresolvedScope
  }
  return { ok: true, departmentId: row.departmentId }
}

export async function resolveDocumentApprovalResourceScopes(
  db: ApprovalResourceScopeDb,
  organizationId: string,
  documentIds: readonly string[]
): Promise<Map<string, ApprovalResourceScopeResolution>> {
  const uniqueDocumentIds = [...new Set(documentIds)]
  if (uniqueDocumentIds.length === 0) return new Map()

  const rows = await db
    .select({
      documentId: documents.id,
      creatorId: documents.createdBy,
      profileId: userProfiles.id,
      profileOrganizationId: userProfiles.organizationId,
      profileActive: userProfiles.isActive,
      departmentId: userProfiles.primaryDepartmentId,
      membershipUserId: userMemberships.userId,
      membershipStatus: userMemberships.status,
      validDepartmentId: organizationDepartments.id,
    })
    .from(documents)
    .leftJoin(userProfiles, eq(userProfiles.id, documents.createdBy))
    .leftJoin(userMemberships, and(
      eq(userMemberships.userId, documents.createdBy),
      eq(userMemberships.organizationId, organizationId)
    ))
    .leftJoin(organizationDepartments, and(
      eq(organizationDepartments.id, userProfiles.primaryDepartmentId),
      eq(organizationDepartments.organizationId, organizationId)
    ))
    .where(and(
      inArray(documents.id, uniqueDocumentIds),
      eq(documents.organizationId, organizationId)
    ))

  return new Map(rows.map(row => [
    row.documentId,
    resolveDocumentScopeRow(row, organizationId),
  ]))
}

export async function resolveDocumentApprovalResourceScope(
  db: ApprovalResourceScopeDb,
  organizationId: string,
  documentId: string
): Promise<ApprovalResourceScopeResolution> {
  const scopes = await resolveDocumentApprovalResourceScopes(
    db,
    organizationId,
    [documentId]
  )
  return scopes.get(documentId) ?? unresolvedScope
}

export async function resolveRiskApprovalResourceScope(
  db: ApprovalResourceScopeDb,
  organizationId: string,
  riskId: string
): Promise<ApprovalResourceScopeResolution> {
  const [row] = await db
    .select({
      ownerId: risks.ownerId,
      profileId: userProfiles.id,
      profileOrganizationId: userProfiles.organizationId,
      profileActive: userProfiles.isActive,
      departmentId: userProfiles.primaryDepartmentId,
      membershipUserId: userMemberships.userId,
      membershipStatus: userMemberships.status,
      validDepartmentId: organizationDepartments.id,
    })
    .from(risks)
    .leftJoin(userProfiles, eq(userProfiles.id, risks.ownerId))
    .leftJoin(userMemberships, and(
      eq(userMemberships.userId, risks.ownerId),
      eq(userMemberships.organizationId, organizationId)
    ))
    .leftJoin(organizationDepartments, and(
      eq(organizationDepartments.id, userProfiles.primaryDepartmentId),
      eq(organizationDepartments.organizationId, organizationId)
    ))
    .where(and(
      eq(risks.id, riskId),
      eq(risks.organizationId, organizationId)
    ))
    .limit(1)

  if (!row) return unresolvedScope
  if (row.ownerId === null) return { ok: true, departmentId: null }
  if (
    row.profileId === null
    || row.profileOrganizationId !== organizationId
    || row.profileActive !== true
    || row.membershipUserId === null
    || row.membershipStatus !== 'active'
    || row.departmentId === null
    || row.validDepartmentId === null
  ) {
    return unresolvedScope
  }

  return { ok: true, departmentId: row.validDepartmentId }
}
