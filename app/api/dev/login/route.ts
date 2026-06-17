import { NextRequest, NextResponse } from 'next/server'
import {
  ROLE_KEYS,
  ROLE_SCENARIOS,
  PERMISSION_KEYS,
  requiresTenantSelection,
  requiresUserSelection,
  type RoleKey,
  type PermissionTemplate,
  type RoleScenarioOrganization,
  type RoleScenarioSeedOptions
} from '@/lib/dev-login/scenarios'
import { getDb, type DrizzleDb } from '@/lib/db/drizzle/client'
import { eq, and, asc, inArray, sql } from 'drizzle-orm'
import {
  organizations,
  organizationDepartments,
  userProfiles,
  userMemberships,
  userPermissionSets,
  userDepartmentScopes,
  documents,
  tasks,
  taskCategories,
  riskCategories,
  riskCriteria,
  risks,
  auditPlans,
  auditTeamMembers,
  auditChecklists,
  nonconformities,
  correctiveActions,
  auditReports,
} from '@/lib/db/drizzle/schema'
import { authUsers, authAccounts } from '@/lib/db/drizzle/schema/auth'
import { isDevApiAvailable } from '@/lib/dev-login/availability'

class OrganizationResolutionError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function parseOrganizationId(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const uuidPattern = /^[0-9a-fA-F-]{36}$/
  return uuidPattern.test(trimmed) ? trimmed : null
}

async function resolveOrganizationSelection(
  db: DrizzleDb,
  fallback: RoleScenarioOrganization | null,
  overrideId: string | null
): Promise<RoleScenarioOrganization | null> {
  if (!overrideId) {
    return fallback
  }

  if (fallback && fallback.id === overrideId) {
    return fallback
  }

  try {
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
      })
      .from(organizations)
      .where(eq(organizations.id, overrideId))
      .limit(1)

    if (rows.length === 0) {
      throw new OrganizationResolutionError('The selected tenant was not found.', 404)
    }

    const row = rows[0]
    return {
      id: row.id,
      name: row.name ?? `Tenant ${row.id.slice(0, 8)}`,
      plan: (row.subscriptionPlan ?? 'starter') as RoleScenarioOrganization['plan'],
      status: (row.subscriptionStatus ?? 'active') as RoleScenarioOrganization['status'],
    }
  } catch (error) {
    if (error instanceof OrganizationResolutionError) throw error
    throw new OrganizationResolutionError('Failed to load the selected tenant. Please refresh and retry.', 502)
  }
}

const AUDIT_ACTIVE_PLAN_ID = '44444444-4444-4444-8444-444444444444'
const AUDIT_SCHEDULED_PLAN_ID = '55555555-5555-4555-8555-555555555555'
const AUDIT_COMPLETED_PLAN_ID = '88888888-8888-4888-8888-888888888888'
const AUDIT_CHECKLIST_IDS = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
]
const AUDIT_NONCONFORMITY_OVERDUE_ID = '66666666-6666-4666-8666-666666666661'
const AUDIT_NONCONFORMITY_DUE_SOON_ID = '66666666-6666-4666-8666-666666666662'
const AUDIT_CORRECTIVE_ACTION_OVERDUE_ID = '77777777-7777-4777-8777-777777777771'
const AUDIT_CORRECTIVE_ACTION_DUE_SOON_ID = '77777777-7777-4777-8777-777777777772'
const AUDIT_REPORT_ACTIVE_ID = '99999999-9999-4999-8999-999999999991'
const AUDIT_REPORT_COMPLETED_ID = '99999999-9999-4999-8999-999999999992'

const DEFAULT_DEPARTMENTS: Record<string, string[]> = {
  '11111111-1111-4111-8111-111111111111': ['IT統制室', '経営管理部'],
  '22222222-2222-4222-8222-222222222222': ['情報システム部', '製造部', '品質保証部'],
  '33333333-3333-4333-8333-333333333333': ['監査室', 'サービス運用部']
}

