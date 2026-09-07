import { NextRequest, NextResponse } from 'next/server'
import type JSZip from 'jszip'
import { randomUUID } from 'crypto'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'
import { normalizeHeader, parseCsvToObjects, splitList } from '@/lib/utils/importers/csv'
import {
  loadOrganizationDataArchive,
  createOrganizationDataArchiveReadBudget,
  ORGANIZATION_DATA_CSV_LIMITS,
  OrganizationDataArchivePolicyError,
  readOrganizationDataArchiveEntry,
  type OrganizationDataArchiveReadBudget,
} from '@/lib/storage/organizationDataArchivePolicy'
import { InformationAssetService } from '@/lib/services/informationAsset'
import { resolveActiveTenantMemberByEmail } from '@/lib/server/auth/targetMember'
import { getDb } from '@/lib/db/drizzle/client'
import {
  organizationDepartments,
  organizationIsmsScopes,
  projectRoles,
  projectAssignments,
} from '@/lib/db/drizzle/schema/organizations'
import { userProfiles, userMemberships, organizationInvitations } from '@/lib/db/drizzle/schema/users'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { isoControls, informationAssets, informationAssetImportJobs, informationAssetImportRows } from '@/lib/db/drizzle/schema/risks'
import { eq, and, isNull, sql } from 'drizzle-orm'

export const runtime = 'nodejs'

type SummaryBlock = {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

type ImportSummary = {
  scope: SummaryBlock
  departments: SummaryBlock
  users: SummaryBlock
  roles: SummaryBlock
  assignments: SummaryBlock
  controls: SummaryBlock
  assets: SummaryBlock & { jobId?: string | null }
}

const emptyBlock = (): SummaryBlock => ({ processed: 0, created: 0, updated: 0, skipped: 0, errors: [] })

const TENANT_ROLES = ['system_operator', 'org_admin', 'auditor', 'approver', 'user'] as const
type TenantRole = typeof TENANT_ROLES[number]

function parseTenantRole(value: string | undefined): TenantRole | null {
  const normalized = (value ?? 'user').trim().toLowerCase() || 'user'
  return TENANT_ROLES.includes(normalized as TenantRole)
    ? normalized as TenantRole
    : null
}

function normalizeRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const parseBool = (value: string | undefined): boolean => {
  if (!value) return false
  return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase())
}

const numberOr = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

