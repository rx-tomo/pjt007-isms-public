import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { randomUUID } from 'crypto'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { normalizeHeader, parseCsvToObjects, splitList } from '@/lib/utils/importers/csv'
import { getDb } from '@/lib/db/drizzle/client'
import {
  organizationDepartments,
  organizationIsmsScopes,
  projectRoles,
  projectAssignments,
} from '@/lib/db/drizzle/schema/organizations'
import { userProfiles, userMemberships, organizationInvitations } from '@/lib/db/drizzle/schema/users'
import { isoControls, informationAssets, informationAssetImportJobs, informationAssetImportRows } from '@/lib/db/drizzle/schema/risks'
import { eq, and, isNull } from 'drizzle-orm'

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

async function loadCsv(zip: JSZip, filename: string, requiredHeaders: string[]): Promise<Record<string, string>[]> {
  const file = zip.file(filename)
  if (!file) return []
  const content = await file.async('arraybuffer')
  return parseCsvToObjects(content, requiredHeaders)
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
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'organization_data.import'
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { logEvent, userId, json } = guard
  const db = getDb()

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
    const buffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    // 1) Departments
    const departmentRows = await loadCsv(zip, 'departments.csv', ['name'])
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
    const scopeRows = await loadCsv(zip, 'isms_scope.csv', ['physical_locations', 'it_systems', 'departments', 'processes', 'exclusions'].map(normalizeHeader))
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
    const userRows = await loadCsv(zip, 'users.csv', ['email'])
    for (const row of userRows) {
      summary.users.processed += 1
      const email = (row['email'] ?? '').trim().toLowerCase()
      if (!email) {
        summary.users.skipped += 1
        summary.users.errors.push('email missing in users.csv')
        continue
      }

      const role = ((row['role'] ?? 'member').trim() || 'member') as string
      const fullName = (row['full_name'] ?? row['name'] ?? '').trim()
      const isActive = parseBool(row['is_active'] ?? 'true')

      const [profile] = await db
        .select({ id: userProfiles.id, organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.email, email))
        .limit(1)

      if (profile && profile.organizationId !== organizationId) {
        summary.users.errors.push(`email ${email} belongs to another organization`)
        summary.users.skipped += 1
        continue
      }

      const now = new Date().toISOString()

      if (profile) {
        await db
          .update(userProfiles)
          .set({
            fullName: fullName || undefined,
            role,
            isActive,
            updatedAt: now,
          })
          .where(eq(userProfiles.id, profile.id))

        const [membership] = await db
          .select({ id: userMemberships.id })
          .from(userMemberships)
          .where(and(
            eq(userMemberships.organizationId, organizationId),
            eq(userMemberships.userId, profile.id)
          ))
          .limit(1)

        if (membership) {
          await db
            .update(userMemberships)
            .set({ role, status: 'active', updatedAt: now })
            .where(eq(userMemberships.id, membership.id))
        } else {
          await db.insert(userMemberships).values({
            id: randomUUID(),
            organizationId,
            userId: profile.id,
            role,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          })
        }

        summary.users.updated += 1
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
          await db.insert(organizationInvitations).values({
            id: randomUUID(),
            organizationId,
            email,
            role,
            invitedBy: userId,
            token: randomUUID(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: now,
          })
          summary.users.created += 1
        } catch {
          summary.users.errors.push(`failed to invite ${email}`)
          summary.users.skipped += 1
        }
      }
    }

    // 4) Project Roles
    const roleRows = await loadCsv(zip, 'project_roles.csv', ['key', 'name'])
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
    const assignmentRows = await loadCsv(zip, 'project_assignments.csv', ['role_key', 'email'])
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
    const controlRows = await loadCsv(zip, 'iso_controls.csv', ['category', 'title'])
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

    // 7) Information Assets (direct insert/upsert)
    const assetRows = await loadCsv(zip, 'information_assets.csv', ['name'])
    if (assetRows.length > 0) {
      const jobId = randomUUID()
      const now = new Date().toISOString()

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

      // Resolve owner emails
      const ownerEmails = new Set<string>()
      for (const row of assetRows) {
        const email = (row['owner_email'] ?? '').trim().toLowerCase()
        if (email) ownerEmails.add(email)
      }
      const ownerMap = new Map<string, string>()
      if (ownerEmails.size > 0) {
        const profiles = await db
          .select({ id: userProfiles.id, email: userProfiles.email })
          .from(userProfiles)
          .where(eq(userProfiles.organizationId, organizationId))
        for (const p of profiles) {
          if (p.email && ownerEmails.has(p.email.toLowerCase())) {
            ownerMap.set(p.email.toLowerCase(), p.id)
          }
        }
      }

      for (let i = 0; i < assetRows.length; i++) {
        const row = assetRows[i]
        const name = (row['name'] ?? '').trim()
        if (!name) continue

        const ownerId = row['owner_email'] ? ownerMap.get(row['owner_email'].toLowerCase()) ?? null : null

        try {
          const [existing] = await db
            .select({ id: informationAssets.id })
            .from(informationAssets)
            .where(and(eq(informationAssets.organizationId, organizationId), eq(informationAssets.name, name)))
            .limit(1)

          if (existing) {
            await db
              .update(informationAssets)
              .set({
                assetType: row['asset_type'] || 'data',
                classification: row['classification'] || 'internal',
                criticality: row['criticality'] || 'medium',
                status: row['status'] || 'in_use',
                ownerId,
                location: row['location'] || null,
                description: row['description'] || null,
                updatedAt: now,
              })
              .where(eq(informationAssets.id, existing.id))
          } else {
            await db.insert(informationAssets).values({
              id: randomUUID(),
              organizationId,
              name,
              assetType: row['asset_type'] || 'data',
              classification: row['classification'] || 'internal',
              criticality: row['criticality'] || 'medium',
              status: row['status'] || 'in_use',
              ownerId,
              location: row['location'] || null,
              description: row['description'] || null,
              createdAt: now,
              updatedAt: now,
            })
          }

          await db.insert(informationAssetImportRows).values({
            id: randomUUID(),
            jobId,
            lineNumber: i + 2,
            rawData: JSON.stringify(row),
            status: 'imported',
            createdAt: now,
            updatedAt: now,
          })

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
    return NextResponse.json({ error: 'Failed to import organization data', details: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
