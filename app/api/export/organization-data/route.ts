import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { toCsv } from '@/lib/utils/exporters/csv'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import {
  organizations,
  organizationIsmsScopes,
  organizationDepartments,
  projectRoles,
  projectAssignments,
  parseJsonArray,
} from '@/lib/db/drizzle/schema/organizations'
import { userProfiles, userMemberships, organizationInvitations } from '@/lib/db/drizzle/schema/users'
import { informationAssets, isoControls } from '@/lib/db/drizzle/schema/risks'
import { eq, and, inArray, asc } from 'drizzle-orm'

export const runtime = 'nodejs'

const BOOL = (value: boolean) => (value ? 'true' : 'false')

type RelatedProfileEmail = {
  id: string
  email: string | null
}

type RelatedMembership = {
  userId: string
  organizationId: string
  status?: string | null
}

type RelatedInvitationEmail = {
  id: string
  organizationId: string
  email: string
}

function buildTenantBoundRelatedEmailMaps({
  organizationId,
  profiles,
  memberships,
  invitations,
}: {
  organizationId: string
  profiles: RelatedProfileEmail[]
  memberships: RelatedMembership[]
  invitations: RelatedInvitationEmail[]
}) {
  const memberUserIds = new Set(
    memberships
      .filter(membership => membership.organizationId === organizationId)
      .map(membership => membership.userId)
  )
  const userEmailMap = new Map<string, string>()
  for (const profile of profiles) {
    if (profile.email && memberUserIds.has(profile.id)) {
      userEmailMap.set(profile.id, profile.email)
    }
  }

  const invitationEmailMap = new Map<string, string>()
  for (const invitation of invitations) {
    if (invitation.organizationId === organizationId) {
      invitationEmailMap.set(invitation.id, invitation.email)
    }
  }

  return { userEmailMap, invitationEmailMap }
}

