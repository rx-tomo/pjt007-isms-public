import { getDb } from '@/lib/db/drizzle/client'
import { organizations, auditLogs, userProfiles, userMemberships, authUsers, authAccounts, subscriptions } from '@/lib/db/drizzle/schema'
import { eq, and, desc, isNotNull, isNull, sql, lt } from 'drizzle-orm'
import {
  type Organization
} from '@/lib/utils/tenantSoftDelete'
import { createDefaultCategories } from '@/lib/services/defaultCategories'

export type TenantSummary = {
  id: string
  name: string
  subscription_plan: 'trial' | 'starter' | 'standard' | 'enterprise'
  subscription_status: 'active' | 'inactive' | 'suspended' | 'cancelled'
  isms_phase?: 'initial' | 'surveillance' | null
  trial_ends_at: string | null
  created_at: string
  updated_at: string
  locked?: boolean
  audit_log_count?: number
  last_audit_at?: string | null
  deleted_at?: string | null
}

export type OperatorCredentials = {
  email: string
  password: string | null
  userId: string
  status: 'created' | 'linked'
}

export type TenantCreatePayload = {
  name: string
  plan?: string
  status?: string
  trialDays?: number
  operatorEmail: string
  operatorName?: string
  operatorLocale?: string
}

export type AuditLogScope = 'tenant' | 'global'

