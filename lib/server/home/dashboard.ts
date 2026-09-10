import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import {
  educationPlans,
  educationRecords,
  organizations,
  userProfiles,
} from '@/lib/db/drizzle/schema'
import { ActivityService, type ActivityLogEntry } from '@/lib/services/activity'
import { ManagementReviewService } from '@/lib/services/managementReview'
import { NotificationRecipientService, type Notification } from '@/lib/services/notification'
import { OnboardingService, type OnboardingProgress } from '@/lib/services/onboarding'
import { OrganizationService, type OrganizationStats } from '@/lib/services/organization'
import { StripeService, type Subscription } from '@/lib/services/stripe'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { buildHomeRoleDashboard } from '@/lib/server/home/roleDashboard'
import type {
  EducationFollowUpSummary,
  HomeDashboard,
  HomeDashboardStats,
  HomeOrganization,
  HomeRoleDashboard,
  HomeSubscription,
  HomeUser,
  ManagementReviewSummary,
  MyTrainingSummary,
} from '@/lib/client/home/dashboardContract'

const EMPTY_STATS: HomeDashboardStats = {
  userCount: 0,
  documentCount: 0,
  pendingReviewDocumentCount: 0,
  activeTaskCount: 0,
  overdueTaskCount: 0,
  activeRiskCount: 0,
  inProgressAuditCount: 0,
  taskStatusBreakdown: {},
  riskStatusBreakdown: {},
  documentStatusBreakdown: {},
}

class HomeDashboardUnavailableError extends Error {}

function normalizeStats(value: OrganizationStats | null): HomeDashboardStats {
  if (!value) return EMPTY_STATS
  return {
    userCount: value.userCount ?? 0,
    documentCount: value.documentCount ?? 0,
    pendingReviewDocumentCount: value.pendingReviewDocumentCount ?? 0,
    activeTaskCount: value.activeTaskCount ?? 0,
    overdueTaskCount: value.overdueTaskCount ?? 0,
    activeRiskCount: value.activeRiskCount ?? 0,
    inProgressAuditCount: value.inProgressAuditCount ?? 0,
    taskStatusBreakdown: value.taskStatusBreakdown ?? {},
    riskStatusBreakdown: value.riskStatusBreakdown ?? {},
    documentStatusBreakdown: value.documentStatusBreakdown ?? {},
  }
}

function mapOrganization(row: typeof organizations.$inferSelect): HomeOrganization {
  return {
    id: row.id,
    name: row.name,
    name_en: row.nameEn ?? null,
    employee_count_range: row.employeeCountRange ?? null,
    industry: row.industry ?? null,
    iso_certification_status: row.isoCertificationStatus ?? null,
    subscription_plan: row.subscriptionPlan ?? null,
    subscription_status: row.subscriptionStatus ?? null,
    isms_phase: row.ismsPhase ?? null,
    isms_phase_set_at: row.ismsPhaseSetAt ?? null,
    trial_ends_at: row.trialEndsAt ?? null,
    updated_at: row.updatedAt ?? null,
  }
}

function mapUser(
  profile: typeof userProfiles.$inferSelect,
  role: string,
  organizationId: string,
): HomeUser {
  return {
    id: profile.id,
    name: profile.fullName,
    full_name: profile.fullName,
    email: profile.email,
    role: profile.role,
    effective_role: role,
    effective_organization_id: organizationId,
  }
}

function readOptional<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  return promise.catch(error => {
    console.warn(`[HomeDashboard] ${label} read failed`, error)
    return fallback
  })
}

const FOLLOW_UP_STATUSES = new Set(['draft', 'scheduled', 'in_progress'])

function isPastDate(value: string | null): boolean {
  if (!value) return false
  const end = new Date(`${value}T23:59:59.999Z`)
  return Number.isFinite(end.getTime()) && end.getTime() < Date.now()
}