function buildTemplateRows() {
  return {
    scope: [
      {
        physical_locations: 'Tokyo HQ (sample); Osaka DC (test)',
        it_systems: 'sample-sso;test-erp',
        departments: 'CEO Office;Security Operations',
        processes: 'Access management;Change management',
        exclusions: 'Factory floor systems'
      }
    ],
    departments: [
      {
        name: 'CEO Office (sample)',
        name_en: 'CEO Office',
        parent_path: '',
        manager_email: 'ceo.sample@example.com',
        description: 'トップマネジメントチーム'
      }
    ],
    roles: [
      {
        key: 'isms_manager',
        name: 'ISMSマネージャー',
        name_en: 'Riscala AI for ISMS',
        description: 'ISMS全体の推進と報告',
        responsibilities: 'PDCA;Management review',
        display_order: '1',
        is_required: 'true'
      }
    ],
    assignments: [
      { role_key: 'isms_manager', email: 'ceo.sample@example.com', note: '兼務' }
    ],
    users: [
      {
        email: 'ceo.sample@example.com',
        full_name: 'CEO Sample',
        role: 'org_admin',
        department: 'CEO Office (sample)',
        title: 'CEO',
        is_active: 'true'
      }
    ],
    controls: [
      {
        control_code: 'A.5.1',
        category: 'Information Security Policies',
        title: '情報セキュリティ方針の策定',
        description: 'サンプル方針',
        tags: 'policy;sample'
      }
    ],
    assets: [
      {
        name: 'sample-erp',
        asset_type: 'software',
        classification: 'internal',
        criticality: 'medium',
        status: 'in_use',
        owner_email: 'it.sample@example.com',
        location: 'cloud (sample)',
        description: 'サンプル業務システム',
        owner_name: ''
      }
    ]
  }
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  const templateOnly = ['1', 'true', 'yes'].includes((request.nextUrl.searchParams.get('template') ?? '').toLowerCase())

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant',
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'organization_data.export',
    logContext: { organizationId, templateOnly }
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const zip = new JSZip()

    if (templateOnly) {
      const t = buildTemplateRows()
      zip.file(
        'isms_scope.csv',
        toCsv(
          ['physical_locations', 'it_systems', 'departments', 'processes', 'exclusions'],
          t.scope.map(row => [row.physical_locations, row.it_systems, row.departments, row.processes, row.exclusions])
        )
      )
      zip.file(
        'departments.csv',
        toCsv(
          ['name', 'name_en', 'parent_path', 'manager_email', 'description'],
          t.departments.map(row => [row.name, row.name_en, row.parent_path, row.manager_email, row.description])
        )
      )
      zip.file(
        'project_roles.csv',
        toCsv(
          ['key', 'name', 'name_en', 'description', 'responsibilities', 'display_order', 'is_required'],
          t.roles.map(row => [row.key, row.name, row.name_en, row.description, row.responsibilities, row.display_order, row.is_required])
        )
      )
      zip.file(
        'project_assignments.csv',
        toCsv(['role_key', 'email', 'note'], t.assignments.map(row => [row.role_key, row.email, row.note]))
      )
      zip.file(
        'users.csv',
        toCsv(['email', 'full_name', 'role', 'department', 'title', 'is_active'], t.users.map(row => [row.email, row.full_name, row.role, row.department, row.title, row.is_active]))
      )
      zip.file(
        'iso_controls.csv',
        toCsv(['control_code', 'category', 'title', 'description', 'tags'], t.controls.map(row => [row.control_code, row.category, row.title, row.description, row.tags]))
      )
      zip.file(
        'information_assets.csv',
        toCsv(
          ['name', 'asset_type', 'classification', 'criticality', 'status', 'owner_email', 'owner_name', 'location', 'description'],
          t.assets.map(row => [row.name, row.asset_type, row.classification, row.criticality, row.status, row.owner_email, row.owner_name, row.location, row.description])
        )
      )

      const buffer = await zip.generateAsync({ type: 'nodebuffer' })
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="organization-data-template.zip"`
        }
      })
    }

    const db = getDb()

    // Fetch all data in parallel
    const [scopeRows, departments, roles, assignmentRows, users, assets, controls] = await Promise.all([
      db.select().from(organizationIsmsScopes).where(eq(organizationIsmsScopes.organizationId, organizationId)).limit(1),
      db.select().from(organizationDepartments).where(eq(organizationDepartments.organizationId, organizationId)).orderBy(asc(organizationDepartments.createdAt)),
      db.select().from(projectRoles).where(eq(projectRoles.organizationId, organizationId)).orderBy(asc(projectRoles.displayOrder)),
      db.select().from(projectAssignments).where(eq(projectAssignments.organizationId, organizationId)),
      db.select().from(userProfiles).where(eq(userProfiles.organizationId, organizationId)),
      db.select().from(informationAssets).where(eq(informationAssets.organizationId, organizationId)),
      db.select().from(isoControls).where(eq(isoControls.organizationId, organizationId)).orderBy(asc(isoControls.category), asc(isoControls.title)),
    ])

    const scopeRow = scopeRows[0] ?? null

    // Filter out system_operator users
    const filteredUsers = users.filter(u => u.role !== 'system_operator')

    // Build department hierarchy path helper
    const deptMap = new Map<string, { name: string; parentId: string | null }>()
    departments.forEach(d => deptMap.set(d.id, { name: d.name, parentId: d.parentDepartmentId ?? null }))

    const buildPath = (id: string | null): string => {
      if (!id) return ''
      const node = deptMap.get(id)
      if (!node) return ''
      const parentPath = buildPath(node.parentId)
      return parentPath ? `${parentPath}/${node.name}` : node.name
    }

    const deptCsv = toCsv(
      ['name', 'name_en', 'parent_path', 'manager_email', 'description'],
      departments.map(dept => [dept.name, dept.nameEn ?? '', buildPath(dept.parentDepartmentId ?? null), dept.manager ?? '', dept.description ?? ''])
    )

    const scopeCsv = toCsv(
      ['physical_locations', 'it_systems', 'departments', 'processes', 'exclusions'],
      [
        scopeRow
          ? [
              parseJsonArray(scopeRow.physicalLocations).map(s => s.trim()).join('; '),
              parseJsonArray(scopeRow.itSystems).map(s => s.trim()).join('; '),
              parseJsonArray(scopeRow.departments).map(s => s.trim()).join('; '),
              parseJsonArray(scopeRow.processes).map(s => s.trim()).join('; '),
              parseJsonArray(scopeRow.exclusions).map(s => s.trim()).join('; ')
            ]
          : ['','','','','']
      ]
    )

    const rolesCsv = toCsv(
      ['key', 'name', 'name_en', 'description', 'responsibilities', 'display_order', 'is_required'],
      roles.map(role => [
        role.key,
        role.name,
        role.nameEn ?? '',
        role.description ?? '',
        parseJsonArray(role.responsibilities).map(s => s.trim()).join(';'),
        role.displayOrder,
        BOOL(role.isRequired ?? false)
      ])
    )

    const roleIdToKey = new Map<string, string>()
    roles.forEach(role => roleIdToKey.set(role.id, role.key))

    // Resolve related profile/invitation emails through tenant-owned relations.
    const assignmentUserIds = assignmentRows.map(a => a.userId).filter(Boolean) as string[]
    const assignmentInvitationIds = assignmentRows.map(a => a.invitationId).filter(Boolean) as string[]
    const ownerIds = Array.from(new Set(assets.map(a => a.ownerId).filter((v): v is string => Boolean(v))))
    const relatedUserIds = Array.from(new Set([...assignmentUserIds, ...ownerIds]))

    const membershipRows = await db
      .select({
        userId: userMemberships.userId,
        organizationId: userMemberships.organizationId,
        role: userMemberships.role,
        status: userMemberships.status,
      })
      .from(userMemberships)
      .where(eq(userMemberships.organizationId, organizationId))

    let relatedProfiles: RelatedProfileEmail[] = []
    if (relatedUserIds.length > 0) {
      relatedProfiles = await db
        .select({ id: userProfiles.id, email: userProfiles.email })
        .from(userProfiles)
        .where(inArray(userProfiles.id, relatedUserIds))
    }

    let relatedInvitations: RelatedInvitationEmail[] = []
    if (assignmentInvitationIds.length > 0) {
      relatedInvitations = await db
        .select({
          id: organizationInvitations.id,
          organizationId: organizationInvitations.organizationId,
          email: organizationInvitations.email,
        })
        .from(organizationInvitations)
        .where(and(
          eq(organizationInvitations.organizationId, organizationId),
          inArray(organizationInvitations.id, assignmentInvitationIds)
        ))
    }

    const { userEmailMap, invitationEmailMap } = buildTenantBoundRelatedEmailMaps({
      organizationId,
      profiles: relatedProfiles,
      memberships: membershipRows,
      invitations: relatedInvitations,
    })

    const assignmentCsv = toCsv(
      ['role_key', 'email', 'note'],
      assignmentRows.map(a => [
        roleIdToKey.get(a.roleId) ?? '',
        (a.userId ? userEmailMap.get(a.userId) : null) ?? (a.invitationId ? invitationEmailMap.get(a.invitationId) : null) ?? '',
        a.note ?? ''
      ])
    )

    const membershipMap = new Map<string, string>()
    membershipRows.forEach(row => membershipMap.set(row.userId, row.role))

    const usersCsv = toCsv(
      ['email', 'full_name', 'role', 'department', 'title', 'is_active'],
      filteredUsers.map(user => [
        user.email,
        user.fullName ?? '',
        membershipMap.get(user.id) ?? user.role ?? '',
        user.department ?? '',
        (user as any).title ?? (user as any).position ?? '',
        BOOL(user.isActive ?? true)
      ])
    )

    const assetsCsv = toCsv(
      ['name', 'asset_type', 'classification', 'criticality', 'status', 'owner_email', 'owner_name', 'location', 'description'],
      assets.map(asset => [
        asset.name,
        asset.assetType,
        asset.classification,
        asset.criticality,
        asset.status,
        asset.ownerId ? userEmailMap.get(asset.ownerId) ?? '' : '',
        '',
        asset.location ?? '',
        asset.description ?? ''
      ])
    )

    const controlsCsv = toCsv(
      ['control_code', 'category', 'title', 'description', 'tags'],
      controls.map(control => [
        control.controlCode ?? '',
        control.category,
        control.title,
        control.description ?? '',
        parseJsonArray(control.tags).map(s => s.trim()).join(';')
      ])
    )

    const metadata = {
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      counts: {
        scope: scopeRow ? 1 : 0,
        departments: departments.length,
        roles: roles.length,
        assignments: assignmentRows.length,
        users: filteredUsers.length,
        controls: controls.length,
        assets: assets.length
      }
    }

    console.log('[export org-data]', metadata)

    zip.file('isms_scope.csv', scopeCsv)
    zip.file('departments.csv', deptCsv)
    zip.file('project_roles.csv', rolesCsv)
    zip.file('project_assignments.csv', assignmentCsv)
    zip.file('users.csv', usersCsv)
    zip.file('iso_controls.csv', controlsCsv)
    zip.file('information_assets.csv', assetsCsv)
    zip.file('metadata.json', JSON.stringify(metadata, null, 2))

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="organization-data-${organizationId}-${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}.zip"`
      }
    })
  } catch (err) {
    console.error('[organization-data/export] failed', err)
    return NextResponse.json({ error: 'Failed to export organization data' }, { status: 500 })
  }
}