async function loadCsv(
  zip: JSZip,
  filename: string,
  requiredHeaders: string[],
  budget: OrganizationDataArchiveReadBudget
): Promise<Record<string, string>[]> {
  const content = await readOrganizationDataArchiveEntry(zip, filename, budget)
  if (!content) return []
  return parseCsvToObjects(content, requiredHeaders, ORGANIZATION_DATA_CSV_LIMITS)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file')
  const organizationId = (formData.get('organizationId') as string | null)?.trim()

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant',
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'organization_data.import'
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { logEvent, userId, json } = guard
  const db = getDb()
  const authorization = await authorizeTenantAction(
    db,
    userId,
    organizationId,
    'members.manage'
  )
  if (!authorization.ok) {
    return json({ error: 'Forbidden' }, { status: 403 })
  }

  const summary: ImportSummary = {
    scope: emptyBlock(),
    departments: emptyBlock(),
    users: emptyBlock(),
    roles: emptyBlock(),
    assignments: emptyBlock(),
    controls: emptyBlock(),
    assets: { ...emptyBlock(), jobId: null }
  }

  try {
    const zip = await loadOrganizationDataArchive(file)
    const archiveBudget = createOrganizationDataArchiveReadBudget()
    const departmentRows = await loadCsv(zip, 'departments.csv', ['name'], archiveBudget)
    const scopeRows = await loadCsv(
      zip,
      'isms_scope.csv',
      ['physical_locations', 'it_systems', 'departments', 'processes', 'exclusions'].map(normalizeHeader),
      archiveBudget
    )
    const userRows = await loadCsv(zip, 'users.csv', ['email'], archiveBudget)
    const roleRows = await loadCsv(zip, 'project_roles.csv', ['key', 'name'], archiveBudget)
    const assignmentRows = await loadCsv(
      zip,
      'project_assignments.csv',
      ['role_key', 'email'],
      archiveBudget
    )
    const controlRows = await loadCsv(zip, 'iso_controls.csv', ['category', 'title'], archiveBudget)
    const assetRows = await loadCsv(zip, 'information_assets.csv', ['name'], archiveBudget)

    // 1) Departments
    const deptPathToId = new Map<string, string>()
    const deptRecords = departmentRows
      .map(row => ({
        name: row['name'] ?? row['name_en'] ?? '',
        name_en: row['name_en'] ?? '',
        parent_path: row['parent_path'] ?? '',
        manager: row['manager_email'] ?? row['manager'] ?? '',
        description: row['description'] ?? ''
      }))
      .filter(row => row.name.trim().length > 0)
      .sort((a, b) => a.parent_path.split('/').filter(Boolean).length - b.parent_path.split('/').filter(Boolean).length)

    for (const row of deptRecords) {
      summary.departments.processed += 1
      const parentPath = row.parent_path.trim()
      let parentId: string | null = null
      if (parentPath) {
        parentId = deptPathToId.get(parentPath) ?? null
        if (!parentId) {
          summary.departments.errors.push(`parent not found for ${row.name} (${parentPath})`)
          summary.departments.skipped += 1
          continue
        }
      }

      const existingQuery = parentId
        ? await db
            .select({ id: organizationDepartments.id })
            .from(organizationDepartments)
            .where(and(
              eq(organizationDepartments.organizationId, organizationId),
              eq(organizationDepartments.name, row.name),
              eq(organizationDepartments.parentDepartmentId, parentId)
            ))
            .limit(1)
        : await db
            .select({ id: organizationDepartments.id })
            .from(organizationDepartments)
            .where(and(
              eq(organizationDepartments.organizationId, organizationId),
              eq(organizationDepartments.name, row.name),
              isNull(organizationDepartments.parentDepartmentId)
            ))
            .limit(1)

      const existing = existingQuery[0]
      const now = new Date().toISOString()

      if (existing) {
        await db
          .update(organizationDepartments)
          .set({
            nameEn: row.name_en || null,
            manager: row.manager || null,
            description: row.description || null,
            updatedAt: now,
          })
          .where(eq(organizationDepartments.id, existing.id))

        deptPathToId.set(parentPath ? `${parentPath}/${row.name}` : row.name, existing.id)
        summary.departments.updated += 1
      } else {
        const newId = randomUUID()
        try {
          await db.insert(organizationDepartments).values({
            id: newId,
            organizationId,
            name: row.name,
            nameEn: row.name_en || null,
            parentDepartmentId: parentId,
            manager: row.manager || null,
            description: row.description || null,
            memberCount: 0,
            createdAt: now,
            updatedAt: now,
          })
          deptPathToId.set(parentPath ? `${parentPath}/${row.name}` : row.name, newId)
          summary.departments.created += 1
        } catch {
          summary.departments.errors.push(`failed to insert department ${row.name}`)
          summary.departments.skipped += 1
        }
      }
    }

    // 2) ISMS Scope (single row expected)
    if (scopeRows.length > 0) {
      const row = scopeRows[0]
      const now = new Date().toISOString()

      const [existing] = await db
        .select({ id: organizationIsmsScopes.id })
        .from(organizationIsmsScopes)
        .where(eq(organizationIsmsScopes.organizationId, organizationId))
        .limit(1)

      const payload = {
        physicalLocations: JSON.stringify(splitList(row['physical_locations'])),
        itSystems: JSON.stringify(splitList(row['it_systems'])),
        departments: JSON.stringify(splitList(row['departments'])),
        processes: JSON.stringify(splitList(row['processes'])),
        exclusions: JSON.stringify(splitList(row['exclusions'])),
        updatedAt: now,
      }

      try {
        if (existing) {
          await db
            .update(organizationIsmsScopes)
            .set(payload)
            .where(eq(organizationIsmsScopes.id, existing.id))
          summary.scope.processed = 1
          summary.scope.updated = 1
        } else {
          await db.insert(organizationIsmsScopes).values({
            id: randomUUID(),
            organizationId,
            ...payload,
            createdAt: now,
          })
          summary.scope.processed = 1
          summary.scope.created = 1
        }
      } catch {
        summary.scope.errors.push('failed to upsert scope')
        summary.scope.skipped += 1
      }
    }

    // 3) Users (create invitation if profile doesn't exist)
    for (const row of userRows) {
      summary.users.processed += 1
      const email = (row['email'] ?? '').trim().toLowerCase()
      if (!email) {
        summary.users.skipped += 1
        summary.users.errors.push('email missing in users.csv')
        continue
      }

      const role = parseTenantRole(row['role'])
      if (!role) {
        summary.users.errors.push(
          `invalid tenant role for ${email}; allowed: ${TENANT_ROLES.join(', ')}`
        )
        summary.users.skipped += 1
        continue
      }

      const isActive = parseBool(row['is_active'] ?? 'true')

      const tenantMembers = await db
        .select({
          profileId: userProfiles.id,
          membershipId: userMemberships.id,
          previousRole: userMemberships.role,
          previousStatus: userMemberships.status,
        })
        .from(userMemberships)
        .innerJoin(userProfiles, eq(userProfiles.id, userMemberships.userId))
        .where(and(
          eq(userMemberships.organizationId, organizationId),
          eq(userProfiles.email, email)
        ))

      if (tenantMembers.length > 1) {
        summary.users.errors.push(`email ${email} matches multiple tenant memberships`)
        summary.users.skipped += 1
        continue
      }

      const tenantMember = tenantMembers[0]
      if (
        authorization.context.role === 'org_admin'
        && (role === 'system_operator' || tenantMember?.previousRole === 'system_operator')
      ) {
        summary.users.errors.push(`org_admin cannot manage system_operator role for ${email}`)
        summary.users.skipped += 1
        continue
      }

      const now = new Date().toISOString()
      const status = isActive ? 'active' : 'inactive'

      if (tenantMember) {
        try {
          await db.transaction(async tx => {
            const membershipId = tenantMember.membershipId
            if (
              tenantMember.previousRole === 'system_operator'
              && (role !== 'system_operator' || status !== 'active')
            ) {
              const [row] = await tx
                .select({ count: sql<number>`count(*)` })
                .from(userMemberships)
                .where(and(
                  eq(userMemberships.organizationId, organizationId),
                  eq(userMemberships.role, 'system_operator'),
                  eq(userMemberships.status, 'active')
                ))
              if ((row?.count ?? 0) <= 1) {
                throw new Error('At least one system_operator must remain in the tenant')
              }
            }

            const updatedMemberships = await tx
              .update(userMemberships)
              .set({ role, status, updatedAt: now })
              .where(and(
                eq(userMemberships.id, membershipId),
                eq(userMemberships.organizationId, organizationId)
              ))
              .returning({ id: userMemberships.id })
            if (updatedMemberships.length !== 1) {
              throw new Error('Tenant membership changed during import')
            }

            await tx.insert(auditLogs).values({
              id: randomUUID(),
              organizationId,
              userId,
              action: 'organization_data.user_membership_upserted',
              resourceType: 'user_membership',
              resourceId: membershipId,
              changes: JSON.stringify({
                email,
                role: { from: tenantMember?.previousRole ?? null, to: role },
                status: { from: tenantMember?.previousStatus ?? null, to: status },
              }),
              createdAt: now,
            })
          })
          summary.users.updated += 1
        } catch {
          summary.users.errors.push(`failed to update tenant membership for ${email}`)
          summary.users.skipped += 1
        }
      } else {
        const [existingInvite] = await db
          .select({ id: organizationInvitations.id })
          .from(organizationInvitations)
          .where(and(
            eq(organizationInvitations.organizationId, organizationId),
            eq(organizationInvitations.email, email),
            isNull(organizationInvitations.acceptedAt)
          ))
          .limit(1)

        if (existingInvite) {
          summary.users.skipped += 1
          continue
        }

        try {
          await db.transaction(async tx => {
            const invitationId = randomUUID()
            await tx.insert(organizationInvitations).values({
              id: invitationId,
              organizationId,
              email,
              role,
              invitedBy: userId,
              token: randomUUID(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: now,
            })
            await tx.insert(auditLogs).values({
              id: randomUUID(),
              organizationId,
              userId,
              action: 'organization_data.user_invited',
              resourceType: 'organization_invitation',
              resourceId: invitationId,
              changes: JSON.stringify({ email, role }),
              createdAt: now,
            })
          })
          summary.users.created += 1
        } catch {
          summary.users.errors.push(`failed to invite ${email}`)
          summary.users.skipped += 1
        }
      }
    }

    // 4) Project Roles
    const roleKeyToId = new Map<string, string>()
    for (const row of roleRows) {
      summary.roles.processed += 1
      const key = normalizeRoleKey(row['key'] ?? '')
      const name = (row['name'] ?? '').trim()
      if (!key || !name) {
        summary.roles.skipped += 1
        summary.roles.errors.push('role key or name missing')
        continue
      }

      const responsibilities = splitList(row['responsibilities']).map(item => item.replace(/;$/, ''))
      const displayOrder = numberOr(row['display_order'], roleKeyToId.size + 1)
      const isRequired = parseBool(row['is_required'] ?? 'false')
      const now = new Date().toISOString()

      const [existing] = await db
        .select({ id: projectRoles.id })
        .from(projectRoles)
        .where(and(eq(projectRoles.organizationId, organizationId), eq(projectRoles.key, key)))
        .limit(1)

      if (existing) {
        await db
          .update(projectRoles)
          .set({
            name,
            nameEn: (row['name_en'] ?? '').trim() || null,
            description: (row['description'] ?? '').trim() || null,
            responsibilities: responsibilities.length ? JSON.stringify(responsibilities) : null,
            displayOrder,
            isRequired,
            updatedAt: now,
          })
          .where(eq(projectRoles.id, existing.id))
        roleKeyToId.set(key, existing.id)
        summary.roles.updated += 1
      } else {
        const newId = randomUUID()
        try {
          await db.insert(projectRoles).values({
            id: newId,
            organizationId,
            key,
            name,
            nameEn: (row['name_en'] ?? '').trim() || null,
            description: (row['description'] ?? '').trim() || null,
            responsibilities: responsibilities.length ? JSON.stringify(responsibilities) : null,
            displayOrder,
            isRequired,
            createdAt: now,
            updatedAt: now,
          })
          roleKeyToId.set(key, newId)
          summary.roles.created += 1
        } catch {
          summary.roles.errors.push(`failed to insert role ${key}`)
          summary.roles.skipped += 1
        }
      }
    }

    // 5) Project Assignments
    for (const row of assignmentRows) {
      summary.assignments.processed += 1
      const roleKey = normalizeRoleKey(row['role_key'] ?? '')
      const email = (row['email'] ?? '').trim().toLowerCase()
      if (!roleKey || !email) {
        summary.assignments.skipped += 1
        summary.assignments.errors.push('assignment missing role_key or email')
        continue
      }

      const roleId = roleKeyToId.get(roleKey)
      if (!roleId) {
        summary.assignments.errors.push(`role not found for assignment: ${roleKey}`)
        summary.assignments.skipped += 1
        continue
      }

      const [profile] = await db
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(and(eq(userProfiles.organizationId, organizationId), eq(userProfiles.email, email)))
        .limit(1)

      const [invitation] = !profile
        ? await db
            .select({ id: organizationInvitations.id })
            .from(organizationInvitations)
            .where(and(eq(organizationInvitations.organizationId, organizationId), eq(organizationInvitations.email, email)))
            .limit(1)
        : [null]

      const entityKey = profile ? 'userId' : invitation ? 'invitationId' : null
      const entityId = profile?.id ?? invitation?.id ?? null

      if (!entityKey || !entityId) {
        summary.assignments.errors.push(`user/invitation not found for assignment email ${email}`)
        summary.assignments.skipped += 1
        continue
      }

      const existingAssignments = entityKey === 'userId'
        ? await db
            .select({ id: projectAssignments.id })
            .from(projectAssignments)
            .where(and(
              eq(projectAssignments.organizationId, organizationId),
              eq(projectAssignments.roleId, roleId),
              eq(projectAssignments.userId, entityId)
            ))
            .limit(1)
        : await db
            .select({ id: projectAssignments.id })
            .from(projectAssignments)
            .where(and(
              eq(projectAssignments.organizationId, organizationId),
              eq(projectAssignments.roleId, roleId),
              eq(projectAssignments.invitationId, entityId)
            ))
            .limit(1)

      if (existingAssignments[0]) {
        summary.assignments.skipped += 1
        continue
      }

      const now = new Date().toISOString()
      try {
        await db.insert(projectAssignments).values({
          id: randomUUID(),
          organizationId,
          roleId,
          ...(entityKey === 'userId' ? { userId: entityId } : { invitationId: entityId }),
          assignedBy: userId,
          note: (row['note'] ?? '').trim() || null,
          createdAt: now,
          updatedAt: now,
        })
        summary.assignments.created += 1
      } catch {
        summary.assignments.errors.push(`failed to assign ${email} to ${roleKey}`)
        summary.assignments.skipped += 1
      }
    }

    // 6) ISO Controls
    for (const row of controlRows) {
      summary.controls.processed += 1
      const category = (row['category'] ?? '').trim()
      const title = (row['title'] ?? '').trim()
      const controlCode = (row['control_code'] ?? '').trim()
      if (!category || !title) {
        summary.controls.skipped += 1
        summary.controls.errors.push('control missing category/title')
        continue
      }

      let existingId: string | null = null
      if (controlCode) {
        const [existing] = await db
          .select({ id: isoControls.id })
          .from(isoControls)
          .where(and(eq(isoControls.organizationId, organizationId), eq(isoControls.controlCode, controlCode)))
          .limit(1)
        existingId = existing?.id ?? null
      }
      if (!existingId) {
        const [existing] = await db
          .select({ id: isoControls.id })
          .from(isoControls)
          .where(and(eq(isoControls.organizationId, organizationId), eq(isoControls.category, category), eq(isoControls.title, title)))
          .limit(1)
        existingId = existing?.id ?? null
      }

      const now = new Date().toISOString()
      const tagsValue = JSON.stringify(splitList(row['tags']))

      if (existingId) {
        try {
          await db
            .update(isoControls)
            .set({
              controlCode: controlCode || null,
              category,
              title,
              description: (row['description'] ?? '').trim() || null,
              tags: tagsValue,
              updatedAt: now,
            })
            .where(eq(isoControls.id, existingId))
          summary.controls.updated += 1
        } catch {
          summary.controls.errors.push(`failed to update control ${controlCode || title}`)
          summary.controls.skipped += 1
        }
      } else {
        try {
          await db.insert(isoControls).values({
            id: randomUUID(),
            organizationId,
            controlCode: controlCode || null,
            category,
            title,
            description: (row['description'] ?? '').trim() || null,
            tags: tagsValue,
            createdAt: now,
            updatedAt: now,
          })
          summary.controls.created += 1
        } catch {
          summary.controls.errors.push(`failed to insert control ${controlCode || title}`)
          summary.controls.skipped += 1
        }
      }
    }

    // 7) Information Assets
    if (assetRows.length > 0) {
      const jobId = randomUUID()
      const now = new Date().toISOString()
      const informationAssetService = new InformationAssetService(db)

      await db.insert(informationAssetImportJobs).values({
        id: jobId,
        organizationId,
        createdBy: userId,
        originalFilename: 'information_assets.csv',
        status: 'processing',
        mode: 'upsert',
        totalRows: assetRows.length,
        successCount: 0,
        errorCount: 0,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })

      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < assetRows.length; i++) {
        const row = assetRows[i]
        const name = (row['name'] ?? '').trim()
        if (!name) continue

        try {
          const ownerEmail = (row['owner_email'] ?? '').trim().toLowerCase()
          const owner = ownerEmail
            ? await resolveActiveTenantMemberByEmail(db, organizationId, ownerEmail)
            : null
          if (ownerEmail && !owner) {
            throw new Error('Information asset owner not found')
          }
          const ownerId = owner?.userId ?? null

          const [existing] = await db
            .select({ id: informationAssets.id })
            .from(informationAssets)
            .where(and(eq(informationAssets.organizationId, organizationId), eq(informationAssets.name, name)))
            .limit(1)

          if (existing) {
            await informationAssetService.updateAssetForActor(
              { organizationId, actorUserId: userId },
              existing.id,
              {
                asset_type: row['asset_type'] || 'data',
                classification: row['classification'] || 'internal',
                criticality: row['criticality'] || 'medium',
                status: row['status'] || 'in_use',
                owner_id: ownerId,
                location: row['location'] || null,
                description: row['description'] || null,
              },
              {
                jobId,
                lineNumber: i + 2,
                rawData: JSON.stringify(row),
              }
            )
          } else {
            await informationAssetService.createAssetForActor(
              { organizationId, actorUserId: userId },
              {
                organization_id: organizationId,
                name,
                asset_type: row['asset_type'] || 'data',
                classification: row['classification'] || 'internal',
                criticality: row['criticality'] || 'medium',
                status: row['status'] || 'in_use',
                owner_id: ownerId,
                location: row['location'] || null,
                description: row['description'] || null,
              },
              {
                jobId,
                lineNumber: i + 2,
                rawData: JSON.stringify(row),
              }
            )
          }

          successCount += 1
        } catch (err) {
          errorCount += 1
          summary.assets.errors.push(err instanceof Error ? err.message : String(err))

          await db.insert(informationAssetImportRows).values({
            id: randomUUID(),
            jobId,
            lineNumber: i + 2,
            rawData: JSON.stringify(row),
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
            createdAt: now,
            updatedAt: now,
          })
        }
      }

      await db
        .update(informationAssetImportJobs)
        .set({
          status: 'completed',
          successCount,
          errorCount,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(informationAssetImportJobs.id, jobId))

      summary.assets.processed = assetRows.length
      summary.assets.created = successCount
      summary.assets.skipped = errorCount
      summary.assets.jobId = jobId
    }

    await logEvent('success', { summary })
    return json({ message: 'import completed', summary })
  } catch (err) {
    console.error('[organization-data/import] failed', err)
    await logEvent('error', { reason: err instanceof Error ? err.message : String(err) })
    if (err instanceof OrganizationDataArchivePolicyError) {
      return json({ error: 'Invalid or oversized organization data archive' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to import organization data', details: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