async function buildEducationFollowUp(
  db: ReturnType<typeof getDb>,
  organizationId: string,
): Promise<EducationFollowUpSummary> {
  const [plans, activeUsers] = await Promise.all([
    db.select().from(educationPlans).where(eq(educationPlans.organizationId, organizationId)),
    db.select({ id: userProfiles.id }).from(userProfiles).where(and(
      eq(userProfiles.organizationId, organizationId),
      eq(userProfiles.isActive, true),
    )),
  ])
  const planIds = plans.map(plan => plan.id)
  const records = planIds.length > 0
    ? await db.select().from(educationRecords).where(inArray(educationRecords.planId, planIds))
    : []
  const recordsByPlan = new Map<string, typeof records>()
  for (const record of records) {
    if (!record.planId) continue
    const current = recordsByPlan.get(record.planId) ?? []
    current.push(record)
    recordsByPlan.set(record.planId, current)
  }

  const followUpItems = plans.map(plan => {
    const planRecords = recordsByPlan.get(plan.id) ?? []
    const passedRecords = planRecords.filter(record => record.result === 'passed').length
    const pendingRecords = planRecords.filter(record => ['pending', 'incomplete', 'failed'].includes(record.result ?? '')).length
    const overdue = isPastDate(plan.endDate)
    const needsFollowUp = FOLLOW_UP_STATUSES.has(plan.status ?? '') && (overdue || passedRecords === 0 || pendingRecords > 0)
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status ?? 'draft',
      end_date: plan.endDate,
      total_records: planRecords.length,
      passed_records: passedRecords,
      pending_records: pendingRecords,
      active_user_count: activeUsers.length,
      is_overdue: overdue,
      needs_follow_up: needsFollowUp,
      updated_at: plan.updatedAt,
      created_at: plan.createdAt,
    }
  }).filter(item => item.needs_follow_up)

  return {
    total_plans: plans.length,
    active_user_count: activeUsers.length,
    needs_follow_up_count: followUpItems.length,
    overdue_count: followUpItems.filter(item => item.is_overdue).length,
    pending_record_count: followUpItems.reduce((sum, item) => sum + item.pending_records, 0),
    items: followUpItems.slice(0, 5),
  }
}

const ALL_TARGET_LABELS = new Set(['全社員', '全員', '全従業員', 'all', 'all employees', 'everyone'])
const ROLE_TARGET_LABELS: Record<string, string[]> = {
  org_admin: ['組織管理者', '管理者', 'org_admin', 'organization admin'],
  auditor: ['監査員', '内部監査員', 'auditor'],
  approver: ['承認者', 'approver'],
  user: ['メンバー', '一般ユーザー', 'user', 'member'],
  system_operator: ['システム運営者', 'system_operator', 'system operator'],
}

function parseTargetAudience(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
  } catch {
    // Existing plans may store this as free text.
  }
  return value.split(/[,\n、]/).map(item => item.trim()).filter(Boolean)
}

function planTargetsUser(targetAudience: string | null, user: typeof userProfiles.$inferSelect): boolean {
  const labels = parseTargetAudience(targetAudience)
  if (labels.length === 0) return true
  return labels.some(label => {
    if (label.startsWith('user:')) return label.slice(5) === user.id
    if (label.startsWith('role:')) return label.slice(5) === user.role
    if (label.startsWith('department:')) return label.slice(11).toLowerCase() === (user.department ?? '').toLowerCase()
    if (ALL_TARGET_LABELS.has(label.toLowerCase())) return true
    const normalized = label.toLowerCase()
    const values = [user.department, user.position, user.role, user.fullName, user.email]
      .filter((item): item is string => Boolean(item))
      .map(item => item.toLowerCase())
    return values.some(value => value.includes(normalized) || normalized.includes(value)) ||
      (ROLE_TARGET_LABELS[user.role] ?? []).some(roleLabel => roleLabel.toLowerCase() === normalized)
  })
}

async function buildMyTraining(
  db: ReturnType<typeof getDb>,
  profile: typeof userProfiles.$inferSelect,
  organizationId: string,
): Promise<MyTrainingSummary> {
  const plans = await db.select().from(educationPlans).where(eq(educationPlans.organizationId, organizationId))
  const targetPlans = plans
    .filter(plan => planTargetsUser(plan.targetAudience, profile))
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? '').getTime() - new Date(a.updatedAt ?? a.createdAt ?? '').getTime())
  const planIds = targetPlans.map(plan => plan.id)
  const records = planIds.length > 0
    ? await db.select().from(educationRecords).where(inArray(educationRecords.planId, planIds))
    : []
  const items = targetPlans.map(plan => {
    const record = records.find(item => item.planId === plan.id && item.attendeeId === profile.id)
    const result = record?.result ?? 'pending'
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status ?? 'draft',
      end_date: plan.endDate,
      result,
      progress: result === 'passed' ? 100 : record ? 50 : 0,
      record_id: record?.id ?? null,
    }
  })
  return {
    total: items.length,
    incomplete_count: items.filter(item => item.progress < 100).length,
    items: items.slice(0, 5),
  }
}