export type GlobalAuditLogEntry = {
  id: string
  organization_id: string | null
  organization_name: string | null
  action: string
  scope: AuditLogScope
  created_at: string
  user_id: string | null
  user_email: string | null
  changes: Record<string, unknown> | null
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function normalizeIsmsPhase(value: string | null | undefined): TenantSummary['isms_phase'] {
  return value === 'initial' || value === 'surveillance' ? value : null
}

export class SuperAdminService {

  private async fetchApi<T>(
    path: string,
    options?: { method?: string; body?: unknown; params?: Record<string, string> }
  ): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('fetchApi must only be called from the browser')
    }
    const url = new URL(path, window.location.origin)
    if (options?.params) {
      Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    const res = await fetch(url.toString(), {
      method: options?.method ?? 'GET',
      headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `API error ${res.status}`)
    }
    return res.json()
  }

  async listTenants(): Promise<TenantSummary[]> {
    if (isBrowser()) {
      return this.fetchApi<TenantSummary[]>('/api/super-admin/organizations')
    }
    const db = getDb()
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        ismsPhase: organizations.ismsPhase,
        trialEndsAt: organizations.trialEndsAt,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        deletedAt: organizations.deletedAt,
      })
      .from(organizations)
      .where(isNull(organizations.deletedAt))
      .limit(500)

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      subscription_plan: (row.subscriptionPlan as TenantSummary['subscription_plan']) ?? 'trial',
      subscription_status: (row.subscriptionStatus as TenantSummary['subscription_status']) ?? 'active',
      isms_phase: normalizeIsmsPhase(row.ismsPhase),
      trial_ends_at: row.trialEndsAt ?? null,
      created_at: row.createdAt ?? '',
      updated_at: row.updatedAt ?? '',
      locked: row.subscriptionStatus === 'suspended',
      deleted_at: row.deletedAt ?? null,
    }))
  }

  async createTenant(params: TenantCreatePayload): Promise<{ tenant: TenantSummary; operator: OperatorCredentials }> {
    if (isBrowser()) {
      return this.fetchApi('/api/super-admin/organizations', {
        method: 'POST',
        body: params
      })
    }
    const { hashPassword } = await import('better-auth/crypto')
    const db = getDb()
    const now = new Date().toISOString()
    const orgId = crypto.randomUUID()
    const trialDays = params.trialDays ?? 14
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    const plan = params.plan ?? 'trial'
    const status = params.status ?? 'active'
    const operatorName = params.operatorName || params.operatorEmail.split('@')[0]

    // 1. Check if operator already exists
    const [existingUser] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, params.operatorEmail))
      .limit(1)

    let userId: string
    let temporaryPassword: string | null
    let operatorStatus: 'created' | 'linked'

    let existingProfile: { id: string } | null = null

    if (existingUser) {
      // Existing user — link to new tenant without creating a new auth user
      userId = existingUser.id
      temporaryPassword = null
      operatorStatus = 'linked'

      // Check if profile already exists — reject if user already belongs to another org
      const [profileRow] = await db
        .select({ id: userProfiles.id, organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)

      if (profileRow) {
        throw new Error(`User ${params.operatorEmail} already has an existing profile. Multi-org linking is not supported.`)
      }
      existingProfile = profileRow ?? null
    } else {
      // New user — create Better Auth compatible records without mutating the current browser session.
      temporaryPassword = crypto.randomUUID()
      userId = crypto.randomUUID()
      const hashedPassword = await hashPassword(temporaryPassword)
      const authNow = new Date()
      await db.insert(authUsers).values({
        id: userId,
        name: operatorName,
        email: params.operatorEmail,
        emailVerified: true,
        twoFactorEnabled: false,
        createdAt: authNow,
        updatedAt: authNow,
      })
      await db.insert(authAccounts).values({
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: 'credential',
        password: hashedPassword,
        createdAt: authNow,
        updatedAt: authNow,
      })
      operatorStatus = 'created'
    }

    // 2. All remaining inserts in a single transaction (H-3: compensate on failure)
    try {
    await db.transaction(async (tx) => {
      // Organization
      await tx.insert(organizations).values({
        id: orgId,
        name: params.name,
        subscriptionPlan: plan,
        subscriptionStatus: status,
        trialEndsAt,
        createdAt: now,
        updatedAt: now,
      })

      // User profile (org_admin) — skip if profile already exists (H-2)
      if (!existingProfile) {
        await tx.insert(userProfiles).values({
          id: userId,
          organizationId: orgId,
          email: params.operatorEmail,
          fullName: operatorName,
          role: 'org_admin',
          languagePreference: params.operatorLocale ?? 'ja',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
      }

      // User membership — skip if already a member of this org (H-2)
      const [existingMembership] = await tx
        .select({ id: userMemberships.id })
        .from(userMemberships)
        .where(and(
          eq(userMemberships.userId, userId),
          eq(userMemberships.organizationId, orgId)
        ))
        .limit(1)

      if (!existingMembership) {
        await tx.insert(userMemberships).values({
          id: crypto.randomUUID(),
          userId,
          organizationId: orgId,
          role: 'org_admin',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
      }

      // Subscription (trial)
      await tx.insert(subscriptions).values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        status: 'trialing',
        trialStart: now,
        trialEnd: trialEndsAt,
        createdAt: now,
        updatedAt: now,
      })

      // Default categories
      await createDefaultCategories(tx, orgId)

      // Audit log — organization created
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId,
        action: 'organization.created',
        resourceType: 'organization',
        resourceId: orgId,
        scope: 'global',
        createdAt: now,
      })

      // Audit log — operator linked (only when reusing existing user)
      if (operatorStatus === 'linked') {
        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          organizationId: orgId,
          userId,
          action: 'operator.linked',
          resourceType: 'user',
          resourceId: userId,
          changes: JSON.stringify({ email: params.operatorEmail }),
          scope: 'global',
          createdAt: now,
        })
      }
    })
    } catch (err) {
      // H-3: Compensate — delete orphaned auth user if we just created it
      if (operatorStatus === 'created' && userId) {
        try {
          await db.delete(authAccounts).where(eq(authAccounts.userId, userId))
          await db.delete(authUsers).where(eq(authUsers.id, userId))
        } catch (cleanupErr) {
          console.error('[SuperAdmin] Failed to cleanup orphaned auth user', cleanupErr)
        }
      }
      throw err
    }

    const tenant: TenantSummary = {
      id: orgId,
      name: params.name,
      subscription_plan: plan as TenantSummary['subscription_plan'],
      subscription_status: status as TenantSummary['subscription_status'],
      isms_phase: null,
      trial_ends_at: trialEndsAt,
      created_at: now,
      updated_at: now,
      locked: status === 'suspended',
      deleted_at: null,
    }

    const operator: OperatorCredentials = {
      email: params.operatorEmail,
      password: temporaryPassword,
      userId,
      status: operatorStatus,
    }

    return { tenant, operator }
  }

  /**
   * Set tenant lock state idempotently (preferred over toggleTenantLock).
   * If the organization is already in the target state, returns as-is without side effects.
   */
  async setTenantLockState(organizationId: string, locked: boolean, reason?: string): Promise<TenantSummary> {
    if (isBrowser()) {
      return this.fetchApi<TenantSummary>(`/api/super-admin/organizations/${organizationId}/lock`, {
        method: 'PATCH',
        body: { action: locked ? 'lock' : 'unlock', reason }
      })
    }

    const db = getDb()
    const now = new Date().toISOString()
    const targetStatus = locked ? 'suspended' : 'active'

    // Get current org state
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        trialEndsAt: organizations.trialEndsAt,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        deletedAt: organizations.deletedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      throw new Error('Organization not found')
    }
    if (org.deletedAt) {
      throw new Error('Organization is deleted')
    }

    // Idempotent: if already in target state, return as-is
    if (org.subscriptionStatus === targetStatus) {
      return {
        id: org.id,
        name: org.name,
        subscription_plan: (org.subscriptionPlan as TenantSummary['subscription_plan']) ?? 'trial',
        subscription_status: targetStatus as TenantSummary['subscription_status'],
        trial_ends_at: org.trialEndsAt ?? null,
        created_at: org.createdAt ?? '',
        updated_at: org.updatedAt ?? '',
        locked: targetStatus === 'suspended',
        deleted_at: org.deletedAt ?? null,
      }
    }

    // Update to target state
    await db
      .update(organizations)
      .set({ subscriptionStatus: targetStatus, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    // Record audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      action: locked ? 'organization.locked' : 'organization.unlocked',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: JSON.stringify({ reason: reason?.trim() || null, previous_status: org.subscriptionStatus, new_status: targetStatus }),
      scope: 'global',
      createdAt: now,
    })

    return {
      id: org.id,
      name: org.name,
      subscription_plan: (org.subscriptionPlan as TenantSummary['subscription_plan']) ?? 'trial',
      subscription_status: targetStatus as TenantSummary['subscription_status'],
      trial_ends_at: org.trialEndsAt ?? null,
      created_at: org.createdAt ?? '',
      updated_at: now,
      locked: targetStatus === 'suspended',
      deleted_at: org.deletedAt ?? null,
    }
  }

  /**
   * Toggle tenant lock (legacy). Prefer setTenantLockState for idempotent behavior.
   */
  async toggleTenantLock(organizationId: string, reason?: string): Promise<TenantSummary> {
    if (isBrowser()) {
      return this.fetchApi<TenantSummary>(`/api/super-admin/organizations/${organizationId}/lock`, {
        method: 'PATCH',
        body: { reason }
      })
    }
    const db = getDb()
    const now = new Date().toISOString()

    // Get current org state
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
        trialEndsAt: organizations.trialEndsAt,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        deletedAt: organizations.deletedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      throw new Error('Organization not found')
    }

    const newStatus = org.subscriptionStatus === 'suspended' ? 'active' : 'suspended'

    await db
      .update(organizations)
      .set({ subscriptionStatus: newStatus, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    // Record audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      action: newStatus === 'suspended' ? 'organization.locked' : 'organization.unlocked',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: JSON.stringify({ reason: reason?.trim() || null, newStatus }),
      scope: 'global',
      createdAt: now,
    })

    return {
      id: org.id,
      name: org.name,
      subscription_plan: (org.subscriptionPlan as TenantSummary['subscription_plan']) ?? 'trial',
      subscription_status: newStatus as TenantSummary['subscription_status'],
      trial_ends_at: org.trialEndsAt ?? null,
      created_at: org.createdAt ?? '',
      updated_at: now,
      locked: newStatus === 'suspended',
      deleted_at: org.deletedAt ?? null,
    }
  }

  async listGlobalAuditLogs(params: { limit?: number; before?: string | null; scope?: AuditLogScope | null } = {}) {
    if (isBrowser()) {
      const queryParams: Record<string, string> = {}
      if (params?.limit) queryParams.limit = String(params.limit)
      if (params?.before) queryParams.before = params.before
      if (params?.scope) queryParams.scope = params.scope
      const result = await this.fetchApi<{ logs: GlobalAuditLogEntry[] }>(
        '/api/super-admin/logs',
        { params: queryParams }
      )
      return result.logs
    }
    const { limit = 50, before = null, scope = null } = params
    const db = getDb()

    const conditions = []
    if (scope) {
      conditions.push(eq(auditLogs.scope, scope))
    }
    if (before) {
      conditions.push(lt(auditLogs.createdAt, before))
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        organizationId: auditLogs.organizationId,
        action: auditLogs.action,
        scope: auditLogs.scope,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        changes: auditLogs.changes,
        organizationName: organizations.name,
        userEmail: userProfiles.email,
      })
      .from(auditLogs)
      .leftJoin(organizations, eq(auditLogs.organizationId, organizations.id))
      .leftJoin(userProfiles, eq(auditLogs.userId, userProfiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)

    return rows.map(row => ({
      id: row.id,
      organization_id: row.organizationId,
      organization_name: row.organizationName ?? null,
      action: row.action,
      scope: (row.scope as AuditLogScope) ?? 'global',
      created_at: row.createdAt ?? '',
      user_id: row.userId,
      user_email: row.userEmail ?? null,
      changes: row.changes ? (() => { try { return JSON.parse(row.changes!) } catch { return null } })() : null,
    }))
  }

  /**
   * Soft delete an organization (set deleted_at timestamp)
   */
  async softDeleteOrganization(organizationId: string, reason?: string): Promise<void> {
    if (isBrowser()) {
      await this.fetchApi(`/api/super-admin/organizations/${organizationId}/delete`, {
        method: 'POST',
        body: { reason }
      })
      return
    }
    const db = getDb()
    const now = new Date().toISOString()

    // Verify org exists and is not already deleted
    const [org] = await db
      .select({ id: organizations.id, deletedAt: organizations.deletedAt })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      throw new Error('Organization not found')
    }
    if (org.deletedAt) {
      throw new Error('Organization is already deleted')
    }

    await db
      .update(organizations)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    // Record audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      action: 'organization.soft_deleted',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: JSON.stringify({ reason: reason?.trim() || null }),
      scope: 'global',
      createdAt: now,
    })
  }

  /**
   * Restore a soft-deleted organization
   */
  async restoreOrganization(organizationId: string, reason?: string): Promise<void> {
    if (isBrowser()) {
      await this.fetchApi(`/api/super-admin/organizations/${organizationId}/restore`, {
        method: 'POST',
        body: { reason }
      })
      return
    }
    const db = getDb()
    const now = new Date().toISOString()

    const [org] = await db
      .select({ id: organizations.id, deletedAt: organizations.deletedAt })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      throw new Error('Organization not found')
    }
    if (!org.deletedAt) {
      throw new Error('Organization is not deleted')
    }

    await db
      .update(organizations)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      action: 'organization.restored',
      resourceType: 'organization',
      resourceId: organizationId,
      changes: JSON.stringify({ reason: reason?.trim() || null }),
      scope: 'global',
      createdAt: now,
    })
  }

  /**
   * List all soft-deleted organizations
   */
  async listDeletedOrganizations(): Promise<Organization[]> {
    if (isBrowser()) {
      return this.fetchApi<Organization[]>('/api/super-admin/organizations', {
        params: { deleted: 'true' }
      })
    }
    const db = getDb()
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        deletedAt: organizations.deletedAt,
        subscriptionPlan: organizations.subscriptionPlan,
        subscriptionStatus: organizations.subscriptionStatus,
      })
      .from(organizations)
      .where(isNotNull(organizations.deletedAt))
      .limit(500)

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      deleted_at: row.deletedAt ?? null,
      subscription_plan: row.subscriptionPlan as any,
      subscription_status: row.subscriptionStatus as any,
    }))
  }
}
