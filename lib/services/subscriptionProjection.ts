import { asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations, pricingPlans, subscriptions } from '@/lib/db/drizzle/schema'

type SubscriptionDb = ReturnType<typeof getDb>

export const terminalSubscriptionStatuses = ['canceled', 'incomplete_expired'] as const
export const nonTerminalSubscriptionStatuses = [
  'trialing',
  'active',
  'incomplete',
  'past_due',
  'unpaid',
] as const

type OrganizationSubscriptionPlan = 'trial' | 'starter' | 'standard' | 'enterprise'
type OrganizationSubscriptionStatus = 'active' | 'inactive' | 'suspended' | 'cancelled'

export type CanonicalSubscriptionCurrent = {
  subscriptionId: string
  organizationId: string
  pricingPlanId: string | null
  stripeSubscriptionId: string | null
  status: string
  createdAt: string | null
  expectedOrganizationPlan: OrganizationSubscriptionPlan | null
  expectedOrganizationStatus: OrganizationSubscriptionStatus
}

export type SubscriptionProjectionConflict =
  | {
      type: 'orphan_subscription'
      subscriptionId: string
    }
  | {
      type: 'unknown_status'
      organizationId: string
      subscriptionId: string
      status: string | null
    }
  | {
      type: 'multiple_non_terminal'
      organizationId: string
      subscriptionIds: string[]
    }
  | {
      type: 'unknown_plan_mapping'
      organizationId: string
      subscriptionId: string
      pricingPlanId: string | null
      pricingPlanName: string | null
    }
  | {
      type: 'summary_mismatch'
      organizationId: string
      subscriptionId: string
      expectedPlan: OrganizationSubscriptionPlan | null
      actualPlan: string | null
      expectedStatus: OrganizationSubscriptionStatus
      actualStatus: string | null
    }
  | {
      type: 'summary_without_current'
      organizationId: string
      actualPlan: string | null
      actualStatus: string | null
    }

export type SubscriptionProjectionPreflight = {
  safeForAdditiveCurrentConstraint: boolean
  currentByOrganization: Record<string, CanonicalSubscriptionCurrent | null>
  conflicts: SubscriptionProjectionConflict[]
}

const knownStatuses = new Set<string>([
  ...terminalSubscriptionStatuses,
  ...nonTerminalSubscriptionStatuses,
])
const nonTerminalStatuses = new Set<string>(nonTerminalSubscriptionStatuses)
const canonicalPlans = new Set<OrganizationSubscriptionPlan>([
  'trial',
  'starter',
  'standard',
  'enterprise',
])
const localizedPlanNames = new Map<string, OrganizationSubscriptionPlan>([
  ['トライアル', 'trial'],
  ['トライアルプラン', 'trial'],
  ['スターター', 'starter'],
  ['スタータープラン', 'starter'],
  ['スタンダード', 'standard'],
  ['スタンダードプラン', 'standard'],
  ['エンタープライズ', 'enterprise'],
  ['エンタープライズプラン', 'enterprise'],
])

function normalizePlanName(name: string | null): OrganizationSubscriptionPlan | null {
  if (!name) return null
  const normalized = name.trim().toLowerCase()
  const localized = localizedPlanNames.get(normalized)
  if (localized) return localized
  const withoutPlanSuffix = normalized.replace(/\s+plan$/, '')
  return canonicalPlans.has(normalized as OrganizationSubscriptionPlan)
    ? normalized as OrganizationSubscriptionPlan
    : canonicalPlans.has(withoutPlanSuffix as OrganizationSubscriptionPlan)
      ? withoutPlanSuffix as OrganizationSubscriptionPlan
      : null
}

function projectOrganizationStatus(status: string): OrganizationSubscriptionStatus {
  if (status === 'trialing' || status === 'active') return 'active'
  if (status === 'incomplete_expired') return 'inactive'
  if (status === 'canceled') return 'cancelled'
  return 'suspended'
}

export class SubscriptionProjectionConflictError extends Error {
  readonly name = 'SubscriptionProjectionConflictError'

  constructor(
    readonly organizationId: string,
    readonly conflicts: SubscriptionProjectionConflict[]
  ) {
    super(`Subscription state is inconsistent for organization ${organizationId}`)
  }
}

/**
 * Read-only inspection of subscription history. It never chooses one row when
 * multiple non-terminal rows exist and never writes summary columns.
 */
export class SubscriptionProjectionService {
  constructor(private readonly injectedDb?: SubscriptionDb) {}

  private get db(): SubscriptionDb {
    return this.injectedDb ?? getDb()
  }