export async function POST(request: NextRequest) {
  if (!isDevApiAvailable()) {
    return NextResponse.json({ error: 'Dev login is not available in production.' }, { status: 403 })
  }

  let payload: { role?: string; organizationId?: unknown; email?: unknown; userId?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const roleKey = payload.role as RoleKey | undefined

  if (!roleKey || !ROLE_KEYS.includes(roleKey)) {
    return NextResponse.json({ error: 'Unknown role' }, { status: 400 })
  }

  const scenario = ROLE_SCENARIOS[roleKey]
  const resolvedPermissions = scenario.permissions
  const tenantRequired = requiresTenantSelection(roleKey)
  const userSelectionRequired = requiresUserSelection(roleKey)
  const allowOrganizationSelection = tenantRequired
  const organizationOverrideId = allowOrganizationSelection ? parseOrganizationId(payload.organizationId) : null
  const rawEmail = typeof payload.email === 'string' ? payload.email.trim() : scenario.email
  const selectedUserId = typeof payload.userId === 'string' && payload.userId.trim() ? payload.userId.trim() : null

  if (userSelectionRequired && !rawEmail) {
    return NextResponse.json({ error: 'Email is required for this role' }, { status: 400 })
  }

  if (!rawEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = rawEmail.toLowerCase()
  const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
  if (!emailPattern.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Email format is invalid' }, { status: 400 })
  }

  try {
    const { auth } = await import('@/lib/auth/better-auth')
    const db = getDb()

    // 1. Resolve organization
    let resolvedOrganization: RoleScenarioOrganization | null = null
    if (allowOrganizationSelection) {
      try {
        resolvedOrganization = await resolveOrganizationSelection(db, scenario.organization, organizationOverrideId)
      } catch (error) {
        const message = error instanceof OrganizationResolutionError ? error.message : 'Failed to resolve selected tenant'
        const status = error instanceof OrganizationResolutionError ? error.status : 400
        console.error('[DevLogin] organization resolution failed', error)
        return NextResponse.json({ error: message }, { status })
      }
    }

    if (selectedUserId && resolvedOrganization) {
      const selectedRows = await db
        .select({
          profileId: userProfiles.id,
          email: userProfiles.email,
          fullName: userProfiles.fullName,
          profileRole: userProfiles.role,
          membershipRole: userMemberships.role,
          membershipStatus: userMemberships.status,
        })
        .from(userMemberships)
        .innerJoin(userProfiles, eq(userMemberships.userId, userProfiles.id))
        .where(and(
          eq(userMemberships.userId, selectedUserId),
          eq(userMemberships.organizationId, resolvedOrganization.id),
          eq(userMemberships.status, 'active')
        ))
        .limit(1)

      const selected = selectedRows[0]
      if (!selected) {
        return NextResponse.json({ error: 'Selected user is not active in the selected tenant.' }, { status: 403 })
      }

      if (selected.membershipRole !== roleKey) {
        return NextResponse.json(
          { error: `Selected user is assigned to the "${selected.membershipRole}" role. Choose that user from the matching tenant user list.` },
          { status: 400 }
        )
      }

      if (selected.email.toLowerCase() !== normalizedEmail) {
        return NextResponse.json({ error: 'Selected user and email do not match.' }, { status: 400 })
      }
    } else if (resolvedOrganization) {
      const membershipRows = await db
        .select({
          profileId: userProfiles.id,
          membershipRole: userMemberships.role,
        })
        .from(userMemberships)
        .innerJoin(userProfiles, eq(userMemberships.userId, userProfiles.id))
        .where(and(
          eq(userProfiles.email, normalizedEmail),
          eq(userMemberships.organizationId, resolvedOrganization.id),
          eq(userMemberships.status, 'active')
        ))
        .limit(1)

      const membership = membershipRows[0]
      if (membership && membership.membershipRole !== roleKey) {
        return NextResponse.json(
          { error: `Selected user is assigned to the "${membership.membershipRole}" role. Choose that user from the matching tenant user list.` },
          { status: 400 }
        )
      }

      if (!membership) {
        return NextResponse.json({ error: 'Selected email is not active in the selected tenant.' }, { status: 403 })
      }
    }

    // 2. Ensure organization exists
    if (resolvedOrganization) {
      const existing = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, resolvedOrganization.id))
        .limit(1)

      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 30)

      if (existing.length === 0) {
        await db.insert(organizations).values({
          id: resolvedOrganization.id,
          name: resolvedOrganization.name,
          subscriptionPlan: resolvedOrganization.plan,
          subscriptionStatus: resolvedOrganization.status,
          trialEndsAt: trialEndsAt.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      } else {
        await db.update(organizations)
          .set({
            name: resolvedOrganization.name,
            subscriptionPlan: resolvedOrganization.plan,
            subscriptionStatus: resolvedOrganization.status,
            trialEndsAt: trialEndsAt.toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(organizations.id, resolvedOrganization.id))
      }
    }

    // 2b. Auto-create dummy organization for tenant-required roles
    if (!resolvedOrganization && allowOrganizationSelection) {
      const dummyOrgId = crypto.randomUUID()
      const dummyOrg: RoleScenarioOrganization = {
        id: dummyOrgId,
        name: 'Dev Auto-Created Organization',
        plan: 'starter',
        status: 'active',
      }
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 30)

      await db.insert(organizations).values({
        id: dummyOrg.id,
        name: dummyOrg.name,
        subscriptionPlan: dummyOrg.plan,
        subscriptionStatus: dummyOrg.status,
        trialEndsAt: trialEndsAt.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      resolvedOrganization = dummyOrg
      console.info('[DevLogin] Auto-created dummy organization:', dummyOrg.id)
    }

    if (resolvedOrganization) {
      await ensureOrganizationDepartments(db, resolvedOrganization.id)
    }

    // 3. Create or find auth user via Better Auth
    const existingAuthUsers = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, normalizedEmail))
      .limit(1)

    let userId: string

    if (existingAuthUsers.length === 0) {
      const signUpResult = await auth.api.signUpEmail({
        body: {
          name: scenario.fullName,
          email: normalizedEmail,
          password: scenario.password,
        },
      })
      userId = signUpResult.user.id
    } else {
      userId = existingAuthUsers[0].id

      // Update password via direct DB update (dev-only, no auth check)
      const { hashPassword } = await import('better-auth/crypto')
      const hashedPassword = await hashPassword(scenario.password)
      const accounts = await db
        .select({ id: authAccounts.id })
        .from(authAccounts)
        .where(eq(authAccounts.userId, userId))
        .limit(1)

      if (accounts.length > 0) {
        await db.update(authAccounts)
          .set({ password: hashedPassword })
          .where(eq(authAccounts.id, accounts[0].id))
      }
    }

    // 4. Upsert user profile
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const now = new Date().toISOString()
    const keepExisting = existingProfile.length > 0
    const ep = existingProfile[0]

    if (keepExisting && ep && ep.role !== scenario.role) {
      return NextResponse.json(
        { error: `Selected user is assigned to the "${ep.role}" role. Choose the matching role or another user.` },
        { status: 400 }
      )
    }

    const profileValues = {
      id: userId,
      organizationId: resolvedOrganization?.id ?? ep?.organizationId ?? null,
      email: normalizedEmail,
      fullName: keepExisting && ep?.fullName ? ep.fullName : scenario.fullName,
      fullNameEn: keepExisting ? ep?.fullNameEn ?? null : null,
      role: scenario.role,
      department: keepExisting ? ep?.department ?? null : scenario.department ?? null,
      position: keepExisting ? ep?.position ?? null : null,
      phone: keepExisting ? ep?.phone ?? null : null,
      isActive: true,
      avatarUrl: keepExisting ? ep?.avatarUrl ?? null : null,
      languagePreference: keepExisting && ep?.languagePreference ? ep.languagePreference : 'ja',
      createdAt: keepExisting ? ep?.createdAt ?? now : now,
      updatedAt: now,
      lastLoginAt: now,
    }

    if (keepExisting) {
      await db.update(userProfiles)
        .set(profileValues)
        .where(eq(userProfiles.id, userId))
    } else {
      await db.insert(userProfiles).values(profileValues)
    }

    // 5. Upsert membership
    if (resolvedOrganization) {
      const existingMembership = await db
        .select({ id: userMemberships.id })
        .from(userMemberships)
        .where(and(
          eq(userMemberships.userId, userId),
          eq(userMemberships.organizationId, resolvedOrganization.id)
        ))
        .limit(1)

      if (existingMembership.length === 0) {
        await db.insert(userMemberships).values({
          id: crypto.randomUUID(),
          userId,
          organizationId: resolvedOrganization.id,
          role: scenario.role,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
      } else {
        await db.update(userMemberships)
          .set({ role: scenario.role, status: 'active', updatedAt: now })
          .where(eq(userMemberships.id, existingMembership[0].id))
      }
    }

    // 6. Seed organization data
    if (resolvedOrganization) {
      await seedOrganizationData(
        db,
        resolvedOrganization.id,
        userId,
        scenario.role,
        resolvedPermissions,
        scenario.seeds
      )

      await ensureUserDepartmentScopes(
        db,
        resolvedOrganization.id,
        userId,
        scenario.departmentScopes
      )
    }

    // 7. Sign in via Better Auth to establish session
    const signInResponse = await auth.api.signInEmail({
      body: {
        email: normalizedEmail,
        password: scenario.password,
      },
      asResponse: true,
    })

    const response = NextResponse.json({
      email: normalizedEmail,
      organizationId: resolvedOrganization?.id ?? null,
      role: scenario.role,
    })

    const setCookieHeaders = signInResponse.headers.getSetCookie?.() ?? []
    for (const cookieStr of setCookieHeaders) {
      response.headers.append('set-cookie', cookieStr)
    }
    response.cookies.set('dev-login.role', scenario.role, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false
    })

    return response
  } catch (error) {
    console.error('[DevLogin] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dev login failed' },
      { status: 500 }
    )
  }
}

// =============================================
// Seed helpers (all Drizzle-based)
// =============================================

async function seedOrganizationData(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
  role: keyof typeof ROLE_SCENARIOS,
  permissions: PermissionTemplate,
  seedOptions?: RoleScenarioSeedOptions
) {
  try {
    await ensureTaskCategories(db, organizationId)
    await ensureRiskCategories(db, organizationId)
    await ensureUserPermissionSet(db, organizationId, userId, permissions)

    await ensureAuditWorkspaceData(db, organizationId, userId, role)

    const documentCount = await countRows(db, 'documents', organizationId)
    if (documentCount === 0) {
      await db.insert(documents).values({
        id: crypto.randomUUID(),
        organizationId,
        title: '情報セキュリティ基本方針',
        description: 'ISO/IEC 27001に基づく情報セキュリティ基本方針。組織の情報セキュリティに対する基本的な考え方と取り組み方針を定める。',
        status: 'approved',
        category: 'ポリシー',
        createdBy: userId,
        updatedBy: userId,
      })
    }

    const taskCount = await countRows(db, 'tasks', organizationId)
    if (taskCount === 0) {
      const categoryId = await getFirstCategoryId(db, 'task_categories', organizationId)
      await db.insert(tasks).values({
        id: crypto.randomUUID(),
        organizationId,
        title: 'ISMS年次マネジメントレビュー',
        description: 'ISMSの運用状況・監査結果・インシデント対応・リスク状況を総括し、経営層へ報告する。改善指示事項を次年度計画へ反映する。',
        status: 'in_progress',
        priority: 'high',
        categoryId,
        assigneeId: userId,
        reporterId: userId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    if (seedOptions?.riskDemo) {
      await ensureRiskDemoData(db, organizationId, userId)
    } else {
      const riskCount = await countRows(db, 'risks', organizationId)
      if (riskCount === 0) {
        const riskCategoryId = await getFirstCategoryId(db, 'risk_categories', organizationId)
        await db.insert(risks).values({
          id: crypto.randomUUID(),
          organizationId,
          categoryId: riskCategoryId,
          title: '外部委託先のアクセス権管理不備',
          description: '委託先の退職者・異動者のアカウントが無効化されず、不正アクセスリスクが残存。四半期レビューの仕組みが未整備。',
          impactLevel: 4,
          likelihoodLevel: 3,
          riskScore: 12,
          status: 'analyzing',
          identifiedBy: userId,
          ownerId: userId,
        })
      }
    }
  } catch (error) {
    console.warn('[DevLogin] seeding skipped', error)
  }
}

async function ensureRiskDemoData(
  db: DrizzleDb,
  organizationId: string,
  userId: string
) {
  const existingCount = await countRows(db, 'risks', organizationId)
  if (existingCount >= 5) return

  // Delete existing risks to refresh
  await db.delete(risks).where(eq(risks.organizationId, organizationId))

  const riskCategoryId = await getFirstCategoryId(db, 'risk_categories', organizationId)
  const demoRisks = [
    { title: 'ランサムウェア攻撃による業務停止', impact: 5, likelihood: 3, status: 'mitigating' as const },
    { title: '内部関係者による情報持ち出し', impact: 4, likelihood: 3, status: 'analyzing' as const },
    { title: 'クラウドサービス障害', impact: 3, likelihood: 4, status: 'identified' as const },
    { title: 'フィッシングメールによる認証情報漏洩', impact: 4, likelihood: 4, status: 'mitigating' as const },
    { title: 'サプライチェーン経由のセキュリティ侵害', impact: 5, likelihood: 2, status: 'analyzing' as const },
  ]

  for (const r of demoRisks) {
    await db.insert(risks).values({
      id: crypto.randomUUID(),
      organizationId,
      categoryId: riskCategoryId,
      title: r.title,
      impactLevel: r.impact,
      likelihoodLevel: r.likelihood,
      riskScore: r.impact * r.likelihood,
      status: r.status,
      identifiedBy: userId,
      ownerId: userId,
    })
  }
}

async function ensureUserPermissionSet(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
  permissions: PermissionTemplate
) {
  try {
    const existingPerms = await db
      .select({ id: userPermissionSets.id })
      .from(userPermissionSets)
      .where(and(
        eq(userPermissionSets.userId, userId),
        eq(userPermissionSets.organizationId, organizationId)
      ))
      .limit(1)

    const permValues = {
      organizationId,
      userId,
      canManageDocuments: permissions.can_manage_documents ?? false,
      canManageRisks: permissions.can_manage_risks ?? false,
      canManageTasks: permissions.can_manage_tasks ?? false,
      canManageAudit: permissions.can_manage_audit ?? false,
      canManageAssets: permissions.can_manage_assets ?? false,
      canManageControls: permissions.can_manage_controls ?? false,
    }

    if (existingPerms.length === 0) {
      await db.insert(userPermissionSets).values({
        id: crypto.randomUUID(),
        ...permValues,
      })
    } else {
      await db.update(userPermissionSets)
        .set(permValues)
        .where(eq(userPermissionSets.id, existingPerms[0].id))
    }
  } catch (error) {
    console.warn('[DevLogin] failed to ensure permission set', error)
  }
}

async function ensureOrganizationDepartments(db: DrizzleDb, organizationId: string) {
  const departmentNames = DEFAULT_DEPARTMENTS[organizationId] ?? []
  if (departmentNames.length === 0) {
    return
  }

  try {
    const rows = await db
      .select({ name: organizationDepartments.name })
      .from(organizationDepartments)
      .where(eq(organizationDepartments.organizationId, organizationId))

    const existingNames = new Set(rows.map(row => row.name))
    const toInsert = departmentNames
      .filter(name => !existingNames.has(name))
      .map(name => ({
        id: crypto.randomUUID(),
        organizationId,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

    if (toInsert.length > 0) {
      await db.insert(organizationDepartments).values(toInsert)
    }
  } catch (error) {
    console.warn('[DevLogin] failed to ensure departments', error)
  }
}

async function ensureUserDepartmentScopes(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
  departmentNames: string[] | undefined
) {
  const targetNames = Array.from(new Set(departmentNames ?? []))

  try {
    const departments = await db
      .select({ id: organizationDepartments.id, name: organizationDepartments.name })
      .from(organizationDepartments)
      .where(eq(organizationDepartments.organizationId, organizationId))

    const nameToId = new Map(departments.map(row => [row.name, row.id]))
    const targetIds = targetNames
      .map(name => nameToId.get(name))
      .filter((value): value is string => Boolean(value))

    const existing = await db
      .select({ id: userDepartmentScopes.id, departmentId: userDepartmentScopes.departmentId })
      .from(userDepartmentScopes)
      .where(and(
        eq(userDepartmentScopes.organizationId, organizationId),
        eq(userDepartmentScopes.userId, userId)
      ))

    const existingIds = new Map(existing.map(row => [row.departmentId, row.id]))
    const deleteIds = existing
      .filter(row => !targetIds.includes(row.departmentId))
      .map(row => row.id)

    if (deleteIds.length > 0) {
      await db
        .delete(userDepartmentScopes)
        .where(inArray(userDepartmentScopes.id, deleteIds))
    }

    const toInsert = targetIds
      .filter(id => !existingIds.has(id))
      .map(id => ({
        id: crypto.randomUUID(),
        organizationId,
        userId,
        departmentId: id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

    if (toInsert.length > 0) {
      await db.insert(userDepartmentScopes).values(toInsert)
    }
  } catch (error) {
    console.warn('[DevLogin] failed to ensure department scopes', error)
  }
}

async function ensureAuditWorkspaceData(
  db: DrizzleDb,
  organizationId: string,
  userId: string,
  role: keyof typeof ROLE_SCENARIOS
) {
  if (role !== 'auditor' && role !== 'approver') {
    return
  }

  try {
    const today = new Date()

    // Active plan
    const [activePlanRow] = await db
      .select({ id: auditPlans.id })
      .from(auditPlans)
      .where(eq(auditPlans.id, AUDIT_ACTIVE_PLAN_ID))
      .limit(1)

    const activePlanPayload = {
      organizationId,
      title: 'ISMS年次内部監査（本年度）',
      description: 'ISO/IEC 27001 管理策（A.5〜A.8）を中心に、主要部門の適合性を確認する年次内部監査。',
      auditType: 'internal' as const,
      standard: 'ISO27001',
      auditPeriod: 'FY2025 Q4',
      plannedStartDate: formatDate(addDays(today, -14)),
      plannedEndDate: formatDate(addDays(today, 14)),
      actualStartDate: formatDate(addDays(today, -7)),
      status: 'in_progress' as const,
      leadAuditorId: userId,
    }

    if (!activePlanRow) {
      await db.insert(auditPlans).values({
        id: AUDIT_ACTIVE_PLAN_ID,
        ...activePlanPayload,
      })
    } else {
      await db.update(auditPlans)
        .set(activePlanPayload)
        .where(eq(auditPlans.id, AUDIT_ACTIVE_PLAN_ID))
    }

    // Scheduled plan
    const [scheduledPlanRow] = await db
      .select({ id: auditPlans.id })
      .from(auditPlans)
      .where(eq(auditPlans.id, AUDIT_SCHEDULED_PLAN_ID))
      .limit(1)

    const scheduledPlanPayload = {
      organizationId,
      title: '継続審査（次期）',
      description: '認証機関による定期審査。前回指摘事項のフォローアップを含む。',
      auditType: 'surveillance' as const,
      standard: 'ISO27001',
      auditPeriod: 'FY2026 Q1',
      plannedStartDate: formatDate(addDays(today, 30)),
      plannedEndDate: formatDate(addDays(today, 37)),
      status: 'scheduled' as const,
      leadAuditorId: userId,
    }

    if (!scheduledPlanRow) {
      await db.insert(auditPlans).values({
        id: AUDIT_SCHEDULED_PLAN_ID,
        ...scheduledPlanPayload,
      })
    } else {
      await db.update(auditPlans)
        .set(scheduledPlanPayload)
        .where(eq(auditPlans.id, AUDIT_SCHEDULED_PLAN_ID))
    }

    // Completed plan
    const [completedPlanRow] = await db
      .select({ id: auditPlans.id })
      .from(auditPlans)
      .where(eq(auditPlans.id, AUDIT_COMPLETED_PLAN_ID))
      .limit(1)

    const completedPlanPayload = {
      organizationId,
      title: '委託先セキュリティ監査（完了）',
      description: '主要委託先5社のセキュリティ管理状況を評価。アクセス権管理・データ保護措置の有効性を確認済み。',
      auditType: 'external' as const,
      standard: 'ISO27001',
      auditPeriod: 'FY2024 Q4',
      plannedStartDate: formatDate(addDays(today, -120)),
      plannedEndDate: formatDate(addDays(today, -110)),
      actualStartDate: formatDate(addDays(today, -118)),
      actualEndDate: formatDate(addDays(today, -112)),
      status: 'completed' as const,
      leadAuditorId: userId,
    }

    if (!completedPlanRow) {
      await db.insert(auditPlans).values({
        id: AUDIT_COMPLETED_PLAN_ID,
        ...completedPlanPayload,
      })
    } else {
      await db.update(auditPlans)
        .set(completedPlanPayload)
        .where(eq(auditPlans.id, AUDIT_COMPLETED_PLAN_ID))
    }

    // Team member
    const existingTeam = await db
      .select({ id: auditTeamMembers.id })
      .from(auditTeamMembers)
      .where(and(
        eq(auditTeamMembers.auditPlanId, AUDIT_ACTIVE_PLAN_ID),
        eq(auditTeamMembers.userId, userId)
      ))
      .limit(1)

    if (existingTeam.length === 0) {
      await db.insert(auditTeamMembers).values({
        id: crypto.randomUUID(),
        auditPlanId: AUDIT_ACTIVE_PLAN_ID,
        userId,
        role: 'lead',
      })
    }

    // Checklists
    const existingChecklists = await db
      .select({ id: auditChecklists.id })
      .from(auditChecklists)
      .where(eq(auditChecklists.auditPlanId, AUDIT_ACTIVE_PLAN_ID))
      .limit(1)

    const [policyChecklistId, privilegeChecklistId, backupChecklistId] = AUDIT_CHECKLIST_IDS

    if (existingChecklists.length === 0) {
      await db.insert(auditChecklists).values([
        {
          id: policyChecklistId,
          auditPlanId: AUDIT_ACTIVE_PLAN_ID,
          checkItem: '情報セキュリティ基本方針が最新の承認版であることを確認する',
          evidenceRequired: '経営層の承認済み文書を収集する',
          auditorId: userId,
          status: 'completed',
          reviewedAt: new Date().toISOString(),
        },
        {
          id: privilegeChecklistId,
          auditPlanId: AUDIT_ACTIVE_PLAN_ID,
          checkItem: '特権アクセスレビューが予定どおり実施されていることを確認する',
          evidenceRequired: '四半期アクセスレビューの承認証跡をサンプリングする',
          auditorId: userId,
          status: 'in_progress',
        },
        {
          id: backupChecklistId,
          auditPlanId: AUDIT_ACTIVE_PLAN_ID,
          checkItem: 'バックアップ復元テストの実施結果を確認する',
          evidenceRequired: '直近の復元テスト報告書またはチケット参照',
          auditorId: userId,
          status: 'not_started',
        },
      ])
    }

    // Nonconformities
    const existingNcRows = await db
      .select({ id: nonconformities.id })
      .from(nonconformities)
      .where(inArray(nonconformities.id, [AUDIT_NONCONFORMITY_OVERDUE_ID, AUDIT_NONCONFORMITY_DUE_SOON_ID]))

    const existingNcIds = new Set(existingNcRows.map(r => r.id))

    if (!existingNcIds.has(AUDIT_NONCONFORMITY_OVERDUE_ID)) {
      await db.insert(nonconformities).values({
        id: AUDIT_NONCONFORMITY_OVERDUE_ID,
        auditChecklistId: privilegeChecklistId,
        ncNumber: 'NC-DEV-001',
        type: 'major',
        description: '委託先2名の特権アクセス削除が所定期限内に完了していない。',
        responsibleId: userId,
        dueDate: formatDate(addDays(new Date(), -2)),
        status: 'in_progress',
      })
    }

    if (!existingNcIds.has(AUDIT_NONCONFORMITY_DUE_SOON_ID)) {
      await db.insert(nonconformities).values({
        id: AUDIT_NONCONFORMITY_DUE_SOON_ID,
        auditChecklistId: backupChecklistId,
        ncNumber: 'NC-DEV-002',
        type: 'minor',
        description: '財務システムのバックアップ復元テスト証跡が未提出。',
        responsibleId: userId,
        dueDate: formatDate(addDays(new Date(), 3)),
        status: 'open',
      })
    }

    // Corrective actions
    const existingCaRows = await db
      .select({ id: correctiveActions.id })
      .from(correctiveActions)
      .where(inArray(correctiveActions.id, [AUDIT_CORRECTIVE_ACTION_OVERDUE_ID, AUDIT_CORRECTIVE_ACTION_DUE_SOON_ID]))

    const existingCorrectiveIds = new Set(existingCaRows.map(r => r.id))

    if (!existingCorrectiveIds.has(AUDIT_CORRECTIVE_ACTION_OVERDUE_ID)) {
      await db.insert(correctiveActions).values({
        id: AUDIT_CORRECTIVE_ACTION_OVERDUE_ID,
        nonconformityId: AUDIT_NONCONFORMITY_OVERDUE_ID,
        actionDescription: '未使用の特権アカウントを無効化し、対応証跡を記録する。',
        responsibleId: userId,
        plannedDate: formatDate(addDays(new Date(), -1)),
        status: 'in_progress',
      })
    }

    if (!existingCorrectiveIds.has(AUDIT_CORRECTIVE_ACTION_DUE_SOON_ID)) {
      await db.insert(correctiveActions).values({
        id: AUDIT_CORRECTIVE_ACTION_DUE_SOON_ID,
        nonconformityId: AUDIT_NONCONFORMITY_DUE_SOON_ID,
        actionDescription: '四半期バックアップ復元テストをスケジュールし、実施結果を記録する。',
        responsibleId: userId,
        plannedDate: formatDate(addDays(new Date(), 5)),
        status: 'planned',
      })
    }

    // Audit reports
    await ensureAuditReportRecord(db, {
      reportId: AUDIT_REPORT_ACTIVE_ID,
      planId: AUDIT_ACTIVE_PLAN_ID,
      executiveSummary: 'ISMS年次内部監査の中間報告。管理策は概ね有効に機能しており、数件のアクションアイテムが残存。',
      scope: '管理部門および共有ITサービス',
      methodology: 'インタビュー、証跡確認、ウォークスルー',
      positiveFindings: 'ポリシーレビューは計画どおり実施されており、意識向上教育の受講率は目標を上回っている。',
      improvementOpportunities: '特権アクセスレビューのワークフロー自動化により是正期間の短縮が可能。',
      conclusion: '監査は進行中。中程度のリスク指摘について対応が進んでいる。',
      reportDate: formatDate(today),
      approvedBy: null,
    })

    await ensureAuditReportRecord(db, {
      reportId: AUDIT_REPORT_COMPLETED_ID,
      planId: AUDIT_COMPLETED_PLAN_ID,
      executiveSummary: '委託先セキュリティ監査完了。是正措置の検証済みでクローズ。',
      scope: '本番ワークロードを担う重要委託先',
      methodology: '文書レビュー、リモートウォークスルー、証跡パッケージのサンプリング',
      positiveFindings: '委託先オンボーディングチェックリストが調達プロセス全体で一貫して適用されている。',
      improvementOpportunities: '下請業者からのSLAエビデンス収集を5営業日以内に完了する仕組みが必要。',
      conclusion: '認証状態を維持。2件の軽微な観察事項に対応済み。',
      reportDate: formatDate(addDays(today, -30)),
      approvedBy: '中村 太郎',
    })
  } catch (error) {
    console.warn('[DevLogin] audit workspace seeding skipped', error)
  }
}

async function ensureAuditReportRecord(
  db: DrizzleDb,
  {
    reportId,
    planId,
    executiveSummary,
    scope,
    methodology,
    positiveFindings,
    improvementOpportunities,
    conclusion,
    reportDate,
    approvedBy = null
  }: {
    reportId: string
    planId: string
    executiveSummary: string
    scope: string
    methodology: string
    positiveFindings: string
    improvementOpportunities: string
    conclusion: string
    reportDate: string
    approvedBy?: string | null
  }
) {
  try {
    const [existingReport] = await db
      .select({ id: auditReports.id })
      .from(auditReports)
      .where(eq(auditReports.id, reportId))
      .limit(1)

    const payload = {
      auditPlanId: planId,
      executiveSummary,
      scope,
      methodology,
      positiveFindings,
      improvementOpportunities,
      conclusion,
      reportDate,
      approvedBy,
    }

    if (!existingReport) {
      await db.insert(auditReports).values({
        id: reportId,
        ...payload,
      })
    } else {
      await db.update(auditReports)
        .set(payload)
        .where(eq(auditReports.id, reportId))
    }
  } catch (error) {
    console.warn('[DevLogin] audit report seeding skipped', error)
  }
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

async function ensureTaskCategories(
  db: DrizzleDb,
  organizationId: string
) {
  const count = await countRows(db, 'task_categories', organizationId)
  if (count === 0) {
    const cats = [
      { name: 'ISMS構築' },
      { name: '文書作成' },
      { name: 'リスク対応' },
      { name: '内部監査' },
      { name: '是正措置' },
    ]
    try {
      await db.insert(taskCategories).values(
        cats.map((cat, index) => ({
          id: crypto.randomUUID(),
          organizationId,
          name: cat.name,
          displayOrder: index + 1,
        }))
      )
    } catch (error) {
      console.warn('[DevLogin] failed to ensure task categories', error)
    }
  }
}

async function ensureRiskCategories(
  db: DrizzleDb,
  organizationId: string
) {
  const count = await countRows(db, 'risk_categories', organizationId)
  if (count === 0) {
    const cats = [
      { name: '情報セキュリティ', color: '#EF4444' },
      { name: '事業継続', color: '#F59E0B' },
      { name: 'コンプライアンス', color: '#10B981' },
      { name: '人的リスク', color: '#3B82F6' },
      { name: '技術的リスク', color: '#8B5CF6' },
    ]
    try {
      await db.insert(riskCategories).values(
        cats.map((cat, index) => ({
          id: crypto.randomUUID(),
          organizationId,
          name: cat.name,
          color: cat.color,
          displayOrder: index + 1,
        }))
      )
    } catch (error) {
      console.warn('[DevLogin] failed to ensure risk categories', error)
    }

    // Default risk criteria
    try {
      const impactLevels = [
        { level: 1, label: '極小', description: '影響なし' },
        { level: 2, label: '小', description: '軽微な影響' },
        { level: 3, label: '中', description: '一定の影響' },
        { level: 4, label: '大', description: '重大な影響' },
        { level: 5, label: '極大', description: '壊滅的な影響' },
      ]
      const likelihoodLevels = [
        { level: 1, label: '極低', description: 'ほぼ発生しない' },
        { level: 2, label: '低', description: '発生しにくい' },
        { level: 3, label: '中', description: '時々発生する' },
        { level: 4, label: '高', description: '発生しやすい' },
        { level: 5, label: '極高', description: 'ほぼ確実に発生する' },
      ]

      await db.insert(riskCriteria).values([
        ...impactLevels.map(l => ({
          id: crypto.randomUUID(),
          organizationId,
          type: 'impact',
          level: l.level,
          label: l.label,
          description: l.description,
        })),
        ...likelihoodLevels.map(l => ({
          id: crypto.randomUUID(),
          organizationId,
          type: 'likelihood',
          level: l.level,
          label: l.label,
          description: l.description,
        })),
      ])
    } catch (error) {
      console.warn('[DevLogin] failed to ensure risk criteria', error)
    }
  }
}

type CountableTable = 'documents' | 'tasks' | 'risks' | 'task_categories' | 'risk_categories'

const tableMap: Record<CountableTable, { table: any; orgCol: any; idCol: any; createdAtCol?: any }> = {
  documents: { table: documents, orgCol: documents.organizationId, idCol: documents.id, createdAtCol: documents.createdAt },
  tasks: { table: tasks, orgCol: tasks.organizationId, idCol: tasks.id, createdAtCol: tasks.createdAt },
  risks: { table: risks, orgCol: risks.organizationId, idCol: risks.id, createdAtCol: risks.createdAt },
  task_categories: { table: taskCategories, orgCol: taskCategories.organizationId, idCol: taskCategories.id, createdAtCol: taskCategories.createdAt },
  risk_categories: { table: riskCategories, orgCol: riskCategories.organizationId, idCol: riskCategories.id, createdAtCol: riskCategories.createdAt },
}

async function countRows(
  db: DrizzleDb,
  tableName: CountableTable,
  organizationId: string
): Promise<number> {
  const t = tableMap[tableName]
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(t.table)
    .where(eq(t.orgCol, organizationId))

  return result[0]?.count ?? 0
}

async function getFirstCategoryId(
  db: DrizzleDb,
  tableName: 'task_categories' | 'risk_categories',
  organizationId: string
): Promise<string | null> {
  const t = tableMap[tableName]
  const rows = await db
    .select({ id: t.idCol })
    .from(t.table)
    .where(eq(t.orgCol, organizationId))
    .orderBy(asc(t.createdAtCol))
    .limit(1)

  return (rows[0] as { id: string } | undefined)?.id ?? null
}