function summarizeManagementReviews(reviews: Array<{ status?: string | null }>): ManagementReviewSummary {
  const scheduledCount = reviews.filter(review => review.status === 'scheduled').length
  const inProgressCount = reviews.filter(review => review.status === 'in_progress').length
  return {
    scheduled_count: scheduledCount,
    in_progress_count: inProgressCount,
    pending_count: scheduledCount + inProgressCount,
  }
}

export async function buildHomeDashboard(userId: string): Promise<HomeDashboard> {
  const db = getDb()
  const profile = await db.select().from(userProfiles).where(eq(userProfiles.id, userId)).limit(1)
  const profileRow = profile[0]
  if (!profileRow || profileRow.isActive !== true || !profileRow.organizationId) {
    throw new HomeDashboardUnavailableError('Home profile is unavailable')
  }

  const authorization = await resolveTenantAuthorizationContext(db, userId, profileRow.organizationId)
  if (!authorization.ok) throw new HomeDashboardUnavailableError('Home membership is unavailable')

  const organizationRows = await db.select().from(organizations).where(and(
    eq(organizations.id, authorization.context.organizationId),
    eq(organizations.deletionStatus, 'active'),
  )).limit(1)
  const organizationRow = organizationRows[0]
  if (!organizationRow || organizationRow.deletedAt) {
    throw new HomeDashboardUnavailableError('Home organization is unavailable')
  }

  const organization = mapOrganization(organizationRow)
  const user = mapUser(profileRow, authorization.context.role, organization.id)
  const isManagementRole = authorization.context.role === 'org_admin' || authorization.context.role === 'system_operator'

  // Every operation below is a read. In particular, getCurrentSubscription
  // reads the stored projection and never calls Stripe sync from this path.
  const [stats, subscription, onboarding, roleDashboard, activity, notifications, unreadNotificationCount, educationFollowUp, managementReviewSummary, myTraining] = await Promise.all([
    readOptional(new OrganizationService().getOrganizationStats(organization.id), EMPTY_STATS, 'stats').then(normalizeStats),
    readOptional(new StripeService().getCurrentSubscription(organization.id), null, 'subscription') as Promise<Subscription | null>,
    readOptional(new OnboardingService().getProgress(organization.id), null, 'onboarding') as Promise<OnboardingProgress | null>,
    readOptional(buildHomeRoleDashboard(authorization.context), null, 'role dashboard') as Promise<Awaited<ReturnType<typeof buildHomeRoleDashboard>> | null>,
    readOptional(new ActivityService().getRecentActivity({ organizationId: organization.id, limit: 30 }), [], 'activity') as Promise<ActivityLogEntry[]>,
    readOptional(new NotificationRecipientService(db).list({ organizationId: organization.id, userId }), [], 'notifications') as Promise<Notification[]>,
    readOptional(new NotificationRecipientService(db).unreadCount({ organizationId: organization.id, userId }), 0, 'unread notifications'),
    isManagementRole ? readOptional(buildEducationFollowUp(db, organization.id), null, 'education follow-up') : Promise.resolve(null),
    isManagementRole ? readOptional(new ManagementReviewService().list(organization.id).then(summarizeManagementReviews), null, 'management review') : Promise.resolve(null),
    authorization.context.role === 'user' ? readOptional(buildMyTraining(db, profileRow, organization.id), null, 'my training') : Promise.resolve(null),
  ])

  return {
    user,
    organization,
    stats,
    subscription: subscription as HomeSubscription | null,
    onboarding: onboarding as HomeDashboard['onboarding'],
    roleDashboard: roleDashboard as HomeRoleDashboard | null,
    activity,
    notifications,
    unreadNotificationCount,
    educationFollowUp,
    managementReviewSummary,
    myTraining,
  }
}

export { HomeDashboardUnavailableError }