  async inspect(): Promise<SubscriptionProjectionPreflight> {
    const rows = await this.db
      .select({
        subscriptionId: subscriptions.id,
        organizationId: subscriptions.organizationId,
        pricingPlanId: subscriptions.pricingPlanId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        status: subscriptions.status,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id))

    // Resolve plan names separately so orphaned nullable plan references remain
    // visible to the preflight rather than disappearing in an inner join.
    const planRows = await this.db.select({
      id: pricingPlans.id,
      name: pricingPlans.name,
    }).from(pricingPlans)
    const planNameById = new Map(planRows.map(plan => [plan.id, plan.name]))
    const organizationRows = await this.db.select({
      id: organizations.id,
      plan: organizations.subscriptionPlan,
      status: organizations.subscriptionStatus,
    }).from(organizations)
    const organizationById = new Map(organizationRows.map(organization => [
      organization.id,
      organization,
    ]))

    const conflicts: SubscriptionProjectionConflict[] = []
    const grouped = new Map<string, typeof rows>()
    for (const row of rows) {
      if (!row.organizationId) {
        conflicts.push({
          type: 'orphan_subscription',
          subscriptionId: row.subscriptionId,
        })
        continue
      }
      if (!row.status || !knownStatuses.has(row.status)) {
        conflicts.push({
          type: 'unknown_status',
          organizationId: row.organizationId,
          subscriptionId: row.subscriptionId,
          status: row.status,
        })
        continue
      }
      const existing = grouped.get(row.organizationId) ?? []
      existing.push(row)
      grouped.set(row.organizationId, existing)
    }

    const currentByOrganization: Record<string, CanonicalSubscriptionCurrent | null> = {}
    for (const organization of organizationRows) {
      currentByOrganization[organization.id] = null
    }

    for (const [organizationId, history] of grouped) {
      const currentRows = history.filter(
        row => row.status != null && nonTerminalStatuses.has(row.status)
      )
      if (currentRows.length > 1) {
        conflicts.push({
          type: 'multiple_non_terminal',
          organizationId,
          subscriptionIds: currentRows.map(row => row.subscriptionId),
        })
        continue
      }
      const current = currentRows[0]
      if (!current?.status) continue

      const pricingPlanName = current.pricingPlanId
        ? planNameById.get(current.pricingPlanId) ?? null
        : null
      const expectedPlan = normalizePlanName(pricingPlanName)
      if (expectedPlan === null) {
        conflicts.push({
          type: 'unknown_plan_mapping',
          organizationId,
          subscriptionId: current.subscriptionId,
          pricingPlanId: current.pricingPlanId,
          pricingPlanName,
        })
      }
      const expectedStatus = projectOrganizationStatus(current.status)
      const projection: CanonicalSubscriptionCurrent = {
        subscriptionId: current.subscriptionId,
        organizationId,
        pricingPlanId: current.pricingPlanId,
        stripeSubscriptionId: current.stripeSubscriptionId,
        status: current.status,
        createdAt: current.createdAt,
        expectedOrganizationPlan: expectedPlan,
        expectedOrganizationStatus: expectedStatus,
      }
      currentByOrganization[organizationId] = projection

      const summary = organizationById.get(organizationId)
      if (
        !summary
        || (expectedPlan !== null && summary.plan !== expectedPlan)
        || summary.status !== expectedStatus
      ) {
        conflicts.push({
          type: 'summary_mismatch',
          organizationId,
          subscriptionId: current.subscriptionId,
          expectedPlan,
          actualPlan: summary?.plan ?? null,
          expectedStatus,
          actualStatus: summary?.status ?? null,
        })
      }
    }

    for (const organization of organizationRows) {
      const hasKnownNonTerminal = (grouped.get(organization.id) ?? []).some(
        row => row.status != null && nonTerminalStatuses.has(row.status)
      )
      if (
        !hasKnownNonTerminal
        && organization.status === 'active'
      ) {
        conflicts.push({
          type: 'summary_without_current',
          organizationId: organization.id,
          actualPlan: organization.plan,
          actualStatus: organization.status,
        })
      }
    }

    return {
      safeForAdditiveCurrentConstraint: conflicts.length === 0,
      currentByOrganization,
      conflicts,
    }
  }

  async getCurrentForOrganization(
    organizationId: string
  ): Promise<CanonicalSubscriptionCurrent | null> {
    const projection = await this.inspect()
    const conflicts = projection.conflicts.filter(
      conflict => 'organizationId' in conflict && conflict.organizationId === organizationId
    )
    if (conflicts.length > 0) {
      throw new SubscriptionProjectionConflictError(organizationId, conflicts)
    }
    return projection.currentByOrganization[organizationId] ?? null
  }
}
