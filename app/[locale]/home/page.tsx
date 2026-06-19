'use client'

import { useEffect, useMemo, useState, type ReactNode, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ja, enUS } from 'date-fns/locale'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import OnboardingChecklist from '@/components/home/OnboardingChecklist'
import PhaseSelectionDialog from '@/components/home/PhaseSelectionDialog'
import { UserService } from '@/lib/services/user'
import { OrganizationService } from '@/lib/services/organization'
import { StripeService } from '@/lib/services/stripe'
import { NotificationService, type Notification } from '@/lib/services/notification'
import { ActivityService, type ActivityLogEntry } from '@/lib/services/activity'
import {
  DocumentService,
  APPROVER_DUE_SOON_THRESHOLD_HOURS,
  APPROVER_ESCALATION_THRESHOLD_HOURS,
  APPROVER_HISTORY_WINDOW_DAYS,
  type ApproverDashboardMetrics
} from '@/lib/services/document'
import {
  OnboardingService,
  type IsmsPhase,
  type OnboardingProgress,
  type OnboardingPhaseSummary
} from '@/lib/services/onboarding'
import {
  getHomeQuickLinks,
  getStatCardHref,
  hasStatCardAccess,
  type RoleKey,
  type StatCardId,
  type QuickLink as RoleQuickLink
} from '@/lib/home/roleHomeConfig'

interface DashboardStats {
  userCount: number
  documentCount: number
  pendingReviewDocumentCount: number
  activeTaskCount: number
  overdueTaskCount: number
  activeRiskCount: number
  inProgressAuditCount: number
  taskStatusBreakdown: Record<string, number>
  riskStatusBreakdown: Record<string, number>
  documentStatusBreakdown: Record<string, number>
}

interface EducationFollowUpItem {
  id: string
  title: string
  status: string
  end_date: string | null
  total_records: number
  passed_records: number
  pending_records: number
  active_user_count: number
  is_overdue: boolean
  needs_follow_up: boolean
}

interface EducationFollowUpSummary {
  total_plans: number
  active_user_count: number
  needs_follow_up_count: number
  overdue_count: number
  pending_record_count: number
  items: EducationFollowUpItem[]
}

interface MyTrainingItem {
  id: string
  title: string
  status: string
  end_date: string | null
  result: string
  progress: number
  record_id: string | null
}

interface MyTrainingSummary {
  total: number
  incomplete_count: number
  items: MyTrainingItem[]
}

interface ManagementReviewSummary {
  scheduled_count: number
  in_progress_count: number
  pending_count: number
}

type StatusGroupId = 'tasks' | 'documents' | 'risks'

type ActivityFeedStatus = 'idle' | 'loading' | 'ready' | 'error'
type ActivityFeedFilter = 'all' | 'activity' | 'notification'
type ActivityBadgeKey = 'document' | 'risk' | 'user' | 'system' | 'notification'
type ActivityEntryKey =
  | 'documentCreated'
  | 'documentUpdated'
  | 'documentApproved'
  | 'documentApprovalRequested'
  | 'riskCreated'
  | 'riskUpdated'
  | 'riskDeleted'
  | 'userInvited'
  | 'phaseChanged'

interface ActivityFeedItem {
  id: string
  kind: 'activity' | 'notification'
  icon: string
  badge: string
  badgeTone: string
  title: string
  description: string
  timestamp: string
  href?: string
}

interface ActivityViewConfig {
  badgeKey: ActivityBadgeKey
  entryKey: ActivityEntryKey
  icon: string
  titleSource?: 'actor' | 'resource'
  getHref?: (input: { base: string; log: ActivityLogEntry }) => string | undefined
  getTitle?: (input: {
    resourceName: string
    actorName: string
    log: ActivityLogEntry
    t: ReturnType<typeof useTranslations<'home'>>
  }) => string
}

const STATUS_BREAKDOWN_ORDER: Record<StatusGroupId, string[]> = {
  tasks: ['todo', 'in_progress', 'review', 'done', 'cancelled'],
  documents: ['draft', 'in_review', 'approved', 'obsolete'],
  risks: ['identified', 'analyzing', 'treating', 'monitoring', 'closed']
}

const STATUS_CHART_APPEARANCE: Record<StatusGroupId, Record<string, { strokeClass: string; dotClass: string }>> = {
  tasks: {
    todo: { strokeClass: 'text-slate-300', dotClass: 'bg-slate-300' },
    in_progress: { strokeClass: 'text-indigo-300', dotClass: 'bg-indigo-300' },
    review: { strokeClass: 'text-indigo-500', dotClass: 'bg-indigo-500' },
    done: { strokeClass: 'text-emerald-400', dotClass: 'bg-emerald-400' },
    cancelled: { strokeClass: 'text-text-muted', dotClass: 'bg-slate-400' }
  },
  documents: {
    draft: { strokeClass: 'text-amber-200', dotClass: 'bg-amber-200' },
    in_review: { strokeClass: 'text-amber-400', dotClass: 'bg-amber-400' },
    approved: { strokeClass: 'text-emerald-500', dotClass: 'bg-emerald-500' },
    obsolete: { strokeClass: 'text-text-muted', dotClass: 'bg-slate-400' }
  },
  risks: {
    identified: { strokeClass: 'text-rose-200', dotClass: 'bg-rose-200' },
    analyzing: { strokeClass: 'text-rose-400', dotClass: 'bg-rose-400' },
    treating: { strokeClass: 'text-orange-400', dotClass: 'bg-orange-400' },
    monitoring: { strokeClass: 'text-pink-400', dotClass: 'bg-pink-400' },
    closed: { strokeClass: 'text-emerald-400', dotClass: 'bg-emerald-400' }
  }
}

const DEFAULT_STATUS_APPEARANCE = { strokeClass: 'text-gray-300', dotClass: 'bg-gray-300' }

const ORGANIZATION_STATS_ROLES = new Set<RoleKey>([
  'super_admin',
  'system_operator',
  'org_admin',
])

export default function HomePage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('home')
  const tCommon = useTranslations('common')
  const tPhaseWizard = useTranslations('home.phaseWizard')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [user, setUser] = useState<any>(null)
  const [organization, setOrganization] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [notificationPreview, setNotificationPreview] = useState<Notification[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress | null>(null)
  const [phaseWizardOpen, setPhaseWizardOpen] = useState(false)
  const [phaseSelection, setPhaseSelection] = useState<IsmsPhase | ''>('')
  const [phaseSubmitLoading, setPhaseSubmitLoading] = useState(false)
  const [phaseSubmitError, setPhaseSubmitError] = useState<string | null>(null)
  const [approverMetrics, setApproverMetrics] = useState<ApproverDashboardMetrics | null>(null)
  const [approverMetricsStatus, setApproverMetricsStatus] = useState<ApproverMetricsStatus>('idle')
  const [activityItems, setActivityItems] = useState<ActivityFeedItem[]>([])
  const [activityStatus, setActivityStatus] = useState<ActivityFeedStatus>('idle')
  const [educationFollowUp, setEducationFollowUp] = useState<EducationFollowUpSummary | null>(null)
  const [managementReviewSummary, setManagementReviewSummary] = useState<ManagementReviewSummary | null>(null)
  const [myTraining, setMyTraining] = useState<MyTrainingSummary | null>(null)
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  const stripeConfigured = publishableKey.trim() !== '' && !publishableKey.includes('...')

  const onboardingSuccess = useMemo(() => searchParams?.get('onboarding') === 'success', [searchParams])
  const qaHomeMode = useMemo(() => {
    if (process.env.NODE_ENV === 'production') {
      return null
    }
    return searchParams?.get('qa_home') ?? null
  }, [searchParams])
  const simulateStatsOffline = qaHomeMode === 'stats-offline'
  const isQaSimulation = qaHomeMode !== null
  const activityService = useMemo(() => new ActivityService(), [])

  useEffect(() => {
    const userService = new UserService()
    const organizationService = new OrganizationService()
    const stripeService = new StripeService()
    const onboardingService = new OnboardingService()
    const documentService = new DocumentService()

    const fallbackUserId = 'qa-simulated-user'
    const fallbackOrgId = 'qa-simulated-org'

    let cancelled = false

    async function load() {
      const pendingWarnings: string[] = []
      setActivityStatus('loading')
      try {
        let currentUser = await userService.getCurrentUser().catch(err => {
          console.warn('[Dashboard] failed to load current user', err)
          return null
        })

        if (!currentUser && isQaSimulation) {
          pendingWarnings.push(t('warnings.sessionFallback'))
          currentUser = {
            id: fallbackUserId,
            full_name: t('warnings.fallbackUserName'),
            email: 'qa-user@example.com',
            role: 'org_admin'
          } as any
        }

        if (!currentUser) {
          setWarnings([])
          router.push(`/${locale}/auth/login`)
          return
        }

        let currentOrganization = await organizationService.getCurrentOrganization().catch(err => {
          console.warn('[Dashboard] failed to load organization', err)
          return null
        })

        if (!currentOrganization && isQaSimulation) {
          pendingWarnings.push(t('warnings.organizationFallback'))
          currentOrganization = {
            id: fallbackOrgId,
            name: t('warnings.fallbackOrganizationName')
          } as any
        }

        if (!currentOrganization) {
          if (!cancelled) {
            setError(t('errors.organizationNotFound'))
            setWarnings([])
          }
          return
        }

        if (isQaSimulation) {
          pendingWarnings.push(t('warnings.simulationActive'))
        }

        const resolvedUser = currentUser
        const resolvedOrganization = currentOrganization

        const statsPromise = (async () => {
          if (simulateStatsOffline || resolvedOrganization.id === fallbackOrgId) {
            pendingWarnings.push(t('warnings.statsUnavailable'))
            return null
          }
          if (!ORGANIZATION_STATS_ROLES.has(resolvedUser.role)) {
            return null
          }
          try {
            return await organizationService.getOrganizationStats(resolvedOrganization.id)
          } catch (statsError) {
            console.warn('[Dashboard] organization stats load failed', statsError)
            pendingWarnings.push(t('warnings.statsUnavailable'))
            return null
          }
        })()

        let activityErrored = false
        const activityPromise =
          simulateStatsOffline || resolvedOrganization.id === fallbackOrgId
            ? Promise.resolve<ActivityLogEntry[]>([])
            : activityService
                .getRecentActivity({ organizationId: resolvedOrganization.id, limit: 30 })
                .catch(err => {
                  console.warn('[Dashboard] activity load failed', err)
                  activityErrored = true
                  return [] as ActivityLogEntry[]
                })

        const [
          currentStats,
          currentSubscription,
          unreadCountValue,
          notificationItems,
          onboarding,
          activityLogs,
          educationFollowUpSummary,
          managementReviews,
          myTrainingSummary
        ] = await Promise.all([
          statsPromise,
          stripeService.getCurrentSubscription(resolvedOrganization.id).catch(err => {
            console.warn('[Dashboard] subscription load failed', err)
            return null
          }),
          NotificationService.getUnreadCount(resolvedUser.id).catch(err => {
            console.warn('[Dashboard] unread count load failed', err)
            return 0
          }),
          NotificationService.getNotifications(resolvedUser.id).catch(err => {
            console.warn('[Dashboard] notifications load failed', err)
            return []
          }),
          onboardingService.getProgress(resolvedOrganization.id).catch(err => {
            console.warn('[Dashboard] onboarding progress load failed', err)
            return null
          }),
          activityPromise,
          ORGANIZATION_STATS_ROLES.has(resolvedUser.role) && resolvedOrganization.id !== fallbackOrgId
            ? fetch('/api/education/follow-up', {
                credentials: 'include',
                cache: 'no-store'
              })
                .then(async response => {
                  if (!response.ok) throw new Error(`education follow-up ${response.status}`)
                  const payload = await response.json()
                  return payload.data as EducationFollowUpSummary
                })
                .catch(err => {
                  console.warn('[Dashboard] education follow-up load failed', err)
                  return null
                })
            : Promise.resolve(null),
          ORGANIZATION_STATS_ROLES.has(resolvedUser.role) && resolvedOrganization.id !== fallbackOrgId
            ? fetch('/api/management-reviews', {
                credentials: 'include',
                cache: 'no-store'
              })
                .then(async response => {
                  if (!response.ok) throw new Error(`management reviews ${response.status}`)
                  const payload = await response.json()
                  return (payload.data ?? []) as Array<{ status?: string }>
                })
                .catch(err => {
                  console.warn('[Dashboard] management reviews load failed', err)
                  return [] as Array<{ status?: string }>
                })
            : Promise.resolve([] as Array<{ status?: string }>),
          resolvedUser.role === 'user' && resolvedOrganization.id !== fallbackOrgId
            ? fetch('/api/education/my-training', {
                credentials: 'include',
                cache: 'no-store'
              })
                .then(async response => {
                  if (!response.ok) throw new Error(`my training ${response.status}`)
                  const payload = await response.json()
                  return payload.data as MyTrainingSummary
                })
                .catch(err => {
                  console.warn('[Dashboard] my training load failed', err)
                  return null
                })
            : Promise.resolve(null)
        ])

        let resolvedSubscription = currentSubscription

        if (!resolvedSubscription && stripeConfigured) {
          try {
            resolvedSubscription = await stripeService.syncSubscriptionFromStripe(resolvedOrganization.id)
          } catch (syncError) {
            console.warn('[Dashboard] subscription sync skipped', syncError)
          }
        }

        let nextApproverMetrics: ApproverDashboardMetrics | null = null
        let nextApproverMetricsStatus: ApproverMetricsStatus = 'idle'

        if (resolvedUser.role === 'approver') {
          nextApproverMetricsStatus = 'loading'
          if (simulateStatsOffline || resolvedOrganization.id === fallbackOrgId) {
            nextApproverMetrics = buildApproverFallbackMetrics()
            nextApproverMetricsStatus = 'ready'
          } else {
            try {
              nextApproverMetrics = await documentService.getApproverDashboardMetrics(resolvedOrganization.id)
              nextApproverMetricsStatus = 'ready'
            } catch (metricsError) {
              console.warn('[Dashboard] approver metrics load failed', metricsError)
              nextApproverMetricsStatus = 'error'
            }
          }
        }

        if (!cancelled) {
          setError(null)
          setUser(resolvedUser)
          setOrganization(resolvedOrganization)
          setStats({
            userCount: currentStats?.userCount ?? 0,
            documentCount: currentStats?.documentCount ?? 0,
            pendingReviewDocumentCount: currentStats?.pendingReviewDocumentCount ?? 0,
            activeTaskCount: currentStats?.activeTaskCount ?? 0,
            overdueTaskCount: currentStats?.overdueTaskCount ?? 0,
            activeRiskCount: currentStats?.activeRiskCount ?? 0,
            inProgressAuditCount: currentStats?.inProgressAuditCount ?? 0,
            taskStatusBreakdown: currentStats?.taskStatusBreakdown ?? {},
            riskStatusBreakdown: currentStats?.riskStatusBreakdown ?? {},
            documentStatusBreakdown: currentStats?.documentStatusBreakdown ?? {}
          })
          setSubscription(resolvedSubscription)
          const notificationsList = notificationItems ?? []
          setUnreadNotificationCount(unreadCountValue ?? 0)
          setNotificationPreview(notificationsList.slice(0, 3))
          const resolvedActivityItems =
            simulateStatsOffline || resolvedOrganization.id === fallbackOrgId
              ? buildActivityFallbackItems(locale, t)
              : buildActivityFeedItems({
                  logs: activityLogs ?? [],
                  notifications: notificationsList,
                  locale,
                  t
                })
          setActivityItems(resolvedActivityItems)
          setActivityStatus(activityErrored ? 'error' : 'ready')
          setOnboardingProgress(onboarding ?? null)
          setEducationFollowUp(educationFollowUpSummary ?? null)
          const scheduledManagementReviews = managementReviews.filter(review => review.status === 'scheduled').length
          const inProgressManagementReviews = managementReviews.filter(review => review.status === 'in_progress').length
          setManagementReviewSummary({
            scheduled_count: scheduledManagementReviews,
            in_progress_count: inProgressManagementReviews,
            pending_count: scheduledManagementReviews + inProgressManagementReviews
          })
          setMyTraining(myTrainingSummary ?? null)
          setWarnings(Array.from(new Set(pendingWarnings)))
          const shouldOpenPhaseWizard =
            resolvedUser.role === 'system_operator' && !resolvedOrganization.isms_phase
          setPhaseWizardOpen(shouldOpenPhaseWizard)
          setPhaseSelection(prev => prev || (resolvedOrganization.isms_phase as IsmsPhase | '') || '')
          setPhaseSubmitError(null)
          setApproverMetrics(nextApproverMetrics)
          setApproverMetricsStatus(nextApproverMetricsStatus)
        }
      } catch (err: any) {
        console.error('[Dashboard] data load failed', err)
        if (!cancelled) {
          setError(err.message || t('errors.loadFailed'))
          setWarnings([])
          setActivityStatus('error')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [activityService, isQaSimulation, locale, router, simulateStatsOffline, stripeConfigured, t])

  const handlePhaseWizardSubmit = async () => {
    if (!organization) return
    if (!phaseSelection) {
      setPhaseSubmitError(tPhaseWizard('validation'))
      return
    }

    setPhaseSubmitLoading(true)
    setPhaseSubmitError(null)

    try {
      const organizationService = new OrganizationService()
      const updatedOrganization = await organizationService.updateIsmsPhase(
        organization.id,
        phaseSelection as IsmsPhase,
        'wizard'
      )
      const phaseSetAt = updatedOrganization?.isms_phase_set_at ?? new Date().toISOString()
      setOrganization((prev: typeof organization) =>
        prev
          ? {
              ...prev,
              ...(updatedOrganization ?? {}),
              isms_phase: phaseSelection,
              isms_phase_set_at: phaseSetAt
            }
          : prev
      )
      const onboardingService = new OnboardingService()
      const refreshed = await onboardingService.getProgress(organization.id).catch(progressError => {
        console.warn('[Dashboard] onboarding progress refresh after phase update failed', progressError)
        return null
      })
      setOnboardingProgress(refreshed)
      setPhaseWizardOpen(false)
    } catch (err) {
      console.error('[Dashboard] phase wizard update failed', err)
      setPhaseSubmitError(tPhaseWizard('error'))
    } finally {
      setPhaseSubmitLoading(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout locale={locale}>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout locale={locale}>
        <div className="mx-auto mt-12 max-w-3xl">
          <ErrorMessage message={error} />
        </div>
      </DashboardLayout>
    )
  }

  if (!user || !organization) {
    return (
      <DashboardLayout locale={locale}>
        <div className="flex h-64 items-center justify-center text-sm text-text-muted">
          {tCommon('loading')}
        </div>
      </DashboardLayout>
    )
  }

  const displayName = user.full_name || user.name || user.email
  const subscriptionStatus: string = subscription?.status ?? 'trialing'
  const pricingPlan = subscription?.pricing_plan?.name || t('subscription.trialPlan')
  const role: RoleKey = (user.role || 'user') as RoleKey

  const quickLinks = getHomeQuickLinks(role, locale, t)
  const insights = getInsights({ stats, subscriptionStatus, subscription, locale, t })
  const phaseSummary = onboardingProgress?.phase ?? buildFallbackPhaseSummary(organization)
  const effectivePhase = phaseSummary.effective
  const statCards = getPhaseAwareStatCards(effectivePhase, stats, role, locale, t, approverMetrics)

  return (
    <DashboardLayout
      locale={locale}
      headerSummary={{
        name: displayName,
        organizationName: organization.name,
        role
      }}
    >
      <div className="space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {onboardingSuccess && (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-1 text-emerald-800 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  {t('onboarding.successTitle', { name: displayName })}
                </h2>
                <p className="text-sm text-emerald-700">{t('onboarding.successDescription')}</p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 md:mt-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface/70 px-3 py-1 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t('hero.badges.onboardingComplete')}
                </span>
              </div>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div
            data-testid="home-warning"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-400 text-xs font-semibold">!</span>
              <div className="space-y-2">
                <p className="font-semibold text-amber-900">{t('warnings.title')}</p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700">
                  {warnings.map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <HomeHero
          name={displayName}
          organizationName={organization.name}
          role={role}
          planLabel={pricingPlan}
          subscriptionStatus={subscriptionStatus}
          nextBilling={subscription?.current_period_end}
          locale={locale}
          t={t}
        />

        <PhaseSummaryCard locale={locale} t={t} phase={phaseSummary} />

        <HomeActionRow locale={locale} unreadCount={unreadNotificationCount} t={t} />

        <StatGrid cards={statCards} />

        <StatusBreakdown stats={stats} t={t} />

        <OnboardingChecklist
          locale={locale}
          progress={onboardingProgress}
          isLoading={isLoading}
          onRequestPhaseSetup={user.role === 'system_operator' ? () => setPhaseWizardOpen(true) : undefined}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <SubscriptionCard
            t={t}
            status={subscriptionStatus}
            planLabel={pricingPlan}
            subscription={subscription}
            locale={locale}
          />
          <OrganizationCard organization={organization} t={t} />
          <InsightsCard insights={insights} t={t} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivityFeed
            locale={locale}
            items={activityItems}
            status={activityStatus}
            unreadCount={unreadNotificationCount}
            t={t}
          />
          <NotificationPreview
            locale={locale}
            notifications={notificationPreview}
            unreadCount={unreadNotificationCount}
            t={t}
          />
        </div>

        <QuickLinksSection quickLinks={quickLinks} t={t} />
        <RoleDashboard
          role={role}
          locale={locale}
          t={t}
          stats={stats}
          approverMetrics={approverMetrics}
          approverMetricsStatus={approverMetricsStatus}
          educationFollowUp={educationFollowUp}
          managementReviewSummary={managementReviewSummary}
          myTraining={myTraining}
        />
      </div>
      <PhaseSelectionDialog
        open={phaseWizardOpen}
        selectedPhase={phaseSelection}
        onSelect={value => {
          setPhaseSelection(value)
          setPhaseSubmitError(null)
        }}
        onSubmit={handlePhaseWizardSubmit}
        loading={phaseSubmitLoading}
        error={phaseSubmitError ?? undefined}
      />
    </DashboardLayout>
  )
}

interface StatCardProps {
  id: StatCardId
  label: string
  value: number
  helper: string
  tone: 'indigo' | 'cyan' | 'rose' | 'emerald' | 'amber'
  href: string
  ariaLabel: string
  ctaLabel: string
  disabled?: boolean
}

function StatGrid({ cards }: { cards: StatCardProps[] }) {
  const wrapperClasses =
    'group block w-full appearance-none text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => {
        const content = (
          <article
            className={`home-theme-card relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition duration-200 group-hover:border-border group-hover:shadow-md ${
              card.disabled ? 'opacity-70' : ''
            }`}
          >
            <div
              className={`absolute inset-x-4 top-4 h-12 rounded-full blur-xl ${toneToGlow(card.tone)}`}
              aria-hidden
            />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <header className="space-y-1">
                <p className="text-sm font-medium text-text-muted">{card.label}</p>
                <p
                  data-testid={`home-stat-${card.id}`}
                  className="text-3xl font-semibold tracking-tight text-text-primary"
                >
                  {card.value}
                </p>
              </header>
              <footer className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <span className="flex-1 text-left">{card.helper}</span>
                <span className="inline-flex items-center gap-1 font-medium text-text-secondary">
                  {card.ctaLabel}
                  <span aria-hidden>{'>'}</span>
                </span>
              </footer>
            </div>
          </article>
        )

        if (card.disabled) {
          return (
            <button
              key={card.id}
              type="button"
              aria-label={card.ariaLabel}
              aria-disabled="true"
              data-testid={`home-stat-card-${card.id}`}
              className={`${wrapperClasses} cursor-not-allowed`}
              disabled
            >
              {content}
            </button>
          )
        }

        return (
          <Link
            key={card.id}
            href={card.href}
            aria-label={card.ariaLabel}
            data-testid={`home-stat-card-${card.id}`}
            className={wrapperClasses}
          >
            {content}
          </Link>
        )
      })}
    </section>
  )
}

const PHASE_BADGE_STYLES: Record<IsmsPhase, string> = {
  initial: 'bg-indigo-100 text-indigo-700',
  surveillance: 'bg-amber-100 text-amber-700'
}

function getPhaseAwareStatCards(
  phase: IsmsPhase,
  stats: DashboardStats | null,
  role: RoleKey,
  locale: string,
  t: ReturnType<typeof useTranslations<'home'>>,
  approverMetrics?: ApproverDashboardMetrics | null
): StatCardProps[] {
  const statCardCtaLabel = t('stats.drilldown.cta')
  const baseCards: StatCardProps[] = [
    {
      id: 'users',
      label: t('stats.activeUsers'),
      value: stats?.userCount ?? 0,
      helper: t('stats.usersHint'),
      tone: 'indigo',
      href: getStatCardHref('users', role, locale),
      ariaLabel: t('stats.drilldown.users'),
      ctaLabel: statCardCtaLabel,
      disabled: !hasStatCardAccess('users', role)
    },
    {
      id: 'documents',
      label: t('stats.documents'),
      value: stats?.documentCount ?? 0,
      helper: t('stats.documentsHint', { pending: stats?.pendingReviewDocumentCount ?? 0 }),
      tone: 'cyan',
      href: getStatCardHref('documents', role, locale),
      ariaLabel: t('stats.drilldown.documents'),
      ctaLabel: statCardCtaLabel,
      disabled: !hasStatCardAccess('documents', role)
    },
    {
      id: 'risks',
      label: t('stats.openRisks'),
      value: stats?.activeRiskCount ?? 0,
      helper: t('stats.risksHint'),
      tone: 'rose',
      href: getStatCardHref('risks', role, locale),
      ariaLabel: t('stats.drilldown.risks'),
      ctaLabel: statCardCtaLabel,
      disabled: !hasStatCardAccess('risks', role)
    },
    {
      id: 'tasks',
      label: t('stats.activeTasks'),
      value: stats?.activeTaskCount ?? 0,
      helper: t('stats.tasksHint', { overdue: stats?.overdueTaskCount ?? 0 }),
      tone: 'emerald',
      href: getStatCardHref('tasks', role, locale),
      ariaLabel: t('stats.drilldown.tasks'),
      ctaLabel: statCardCtaLabel,
      disabled: !hasStatCardAccess('tasks', role)
    }
  ]

  if (role === 'approver') {
    return [
      {
        ...baseCards.find(card => card.id === 'documents')!,
        label: t('stats.approverPendingApprovals'),
        value: approverMetrics?.pendingCount ?? stats?.pendingReviewDocumentCount ?? 0,
        helper: t('stats.approverPendingApprovalsHint'),
        href: getStatCardHref('documents', role, locale),
        ariaLabel: t('stats.drilldown.approvals')
      },
      {
        ...baseCards.find(card => card.id === 'tasks')!,
        label: t('stats.approverDueSoon'),
        value: approverMetrics?.dueSoonCount ?? 0,
        helper: t('stats.approverDueSoonHint', {
          hours: approverMetrics?.dueSoonHours ?? APPROVER_DUE_SOON_THRESHOLD_HOURS
        }),
        href: getStatCardHref('tasks', role, locale),
        ariaLabel: t('stats.drilldown.dueApprovals')
      },
      baseCards.find(card => card.id === 'risks')!
    ]
  }

  if (phase === 'surveillance') {
    return [
      {
        id: 'audits',
        label: t('stats.auditsInProgress'),
        value: stats?.inProgressAuditCount ?? 0,
        helper: t('stats.auditsHint'),
        tone: 'amber',
        href: getStatCardHref('audits', role, locale),
        ariaLabel: t('stats.drilldown.audits'),
        ctaLabel: statCardCtaLabel,
        disabled: !hasStatCardAccess('audits', role)
      },
      baseCards.find(card => card.id === 'tasks')!,
      baseCards.find(card => card.id === 'documents')!,
      baseCards.find(card => card.id === 'risks')!
    ]
  }

  return baseCards
}

function PhaseSummaryCard({
  phase,
  locale,
  t
}: {
  phase: OnboardingPhaseSummary
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  const badgeTone = PHASE_BADGE_STYLES[phase.effective]
  const label = t(`phaseSummary.labels.${phase.effective}`)
  const description = t(`phaseSummary.descriptions.${phase.effective}`)
  const statusText = phase.setAt
    ? t('phaseSummary.status.set', { date: formatPhaseDate(phase.setAt, locale) })
    : t('phaseSummary.status.unset')

  return (
    <section className="home-theme-card rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeTone}`}>
            {label}
          </div>
          <p className="text-sm text-text-secondary">{description}</p>
          <p className="text-xs text-text-muted">{statusText}</p>
          {phase.alert === 'missing' && (
            <p className="text-xs font-medium text-amber-700">{t('phaseSummary.alert')}</p>
          )}
        </div>
        <Link
          href={`/${locale}/settings/organization`}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-border"
        >
          {t('phaseSummary.cta')}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  )
}

function formatPhaseDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(value))
  } catch (err) {
    console.warn('[Home] failed to format phase date', err)
    return value
  }
}

function buildFallbackPhaseSummary(organization: {
  isms_phase?: unknown
  isms_phase_set_at?: string | null
}): OnboardingPhaseSummary {
  const current = normalizeIsmsPhase(organization.isms_phase)

  return {
    current,
    effective: current ?? 'initial',
    alert: current ? null : 'missing',
    setAt: organization.isms_phase_set_at ?? null
  }
}

function normalizeIsmsPhase(value: unknown): IsmsPhase | null {
  return value === 'initial' || value === 'surveillance' ? value : null
}

function StatusBreakdown({
  stats,
  t
}: {
  stats: DashboardStats | null
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  if (!stats) {
    return null
  }

  const groups: Array<{
    id: StatusGroupId
    title: string
    data: Record<string, number>
  }> = [
    { id: 'tasks', title: t('statusBreakdown.tasks'), data: stats.taskStatusBreakdown },
    { id: 'documents', title: t('statusBreakdown.documents'), data: stats.documentStatusBreakdown },
    { id: 'risks', title: t('statusBreakdown.risks'), data: stats.riskStatusBreakdown }
  ]

  const hasData = groups.some(group => Object.keys(group.data).length > 0)
  if (!hasData) {
    return null
  }

  return (
    <section className="home-theme-card rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{t('statusBreakdown.title')}</h3>
          <p className="text-sm text-text-secondary">{t('statusBreakdown.subtitle')}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {groups.map(group => {
          const entries = Object.entries(group.data)
          const order = STATUS_BREAKDOWN_ORDER[group.id]
          const sortedEntries = entries.sort((a, b) => {
            const indexA = order.indexOf(a[0])
            const indexB = order.indexOf(b[0])
            if (indexA === -1 && indexB === -1) {
              return a[0].localeCompare(b[0])
            }
            if (indexA === -1) return 1
            if (indexB === -1) return -1
            return indexA - indexB
          })
          const total = sortedEntries.reduce((sum, [, count]) => sum + count, 0)
          const chartSegments = sortedEntries.map(([status, count]) => {
            const appearance = STATUS_CHART_APPEARANCE[group.id][status] ?? DEFAULT_STATUS_APPEARANCE
            return {
              status,
              value: count,
              percent: total > 0 ? count / total : 0,
              strokeClass: appearance.strokeClass
            }
          })
          const chartAria = t('statusBreakdown.chart.aria', { module: group.title })

          return (
            <div key={group.id} className="rounded-xl border border-border bg-surface-elevated/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium text-text-secondary">{group.title}</h4>
                  <p className="text-xs text-text-muted">{t('statusBreakdown.chart.summary', { total })}</p>
                </div>
                <KpiDonutChart
                  ariaLabel={chartAria}
                  emptyLabel={t('statusBreakdown.chart.empty')}
                  segments={chartSegments}
                  summaryLabel={t('statusBreakdown.chart.total')}
                  total={total}
                />
              </div>
              {sortedEntries.length === 0 ? (
                <p className="mt-3 text-xs text-text-muted">{t('statusBreakdown.empty')}</p>
              ) : (
                <dl className="mt-4 space-y-2" aria-label={t('statusBreakdown.chart.legend')}>
                  {sortedEntries.map(([status, count]) => {
                    const appearance = STATUS_CHART_APPEARANCE[group.id][status] ?? DEFAULT_STATUS_APPEARANCE
                    const percent = total > 0 ? Math.round((count / total) * 100) : 0

                    return (
                      <div key={`${group.id}-${status}`} className="flex items-center justify-between text-sm">
                        <dt className="flex items-center gap-2 text-text-secondary">
                          <span className={`h-2 w-2 rounded-full ${appearance.dotClass}`} aria-hidden="true" />
                          {t(`statusBreakdown.labels.${group.id}.${status}`, {
                            defaultValue: status
                          })}
                        </dt>
                        <dd className="font-semibold text-text-primary">
                          {count}
                          {total > 0 ? (
                            <span className="ml-1 text-xs font-medium text-text-muted">({percent}%)</span>
                          ) : null}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

type ChartSegmentDisplay = {
  status: string
  value: number
  percent: number
  strokeClass: string
}

function KpiDonutChart({
  segments,
  total,
  summaryLabel,
  emptyLabel,
  ariaLabel
}: {
  segments: ChartSegmentDisplay[]
  total: number
  summaryLabel: string
  emptyLabel: string
  ariaLabel: string
}) {
  const radius = 36
  const circumference = 2 * Math.PI * radius

  if (!total || total <= 0 || segments.length === 0) {
    return (
      <div className="flex h-24 w-24 items-center justify-center text-center text-[10px] text-text-muted">
        {emptyLabel}
      </div>
    )
  }

  let cumulativeLength = 0

  return (
    <div className="relative h-24 w-24" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <circle
          className="text-gray-200"
          stroke="currentColor"
          strokeWidth={10}
          fill="transparent"
          cx={60}
          cy={60}
          r={radius}
          strokeDasharray={`${circumference} ${circumference}`}
        />
        {segments.map(segment => {
          if (segment.value <= 0 || segment.percent <= 0) {
            return null
          }
          const length = segment.percent * circumference
          const element = (
            <circle
              key={segment.status}
              className={segment.strokeClass}
              stroke="currentColor"
              strokeWidth={10}
              strokeLinecap="round"
              fill="transparent"
              cx={60}
              cy={60}
              r={radius}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-cumulativeLength}
              transform="rotate(-90 60 60)"
            />
          )
          cumulativeLength += length
          return element
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{summaryLabel}</span>
        <span className="text-lg font-semibold text-text-primary">{total}</span>
      </div>
    </div>
  )
}

function HomeActionRow({
  locale,
  unreadCount,
  t
}: {
  locale: string
  unreadCount: number
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  const base = `/${locale}`

  const actions: Array<{
    id: string
    title: string
    description: string
    href: string
    badge: string
    badgeTone: string
  }> = [
    {
      id: 'notifications',
      title: t('actionRow.notifications.title'),
      description: t('actionRow.notifications.description'),
      href: `${base}/notifications`,
      badge: t('notificationPreview.unreadLabel', { count: unreadCount }),
      badgeTone: unreadCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-surface-elevated text-text-secondary'
    },
    {
      id: 'settings',
      title: t('actionRow.settings.title'),
      description: t('actionRow.settings.description'),
      href: `${base}/settings/notifications`,
      badge: t('actionRow.settings.badge'),
      badgeTone: 'bg-surface-elevated text-text-secondary'
    }
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {actions.map(action => (
        <Link
          key={action.id}
          href={action.href}
          className="home-theme-card group flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <div className="space-y-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${action.badgeTone}`}>
              {action.badge}
            </span>
            <h2 className="text-base font-semibold text-text-primary">{action.title}</h2>
            <p className="text-sm text-text-secondary">{action.description}</p>
          </div>
          <div className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
            {t('actionRow.cta')}
            <svg
              className="h-3 w-3 transition group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
            </svg>
          </div>
        </Link>
      ))}
    </section>
  )
}

function toneToGlow(tone: StatCardProps['tone']) {
  switch (tone) {
    case 'indigo':
      return 'bg-indigo-200/60'
    case 'cyan':
      return 'bg-cyan-200/60'
    case 'rose':
      return 'bg-rose-200/60'
    case 'amber':
      return 'bg-amber-200/60'
    case 'emerald':
    default:
      return 'bg-emerald-200/60'
  }
}

function buildApproverFallbackMetrics(): ApproverDashboardMetrics {
  return {
    pendingCount: 4,
    dueSoonCount: 1,
    escalationCount: 1,
    historyCount: 6,
    dueSoonHours: APPROVER_DUE_SOON_THRESHOLD_HOURS,
    escalationHours: APPROVER_ESCALATION_THRESHOLD_HOURS,
    historyWindowDays: APPROVER_HISTORY_WINDOW_DAYS,
    lastRefreshedAt: new Date().toISOString()
  }
}

function HomeHero({
  name,
  organizationName,
  role,
  planLabel,
  subscriptionStatus,
  nextBilling,
  locale,
  t
}: {
  name: string
  organizationName: string
  role: RoleKey
  planLabel: string
  subscriptionStatus: string
  nextBilling?: string | null
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  const greeting = getGreeting(name, t)
  const formattedBilling = formatDate(nextBilling, locale)

  return (
    <section className="home-theme-card overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white">
      <div className="relative px-6 py-8 sm:px-8">
        <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-full bg-indigo-100 blur-3xl sm:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-indigo-600">
              <span className="rounded-full bg-surface px-3 py-1 font-medium shadow-sm">
                {t(`hero.badges.role.${role}` as any)}
              </span>
              <span className="rounded-full bg-indigo-600/10 px-3 py-1 font-medium text-indigo-700">
                {t(`subscription.status.${subscriptionStatus}` as any)} · {planLabel}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {greeting}
            </h1>
            <p className="text-sm text-text-secondary">
              {t('hero.subtitle', { organization: organizationName })}
            </p>
          </div>
          <div className="flex min-w-[220px] flex-col rounded-2xl border border-indigo-100 bg-surface/80 p-4 text-sm shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">{t('hero.plan')}</span>
              <span className="font-medium text-text-primary">{planLabel}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-text-muted">{t('hero.nextBilling')}</span>
              <span className="font-medium text-text-primary">{formattedBilling}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SubscriptionCard({
  t,
  status,
  planLabel,
  subscription,
  locale
}: {
  t: ReturnType<typeof useTranslations<'home'>>
  status: string
  planLabel: string
  subscription: any
  locale: string
}) {
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  const stripeConfigured = /^pk_(test|live)_/.test(stripeKey) && stripeKey !== 'pk_test_placeholder'
  const manageLink = `/${locale}/settings/subscription`
  const pricingLink = `/${locale}/pricing`

  return (
    <section className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm" data-testid="recent-activity-feed">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{t('subscription.title')}</h2>
          <p className="text-xs text-text-muted">{t('subscription.subtitle')}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusChipTone(status)}`}
        >
          {t(`subscription.status.${status}` as any)}
        </span>
      </header>
      <dl className="space-y-3 text-sm text-text-secondary">
        <div className="flex items-center justify-between">
          <dt>{t('subscription.plan')}</dt>
          <dd className="font-medium text-text-primary">{planLabel}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>{t('subscription.nextBilling')}</dt>
          <dd>{formatDate(subscription?.current_period_end, locale)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>{t('subscription.trialRemains')}</dt>
          <dd>{subscription?.trial_end ? formatDate(subscription.trial_end, locale) : '—'}</dd>
        </div>
      </dl>

      {stripeConfigured ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-4 py-3 text-xs text-text-secondary">
          <span>{t('subscription.manageHint')}</span>
          <Link
            href={manageLink}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
          >
            {t('subscription.manageCta')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <div className="flex items-start gap-2">
            <span className="mt-[3px] inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-400 text-[10px] font-semibold">i</span>
            <p className="flex-1">{t('subscription.mockMode.description')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-amber-900">{t('subscription.mockMode.statusLabel')}</span>
            <Link
              href={pricingLink}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              {t('subscription.mockMode.cta')}
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

function statusChipTone(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800'
    case 'trialing':
      return 'bg-indigo-100 text-indigo-800'
    case 'past_due':
    case 'unpaid':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-surface-elevated text-text-secondary'
  }
}

function OrganizationCard({ organization, t }: { organization: any; t: ReturnType<typeof useTranslations<'home'>> }) {
  return (
    <section className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <header>
        <h2 className="text-base font-semibold text-text-primary">{t('organization.title')}</h2>
        <p className="text-xs text-text-muted">{t('organization.subtitle')}</p>
      </header>
      <dl className="space-y-3 text-sm text-text-secondary">
        <div className="flex items-center justify-between">
          <dt>{t('organization.name')}</dt>
          <dd className="font-medium text-text-primary">{organization.name}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>{t('organization.employeeRange')}</dt>
          <dd>{organization.employee_count_range || t('organization.notSet')}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>{t('organization.industry')}</dt>
          <dd>{organization.industry || t('organization.notSet')}</dd>
        </div>
      </dl>
    </section>
  )
}

function InsightsCard({ insights, t }: { insights: string[]; t: ReturnType<typeof useTranslations<'home'>> }) {
  return (
    <section className="home-theme-card flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <header>
        <h2 className="text-base font-semibold text-text-primary">{t('insights.title')}</h2>
        <p className="text-xs text-text-muted">{t('insights.subtitle')}</p>
      </header>
      <div className="flex-1">
        {insights.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-elevated/60 p-4 text-xs text-text-muted">
            {t('insights.empty')}
          </div>
        ) : (
          <ul className="space-y-3 text-sm text-text-secondary">
            {insights.map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function QuickLinksSection({ quickLinks, t }: { quickLinks: RoleQuickLink[]; t: ReturnType<typeof useTranslations<'home'>> }) {
  if (quickLinks.length === 0) return null

  return (
    <section data-testid="home-quick-links" className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{t('quickLinks.title')}</h2>
          <p className="text-xs text-text-muted">{t('quickLinks.subtitle')}</p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(link => (
          <a
            key={link.href}
            href={link.href}
            className="home-theme-card group flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
          >
            <div className="space-y-2">
              <div className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-medium ${link.badgeTone}`}>
                {link.badge}
              </div>
              <h3 className="text-sm font-semibold text-text-primary">{link.title}</h3>
              <p className="text-xs text-text-muted">{link.description}</p>
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
              {t('quickLinks.cta')}
              <svg className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
              </svg>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

function RecentActivityFeed({
  locale,
  items,
  status,
  unreadCount,
  t
}: {
  locale: string
  items: ActivityFeedItem[]
  status: ActivityFeedStatus
  unreadCount: number
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  const [filter, setFilter] = useState<ActivityFeedFilter>('all')
  const filteredItems = items.filter(item => {
    if (filter === 'all') return true
    return item.kind === filter
  })

  const filters: Array<{ id: ActivityFeedFilter; label: string }> = [
    { id: 'all', label: t('recentActivity.filters.all') },
    { id: 'activity', label: t('recentActivity.filters.activity') },
    { id: 'notification', label: t('recentActivity.filters.notifications') }
  ]

  return (
    <section className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{t('recentActivity.title')}</h2>
          <p className="text-xs text-text-muted">{t('recentActivity.subtitle')}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {filters.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  filter === option.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Link
            href={`/${locale}/notifications`}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            {t('notificationPreview.viewAll')}
            <span
              data-testid="recent-activity-unread"
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                unreadCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-surface-elevated text-text-secondary'
              }`}
            >
              {t('notificationPreview.unreadLabel', { count: unreadCount })}
            </span>
          </Link>
        </div>
      </header>

      {status === 'loading' ? (
        <div className="space-y-3">
          {[0, 1, 2].map(index => (
            <div key={index} className="animate-pulse rounded-xl border border-border bg-surface-elevated/80 p-4">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-surface-elevated" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-surface-elevated" />
                  <div className="h-2 w-1/2 rounded bg-surface-elevated" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-elevated/80 p-4 text-sm text-text-muted">
          {status === 'error' ? t('recentActivity.loadError') : t('recentActivity.empty')}
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredItems.map(item => {
            const content = (
              <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/80 p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                <span className="text-xl" aria-hidden>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${item.badgeTone}`}>
                      {item.badge}
                    </span>
                    <span className="text-[11px] text-text-muted">{formatRelativeTime(item.timestamp, locale)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">{item.description}</p>
                </div>
              </div>
            )

            return (
            <li key={item.id} data-testid={`recent-activity-${item.id}`}>
                {item.href ? (
                  <Link href={item.href} className="block">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function NotificationPreview({
  locale,
  notifications,
  unreadCount,
  t
}: {
  locale: string
  notifications: Notification[]
  unreadCount: number
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  const base = `/${locale}`

  return (
    <section className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{t('notificationPreview.title')}</h2>
          <p className="text-xs text-text-muted">{t('notificationPreview.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${
              unreadCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-surface-elevated text-text-secondary'
            }`}
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {t('notificationPreview.unreadLabel', { count: unreadCount })}
          </span>
          <Link
            href={`${base}/notifications`}
            className="inline-flex items-center gap-1 rounded-full border border-indigo-200 px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            {t('notificationPreview.viewAll')}
          </Link>
          <Link
            href={`${base}/settings/notifications`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-text-secondary transition hover:border-border hover:bg-surface-elevated"
          >
            {t('notificationPreview.managePreferences')}
          </Link>
        </div>
      </header>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-elevated/80 p-4 text-sm text-text-muted">
          {t('notificationPreview.empty')}
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map(notification => (
            <li
              key={notification.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface/80 p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="text-xl" aria-hidden>
                {notificationTypeToIcon(notification.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">{notification.title}</p>
                <p className="mt-1 text-xs text-text-secondary">{notification.message}</p>
              </div>
              <span className="text-[11px] text-text-muted">{formatRelativeTime(notification.created_at, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function notificationTypeToIcon(type: Notification['type']) {
  switch (type) {
    case 'task_reminder':
      return '📅'
    case 'document_approval':
      return '📄'
    case 'audit_schedule':
      return '🔍'
    case 'risk_alert':
      return '⚠️'
    case 'system':
      return '🔔'
    case 'info':
    default:
      return 'ℹ️'
  }
}

function formatRelativeTime(value: string, locale: string) {
  try {
    return formatDistanceToNow(new Date(value), {
      addSuffix: true,
      locale: locale === 'ja' ? ja : enUS
    })
  } catch (error) {
    return ''
  }
}

const ACTIVITY_VIEW_CONFIG: Record<string, ActivityViewConfig> = {
  'document.created': {
    badgeKey: 'document',
    entryKey: 'documentCreated',
    icon: '📝',
    titleSource: 'resource',
    getHref: ({ base, log }) => (log.resource_id ? `${base}/documents/${log.resource_id}` : undefined)
  },
  'document.updated': {
    badgeKey: 'document',
    entryKey: 'documentUpdated',
    icon: '✏️',
    titleSource: 'resource',
    getHref: ({ base, log }) => (log.resource_id ? `${base}/documents/${log.resource_id}` : undefined)
  },
  'document.approved': {
    badgeKey: 'document',
    entryKey: 'documentApproved',
    icon: '✅',
    titleSource: 'resource',
    getHref: ({ base, log }) => (log.resource_id ? `${base}/documents/${log.resource_id}` : undefined)
  },
  'document.approval_requested': {
    badgeKey: 'document',
    entryKey: 'documentApprovalRequested',
    icon: '📨',
    titleSource: 'resource',
    getHref: ({ base, log }) => (log.resource_id ? `${base}/documents/${log.resource_id}` : undefined)
  },
  'risk.created': {
    badgeKey: 'risk',
    entryKey: 'riskCreated',
    icon: '⚠️',
    getHref: ({ base, log }) => (log.resource_id ? `${base}/risks/${log.resource_id}` : undefined)
  },
  'risk.updated': {
    badgeKey: 'risk',
    entryKey: 'riskUpdated',
    icon: '🛠️',
    getHref: ({ base, log }) => (log.resource_id ? `${base}/risks/${log.resource_id}` : undefined)
  },
  'risk.deleted': {
    badgeKey: 'risk',
    entryKey: 'riskDeleted',
    icon: '🗑️'
  },
  'user.invited': {
    badgeKey: 'user',
    entryKey: 'userInvited',
    icon: '👥',
    titleSource: 'actor',
    getTitle: ({ log, actorName }) => {
      const email = (log.changes as Record<string, unknown> | null)?.email
      if (typeof email === 'string' && email.trim().length > 0) {
        return email.trim()
      }
      return actorName
    }
  },
  'organization.phase_changed': {
    badgeKey: 'system',
    entryKey: 'phaseChanged',
    icon: '🌀',
    getHref: ({ base }) => `${base}/settings/organization`
  }
}

function buildActivityFeedItems({
  logs,
  notifications,
  locale,
  t
}: {
  logs: ActivityLogEntry[]
  notifications: Notification[]
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
}): ActivityFeedItem[] {
  const base = `/${locale}`
  const items: ActivityFeedItem[] = []

  logs.forEach(log => {
    const config = ACTIVITY_VIEW_CONFIG[log.action]
    if (!config) {
      return
    }

    const changes = (log.changes as Record<string, unknown> | null) ?? null
    let derivedResourceName: string | null = null
    if (log.resource_label) {
      derivedResourceName = log.resource_label
    } else if (log.action === 'user.invited' && typeof changes?.email === 'string' && changes.email.trim().length > 0) {
      derivedResourceName = changes.email.trim()
    } else if (typeof changes?.title === 'string' && changes.title.trim().length > 0) {
      derivedResourceName = (changes.title as string).trim()
    }

    const resourceName = derivedResourceName ?? t('recentActivity.unknownResource')
    const actorName = resolveActivityActorName(log.actor, t)
    const title = config.getTitle
      ? config.getTitle({ resourceName, actorName, log, t })
      : config.titleSource === 'actor'
        ? actorName
        : resourceName
    const description = t(`recentActivity.entries.${config.entryKey}` as const, {
      actor: actorName,
      resource: resourceName,
      phase: typeof changes?.phase === 'string' ? changes.phase : ''
    })

    items.push({
      id: `activity-${log.id}`,
      kind: 'activity',
      icon: config.icon,
      badge: t(`recentActivity.badges.${config.badgeKey}` as const),
      badgeTone: activityBadgeTone(config.badgeKey),
      title,
      description,
      timestamp: log.created_at ?? '',
      href: config.getHref ? config.getHref({ base, log }) : undefined
    })
  })

  notifications.slice(0, 5).forEach(notification => {
    items.push({
      id: `notification-${notification.id}`,
      kind: 'notification',
      icon: notificationTypeToIcon(notification.type),
      badge: t('recentActivity.badges.notification'),
      badgeTone: activityBadgeTone('notification'),
      title: notification.title,
      description: notification.message,
      timestamp: notification.created_at,
      href: buildNotificationHref(notification.link, base)
    })
  })

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)
}

function buildActivityFallbackItems(locale: string, t: ReturnType<typeof useTranslations<'home'>>) {
  const now = Date.now()
  const fallbackLogs: ActivityLogEntry[] = [
    {
      id: 'fallback-document-approved',
      organization_id: 'fallback-org',
      user_id: null,
      action: 'document.approved',
      resource_type: 'document',
      resource_id: 'doc-fallback',
      changes: { title: '情報セキュリティ方針 2025' },
      ip_address: null,
      user_agent: null,
      scope: 'tenant' as ActivityLogEntry['scope'],
      created_at: new Date(now - 15 * 60 * 1000).toISOString(),
      actor: { id: null, full_name: 'QA Admin', email: 'qa-admin@example.com' },
      resource_label: '情報セキュリティ方針 2025'
    },
    {
      id: 'fallback-risk-created',
      organization_id: 'fallback-org',
      user_id: null,
      action: 'risk.created',
      resource_type: 'risk',
      resource_id: 'risk-fallback',
      changes: { title: 'BCP年次レビュー' },
      ip_address: null,
      user_agent: null,
      scope: 'tenant' as ActivityLogEntry['scope'],
      created_at: new Date(now - 40 * 60 * 1000).toISOString(),
      actor: { id: null, full_name: 'QA Analyst', email: 'qa-analyst@example.com' },
      resource_label: 'BCP年次レビュー'
    }
  ]

  const fallbackNotifications: Notification[] = [
    {
      id: 'fallback-notification-1',
      organization_id: 'fallback-org',
      user_id: null,
      title: '監査スケジュール',
      message: '12月1日に内部監査が予定されています。',
      type: 'audit_schedule',
      priority: 'medium',
      status: 'unread',
      link: '/audit/plans/demo',
      metadata: null,
      created_at: new Date(now - 5 * 60 * 1000).toISOString()
    }
  ]

  return buildActivityFeedItems({ logs: fallbackLogs, notifications: fallbackNotifications, locale, t })
}

function resolveActivityActorName(actor: ActivityLogEntry['actor'] | null | undefined, t: ReturnType<typeof useTranslations<'home'>>) {
  if (actor?.full_name && actor.full_name.trim().length > 0) {
    return actor.full_name.trim()
  }
  if (actor?.email) {
    return actor.email
  }
  return t('recentActivity.unknownActor')
}

function activityBadgeTone(badge: ActivityBadgeKey) {
  switch (badge) {
    case 'document':
      return 'bg-sky-100 text-sky-700'
    case 'risk':
      return 'bg-rose-100 text-rose-700'
    case 'user':
      return 'bg-emerald-100 text-emerald-700'
    case 'system':
      return 'bg-surface-elevated text-text-secondary'
    case 'notification':
    default:
      return 'bg-indigo-100 text-indigo-700'
  }
}

function buildNotificationHref(link: string | null | undefined, base: string) {
  if (!link) return undefined
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link
  }
  const normalized = link.startsWith('/') ? link : `/${link}`
  return `${base}${normalized}`
}

function RoleDashboard({
  role,
  locale,
  t,
  stats,
  approverMetrics,
  approverMetricsStatus,
  educationFollowUp,
  managementReviewSummary,
  myTraining
}: {
  role: RoleKey
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
  stats: DashboardStats | null
  approverMetrics: ApproverDashboardMetrics | null
  approverMetricsStatus: ApproverMetricsStatus
  educationFollowUp: EducationFollowUpSummary | null
  managementReviewSummary: ManagementReviewSummary | null
  myTraining: MyTrainingSummary | null
}) {
  switch (role) {
    case 'approver':
      return (
        <ApproverDashboard
          locale={locale}
          t={t}
          metrics={approverMetrics}
          status={approverMetricsStatus}
        />
      )
    case 'user':
      return <UserDashboard locale={locale} t={t} myTraining={myTraining} />
    case 'auditor':
      return <AuditorDashboard locale={locale} t={t} />
    case 'org_admin':
    case 'system_operator':
      return (
        <AdminDashboard
          locale={locale}
          t={t}
          stats={stats}
          educationFollowUp={educationFollowUp}
          managementReviewSummary={managementReviewSummary}
        />
      )
    default:
      return null
  }
}

type ApproverMetricsStatus = 'idle' | 'loading' | 'ready' | 'error'

function ApproverDashboard({
  locale,
  t,
  metrics,
  status
}: {
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
  metrics: ApproverDashboardMetrics | null
  status: ApproverMetricsStatus
}) {
  const approvalsHref = `/${locale}/approvals`
  const helperFallback = t('roleDashboards.approver.helperFallback')
  const isLoading = status === 'idle' || status === 'loading'
  const lastUpdatedLabel =
    metrics?.lastRefreshedAt && status === 'ready'
      ? t('roleDashboards.approver.lastUpdated', {
          value: formatRelativeTime(metrics.lastRefreshedAt, locale)
        })
      : null

  const cards = [
    {
      id: 'pending',
      badge: t('roleDashboards.approver.cards.pending.badge'),
      badgeTone: 'bg-indigo-100 text-indigo-700',
      borderTone: 'border-indigo-100 hover:border-indigo-200',
      label: t('roleDashboards.approver.cards.pending.label'),
      helper: metrics
        ? t('roleDashboards.approver.cards.pending.helper', { count: metrics.pendingCount })
        : helperFallback,
      value: typeof metrics?.pendingCount === 'number' ? metrics.pendingCount : null,
      href: `${approvalsHref}?status=pending`,
      cta: t('roleDashboards.approver.cards.pending.cta')
    },
    {
      id: 'history',
      badge: t('roleDashboards.approver.cards.history.badge'),
      badgeTone: 'bg-emerald-100 text-emerald-700',
      borderTone: 'border-emerald-100 hover:border-emerald-200',
      label: t('roleDashboards.approver.cards.history.label'),
      helper: metrics
        ? t('roleDashboards.approver.cards.history.helper', {
            count: metrics.historyCount,
            days: metrics.historyWindowDays
          })
        : helperFallback,
      value: typeof metrics?.historyCount === 'number' ? metrics.historyCount : null,
      href: `/${locale}/notifications?view=approvals`,
      cta: t('roleDashboards.approver.cards.history.cta')
    },
    {
      id: 'due',
      badge: t('roleDashboards.approver.cards.due.badge'),
      badgeTone: 'bg-amber-100 text-amber-700',
      borderTone: 'border-amber-100 hover:border-amber-200',
      label: t('roleDashboards.approver.cards.due.label'),
      helper: metrics
        ? t('roleDashboards.approver.cards.due.helper', {
            hours: metrics.dueSoonHours,
            count: metrics.dueSoonCount
          })
        : helperFallback,
      value: typeof metrics?.dueSoonCount === 'number' ? metrics.dueSoonCount : null,
      href: `${approvalsHref}?status=pending&urgency=due`,
      cta: t('roleDashboards.approver.cards.due.cta')
    },
    {
      id: 'escalation',
      badge: t('roleDashboards.approver.cards.escalation.badge'),
      badgeTone: 'bg-rose-100 text-rose-700',
      borderTone: 'border-rose-100 hover:border-rose-200',
      label: t('roleDashboards.approver.cards.escalation.label'),
      helper: metrics
        ? t('roleDashboards.approver.cards.escalation.helper', {
            hours: metrics.escalationHours,
            count: metrics.escalationCount
          })
        : helperFallback,
      value: typeof metrics?.escalationCount === 'number' ? metrics.escalationCount : null,
      href: `${approvalsHref}?status=pending&urgency=escalation`,
      cta: t('roleDashboards.approver.cards.escalation.cta')
    }
  ]

  return (
    <section data-testid="approver-dashboard" className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{t('roleDashboards.approver.title')}</h2>
          <p className="text-xs text-text-muted">{t('roleDashboards.approver.subtitle')}</p>
        </div>
        <span className="text-[11px] font-medium text-text-muted">
          {isLoading ? t('roleDashboards.approver.loading') : lastUpdatedLabel || ''}
        </span>
      </div>
      {status === 'error' && (
        <div
          data-testid="approver-dashboard-error"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
        >
          {t('roleDashboards.approver.error')}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map(card => (
          <Link
            key={card.id}
            href={card.href}
            aria-label={`${card.label} - ${card.cta}`}
            data-testid={`approver-dashboard-card-${card.id}`}
            className={`group flex flex-col justify-between rounded-2xl border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.borderTone}`}
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium ${card.badgeTone}`}>
                {card.badge}
              </span>
              <span className="text-3xl font-semibold text-text-primary">
                {typeof card.value === 'number' ? card.value.toLocaleString() : '—'}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-sm font-semibold text-text-primary">{card.label}</p>
              <p className="text-xs text-text-secondary">{card.helper}</p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
              {card.cta}
              <svg
                className="h-3 w-3 transition group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

type UserTaskStatus = 'todo' | 'inProgress' | 'review'
type UserDocumentStatus = 'pendingAck' | 'updated' | 'acknowledged'
type UserImprovementStatus = 'draft' | 'scheduled' | 'shipped'

interface UserTaskItem {
  id: string
  title: string
  category: string
  due: string
  status: UserTaskStatus
}

interface UserDocumentItem {
  id: string
  title: string
  version: string
  status: UserDocumentStatus
  due: string
}

interface UserTrainingModule {
  id: string
  title: string
  due: string
  progress: number
  href: string
}

interface UserImprovementItem {
  id: string
  title: string
  owner: string
  eta: string
  status: UserImprovementStatus
}

const USER_TASK_STATUS_STYLES: Record<UserTaskStatus, string> = {
  todo: 'bg-surface-elevated text-text-secondary',
  inProgress: 'bg-amber-100 text-amber-700',
  review: 'bg-indigo-100 text-indigo-700'
}

const USER_DOCUMENT_STATUS_STYLES: Record<UserDocumentStatus, string> = {
  pendingAck: 'bg-rose-100 text-rose-700',
  updated: 'bg-indigo-100 text-indigo-700',
  acknowledged: 'bg-emerald-100 text-emerald-700'
}

const USER_IMPROVEMENT_STATUS_STYLES: Record<UserImprovementStatus, string> = {
  draft: 'bg-surface-elevated text-text-secondary',
  scheduled: 'bg-amber-100 text-amber-700',
  shipped: 'bg-emerald-100 text-emerald-700'
}

function UserDashboard({
  locale,
  t,
  myTraining
}: {
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
  myTraining: MyTrainingSummary | null
}) {
  const tasksHref = `/${locale}/tasks?view=personal`
  const documentsHref = `/${locale}/documents?status=approved`
  const trainingHref = `/${locale}/education`
  const improvementsHref = `/${locale}/tasks?tag=improvement`

  const personalTasks: UserTaskItem[] = [
    {
      id: 'policyReview',
      title: t('roleDashboards.user.sections.tasks.items.policyReview.title'),
      category: t('roleDashboards.user.sections.tasks.items.policyReview.category'),
      due: t('roleDashboards.user.sections.tasks.items.policyReview.due'),
      status: 'inProgress'
    },
    {
      id: 'incidentDrill',
      title: t('roleDashboards.user.sections.tasks.items.incidentDrill.title'),
      category: t('roleDashboards.user.sections.tasks.items.incidentDrill.category'),
      due: t('roleDashboards.user.sections.tasks.items.incidentDrill.due'),
      status: 'todo'
    },
    {
      id: 'awarenessSurvey',
      title: t('roleDashboards.user.sections.tasks.items.awarenessSurvey.title'),
      category: t('roleDashboards.user.sections.tasks.items.awarenessSurvey.category'),
      due: t('roleDashboards.user.sections.tasks.items.awarenessSurvey.due'),
      status: 'review'
    }
  ]

  const documentAssignments: UserDocumentItem[] = [
    {
      id: 'remoteWork',
      title: t('roleDashboards.user.sections.documents.items.remoteWork.title'),
      version: t('roleDashboards.user.sections.documents.items.remoteWork.version'),
      status: 'pendingAck',
      due: t('roleDashboards.user.sections.documents.items.remoteWork.due')
    },
    {
      id: 'vendorChecklist',
      title: t('roleDashboards.user.sections.documents.items.vendorChecklist.title'),
      version: t('roleDashboards.user.sections.documents.items.vendorChecklist.version'),
      status: 'updated',
      due: t('roleDashboards.user.sections.documents.items.vendorChecklist.due')
    },
    {
      id: 'codeOfConduct',
      title: t('roleDashboards.user.sections.documents.items.codeOfConduct.title'),
      version: t('roleDashboards.user.sections.documents.items.codeOfConduct.version'),
      status: 'acknowledged',
      due: t('roleDashboards.user.sections.documents.items.codeOfConduct.due')
    }
  ]

  const fallbackTrainingModules: UserTrainingModule[] = [
    {
      id: 'phishing',
      title: t('roleDashboards.user.sections.training.items.phishing.title'),
      due: t('roleDashboards.user.sections.training.items.phishing.due'),
      progress: 65,
      href: trainingHref
    },
    {
      id: 'incident',
      title: t('roleDashboards.user.sections.training.items.incident.title'),
      due: t('roleDashboards.user.sections.training.items.incident.due'),
      progress: 40,
      href: trainingHref
    },
    {
      id: 'kaizen',
      title: t('roleDashboards.user.sections.training.items.kaizen.title'),
      due: t('roleDashboards.user.sections.training.items.kaizen.due'),
      progress: 90,
      href: trainingHref
    }
  ]
  const trainingModules: UserTrainingModule[] = myTraining?.items?.length
    ? myTraining.items.map(item => ({
        id: item.id,
        title: item.title,
        due: item.end_date
          ? t('roleDashboards.user.sections.training.dueDate', { date: item.end_date })
          : t('roleDashboards.user.sections.training.noDueDate'),
        progress: item.progress,
        href: `/${locale}/education/${item.id}`,
      }))
    : fallbackTrainingModules

  const improvementEntries: UserImprovementItem[] = [
    {
      id: 'documentationCleanup',
      title: t('roleDashboards.user.sections.improvements.items.documentationCleanup.title'),
      owner: t('roleDashboards.user.sections.improvements.items.documentationCleanup.owner'),
      eta: t('roleDashboards.user.sections.improvements.items.documentationCleanup.eta'),
      status: 'scheduled'
    },
    {
      id: 'alertReduction',
      title: t('roleDashboards.user.sections.improvements.items.alertReduction.title'),
      owner: t('roleDashboards.user.sections.improvements.items.alertReduction.owner'),
      eta: t('roleDashboards.user.sections.improvements.items.alertReduction.eta'),
      status: 'draft'
    },
    {
      id: 'awarenessPost',
      title: t('roleDashboards.user.sections.improvements.items.awarenessPost.title'),
      owner: t('roleDashboards.user.sections.improvements.items.awarenessPost.owner'),
      eta: t('roleDashboards.user.sections.improvements.items.awarenessPost.eta'),
      status: 'shipped'
    }
  ]

  const summaryCards = [
    {
      id: 'taskCount',
      label: t('roleDashboards.user.summary.tasks'),
      value: personalTasks.length,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      href: tasksHref
    },
    {
      id: 'documentCount',
      label: t('roleDashboards.user.summary.documents'),
      value: documentAssignments.length,
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      href: documentsHref
    },
    {
      id: 'trainingCount',
      label: t('roleDashboards.user.summary.training'),
      value: trainingModules.filter(m => m.progress < 100).length,
      tone: 'bg-amber-50 text-amber-700 border-amber-100',
      href: trainingHref
    }
  ]
  const incompleteTrainingCount =
    myTraining?.incomplete_count ?? trainingModules.filter(module => module.progress < 100).length
  const nextTraining = trainingModules.find(module => module.progress < 100) ?? trainingModules[0]
  const priorityItems = [
    {
      key: 'training',
      href: nextTraining?.href ?? trainingHref,
      title: t('roleDashboards.user.sections.priorityActions.items.training.title'),
      description: t('roleDashboards.user.sections.priorityActions.items.training.description', {
        count: incompleteTrainingCount
      }),
      tone: 'border-amber-100 bg-amber-50 text-amber-700',
    },
    {
      key: 'tasks',
      href: tasksHref,
      title: t('roleDashboards.user.sections.priorityActions.items.tasks.title'),
      description: t('roleDashboards.user.sections.priorityActions.items.tasks.description', {
        count: personalTasks.length
      }),
      tone: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    {
      key: 'documents',
      href: documentsHref,
      title: t('roleDashboards.user.sections.priorityActions.items.documents.title'),
      description: t('roleDashboards.user.sections.priorityActions.items.documents.description', {
        count: documentAssignments.filter(doc => doc.status !== 'acknowledged').length
      }),
      tone: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    },
  ].filter(item => item.key !== 'training' || incompleteTrainingCount > 0)

  return (
    <section data-testid="user-dashboard" className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">
          {t('roleDashboards.user.title')}
        </h2>
        <p className="text-sm text-text-secondary">{t('roleDashboards.user.subtitle')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map(card => (
          <Link
            key={card.id}
            href={card.href}
            data-testid={`user-summary-${card.id}`}
            className={`flex items-center justify-between rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
          >
            <span className="text-sm font-medium">{card.label}</span>
            <span className="text-2xl font-bold">{card.value}</span>
          </Link>
        ))}
      </div>

      <section
        data-testid="user-dashboard-priority-actions"
        className="home-theme-card rounded-2xl border border-border bg-surface p-5 shadow-sm"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {t('roleDashboards.user.sections.priorityActions.title')}
            </h3>
            <p className="text-sm text-text-secondary">
              {t('roleDashboards.user.sections.priorityActions.subtitle')}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {priorityItems.map(item => (
            <Link
              key={item.key}
              href={item.href}
              data-testid={`user-dashboard-priority-action-${item.key}`}
              className={`rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${item.tone}`}
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs opacity-80">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <UserDashboardSectionCard
          testId="user-dashboard-tasks"
          title={t('roleDashboards.user.sections.tasks.title')}
          subtitle={t('roleDashboards.user.sections.tasks.subtitle')}
          href={tasksHref}
          linkLabel={t('roleDashboards.user.sections.tasks.cta')}
        >
          <ul className="space-y-3">
            {personalTasks.map(task => (
              <li
                key={task.id}
                data-testid="user-dashboard-task-item"
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-elevated/80 p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">{task.title}</p>
                  <p className="text-xs text-text-muted">{task.category}</p>
                  <p className="text-xs text-text-muted">{task.due}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${USER_TASK_STATUS_STYLES[task.status]}`}
                >
                  {t(`roleDashboards.user.sections.tasks.status.${task.status}` as any)}
                </span>
              </li>
            ))}
          </ul>
        </UserDashboardSectionCard>

        <UserDashboardSectionCard
          testId="user-dashboard-documents"
          title={t('roleDashboards.user.sections.documents.title')}
          subtitle={t('roleDashboards.user.sections.documents.subtitle')}
          href={documentsHref}
          linkLabel={t('roleDashboards.user.sections.documents.cta')}
        >
          <ul className="space-y-3">
            {documentAssignments.map(doc => (
              <li
                key={doc.id}
                data-testid="user-dashboard-document-item"
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">{doc.title}</p>
                  <p className="text-xs text-text-muted">{doc.version}</p>
                  <p className="text-xs text-text-muted">{doc.due}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${USER_DOCUMENT_STATUS_STYLES[doc.status]}`}
                >
                  {t(`roleDashboards.user.sections.documents.status.${doc.status}` as any)}
                </span>
              </li>
            ))}
          </ul>
        </UserDashboardSectionCard>

        <UserDashboardSectionCard
          testId="user-dashboard-training"
          title={t('roleDashboards.user.sections.training.title')}
          subtitle={t('roleDashboards.user.sections.training.subtitle')}
          href={trainingHref}
          linkLabel={t('roleDashboards.user.sections.training.cta')}
        >
          <div className="space-y-3">
            {trainingModules.map(module => (
              <Link
                key={module.id}
                href={module.href}
                data-testid="user-dashboard-training-item"
                className="block rounded-xl border border-border bg-surface p-4 transition hover:border-amber-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between text-sm font-medium text-text-primary">
                  <span>{module.title}</span>
                  <span>{module.progress}%</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{module.due}</p>
                <div className="mt-3 h-2 rounded-full bg-surface-elevated">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: `${module.progress}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </UserDashboardSectionCard>
      </div>

      <UserDashboardSectionCard
        testId="user-dashboard-improvements"
        title={t('roleDashboards.user.sections.improvements.title')}
        subtitle={t('roleDashboards.user.sections.improvements.subtitle')}
        href={improvementsHref}
        linkLabel={t('roleDashboards.user.sections.improvements.cta')}
      >
        <p className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-800">
          {t('roleDashboards.user.sections.improvements.highlight')}
        </p>
        <ul className="space-y-3">
          {improvementEntries.map(entry => (
            <li
              key={entry.id}
              data-testid="user-dashboard-improvement-item"
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{entry.title}</p>
                  <p className="text-xs text-text-muted">{entry.owner}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${USER_IMPROVEMENT_STATUS_STYLES[entry.status]}`}
                >
                  {t(`roleDashboards.user.sections.improvements.status.${entry.status}` as any)}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">{entry.eta}</p>
            </li>
          ))}
        </ul>
      </UserDashboardSectionCard>
    </section>
  )
}

function UserDashboardSectionCard({
  testId,
  title,
  subtitle,
  href,
  linkLabel,
  children
}: {
  testId: string
  title: string
  subtitle: string
  href: string
  linkLabel: string
  children: ReactNode
}) {
  return (
    <article
      data-testid={testId}
      className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </header>
      <div className="flex-1 space-y-3">{children}</div>
      <Link
        href={href}
        data-testid={`${testId}-link`}
        className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600"
      >
        {linkLabel}
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
        </svg>
      </Link>
    </article>
  )
}

function AdminDashboard({
  locale,
  t,
  stats,
  educationFollowUp,
  managementReviewSummary
}: {
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
  stats: DashboardStats | null
  educationFollowUp: EducationFollowUpSummary | null
  managementReviewSummary: ManagementReviewSummary | null
}) {
  const auditHubPath = `/${locale}/audit`
  const educationPath = `/${locale}/education`
  const educationFollowUpPath = `${educationPath}?followUp=needs_attention`

  const kpiCards = [
    {
      key: 'pendingApprovals',
      value: stats?.pendingReviewDocumentCount ?? 0,
      label: t('roleDashboards.admin.sections.kpi.pendingApprovals'),
      href: `/${locale}/approvals`
    },
    {
      key: 'activeUsers',
      value: stats?.userCount ?? 0,
      label: t('roleDashboards.admin.sections.kpi.activeUsers'),
      href: `/${locale}/settings/users`
    },
    {
      key: 'openRisks',
      value: stats?.activeRiskCount ?? 0,
      label: t('roleDashboards.admin.sections.kpi.openRisks'),
      href: `/${locale}/risks`
    },
    {
      key: 'overdueTasks',
      value: stats?.overdueTaskCount ?? 0,
      label: t('roleDashboards.admin.sections.kpi.overdueTasks'),
      href: `/${locale}/tasks?due=overdue`
    }
  ]

  const actionItems = [
    {
      key: 'overdueTasks',
      count: stats?.overdueTaskCount ?? 0,
      href: `/${locale}/tasks?due=overdue`,
      tone: 'border-rose-100 bg-rose-50 text-rose-700',
      title: t('roleDashboards.admin.sections.priorityActions.items.overdueTasks.title'),
      description: t('roleDashboards.admin.sections.priorityActions.items.overdueTasks.description', {
        count: stats?.overdueTaskCount ?? 0
      })
    },
    {
      key: 'pendingApprovals',
      count: stats?.pendingReviewDocumentCount ?? 0,
      href: `/${locale}/approvals`,
      tone: 'border-amber-100 bg-amber-50 text-amber-700',
      title: t('roleDashboards.admin.sections.priorityActions.items.pendingApprovals.title'),
      description: t('roleDashboards.admin.sections.priorityActions.items.pendingApprovals.description', {
        count: stats?.pendingReviewDocumentCount ?? 0
      })
    },
    {
      key: 'educationFollowUp',
      count: educationFollowUp?.needs_follow_up_count ?? 0,
      href: educationFollowUpPath,
      tone: 'border-indigo-100 bg-indigo-50 text-indigo-700',
      title: t('roleDashboards.admin.sections.priorityActions.items.educationFollowUp.title'),
      description: t('roleDashboards.admin.sections.priorityActions.items.educationFollowUp.description', {
        count: educationFollowUp?.needs_follow_up_count ?? 0
      })
    },
    {
      key: 'openRisks',
      count: stats?.activeRiskCount ?? 0,
      href: `/${locale}/risks`,
      tone: 'border-sky-100 bg-sky-50 text-sky-700',
      title: t('roleDashboards.admin.sections.priorityActions.items.openRisks.title'),
      description: t('roleDashboards.admin.sections.priorityActions.items.openRisks.description', {
        count: stats?.activeRiskCount ?? 0
      })
    }
  ].filter(item => item.count > 0)

  const cadenceItems = [
    {
      key: 'weeklyTasks',
      cadence: t('roleDashboards.admin.sections.operationalCadence.items.weeklyTasks.cadence'),
      title: t('roleDashboards.admin.sections.operationalCadence.items.weeklyTasks.title'),
      description: t('roleDashboards.admin.sections.operationalCadence.items.weeklyTasks.description', {
        count: stats?.taskStatusBreakdown?.review ?? 0
      }),
      href: `/${locale}/tasks?status=review`,
      count: stats?.taskStatusBreakdown?.review ?? 0,
      metricLabel: t('roleDashboards.admin.sections.operationalCadence.items.weeklyTasks.metric')
    },
    {
      key: 'monthlyRisks',
      cadence: t('roleDashboards.admin.sections.operationalCadence.items.monthlyRisks.cadence'),
      title: t('roleDashboards.admin.sections.operationalCadence.items.monthlyRisks.title'),
      description: t('roleDashboards.admin.sections.operationalCadence.items.monthlyRisks.description', {
        count: stats?.riskStatusBreakdown?.treating ?? 0
      }),
      href: `/${locale}/risks?status=treating`,
      count: stats?.riskStatusBreakdown?.treating ?? 0,
      metricLabel: t('roleDashboards.admin.sections.operationalCadence.items.monthlyRisks.metric')
    },
    {
      key: 'auditReview',
      cadence: t('roleDashboards.admin.sections.operationalCadence.items.auditReview.cadence'),
      title: t('roleDashboards.admin.sections.operationalCadence.items.auditReview.title'),
      description: t('roleDashboards.admin.sections.operationalCadence.items.auditReview.description', {
        count: stats?.inProgressAuditCount ?? 0
      }),
      href: `${auditHubPath}?status=in_progress`,
      count: stats?.inProgressAuditCount ?? 0,
      metricLabel: t('roleDashboards.admin.sections.operationalCadence.items.auditReview.metric')
    },
    {
      key: 'managementReview',
      cadence: t('roleDashboards.admin.sections.operationalCadence.items.managementReview.cadence'),
      title: t('roleDashboards.admin.sections.operationalCadence.items.managementReview.title'),
      description: t('roleDashboards.admin.sections.operationalCadence.items.managementReview.description', {
        count: managementReviewSummary?.scheduled_count ?? 0
      }),
      href: `/${locale}/management-reviews?status=scheduled`,
      count: managementReviewSummary?.scheduled_count ?? 0,
      metricLabel: t('roleDashboards.admin.sections.operationalCadence.items.managementReview.metric')
    }
  ]

  const recentActivities = [
    {
      key: 'userJoined',
      title: t('roleDashboards.admin.sections.recentActivity.items.userJoined.title'),
      detail: t('roleDashboards.admin.sections.recentActivity.items.userJoined.detail'),
      time: t('roleDashboards.admin.sections.recentActivity.items.userJoined.time')
    },
    {
      key: 'docApproved',
      title: t('roleDashboards.admin.sections.recentActivity.items.docApproved.title'),
      detail: t('roleDashboards.admin.sections.recentActivity.items.docApproved.detail'),
      time: t('roleDashboards.admin.sections.recentActivity.items.docApproved.time')
    },
    {
      key: 'riskEscalated',
      title: t('roleDashboards.admin.sections.recentActivity.items.riskEscalated.title'),
      detail: t('roleDashboards.admin.sections.recentActivity.items.riskEscalated.detail'),
      time: t('roleDashboards.admin.sections.recentActivity.items.riskEscalated.time')
    }
  ]

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">{t('roleDashboards.admin.title')}</h2>
        <p className="text-sm text-text-secondary">{t('roleDashboards.admin.subtitle')}</p>
      </header>

      <section
        data-testid="admin-dashboard"
        className="home-theme-card rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div className="mb-4 space-y-1">
          <h3 className="text-base font-semibold text-text-primary">
            {t('roleDashboards.admin.sections.kpi.title')}
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {kpiCards.map(card => (
            <Link
              key={card.key}
              href={card.href}
              data-testid={`admin-dashboard-kpi-${card.key}`}
              className="block rounded-2xl border border-border bg-surface-elevated/80 p-4 shadow-sm transition hover:border-indigo-200 hover:bg-surface hover:shadow-md"
            >
              <p
                data-testid={`admin-dashboard-kpi-${card.key}-value`}
                className="text-xl font-semibold text-text-primary"
              >
                {card.value}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{card.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section
        data-testid="admin-dashboard-priority-actions"
        className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            {t('roleDashboards.admin.sections.priorityActions.title')}
          </h3>
          <p className="text-xs text-text-muted">
            {t('roleDashboards.admin.sections.priorityActions.subtitle')}
          </p>
        </div>
        {actionItems.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {actionItems.slice(0, 4).map(item => (
              <Link
                key={item.key}
                href={item.href}
                data-testid={`admin-dashboard-priority-action-${item.key}`}
                className={`block rounded-2xl border p-4 transition hover:shadow-sm ${item.tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-1 text-xs text-text-secondary">{item.description}</p>
                  </div>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-primary">
                    {item.count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p
            data-testid="admin-dashboard-priority-actions-empty"
            className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {t('roleDashboards.admin.sections.priorityActions.empty')}
          </p>
        )}
      </section>

      <section
        data-testid="admin-dashboard-operational-cadence"
        className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            {t('roleDashboards.admin.sections.operationalCadence.title')}
          </h3>
          <p className="text-xs text-text-muted">
            {t('roleDashboards.admin.sections.operationalCadence.subtitle')}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {cadenceItems.map(item => (
            <Link
              key={item.key}
              href={item.href}
              data-testid={`admin-dashboard-cadence-${item.key}`}
              className="block rounded-2xl border border-border bg-surface-elevated/80 p-4 transition hover:border-indigo-200 hover:bg-surface hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    {item.cadence}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">{item.description}</p>
                </div>
                {item.count !== null && (
                  <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-primary">
                    {item.metricLabel ? `${item.metricLabel}: ${item.count}` : item.count}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {t('roleDashboards.admin.sections.recentActivity.title')}
            </h3>
            <p className="text-xs text-text-muted">
              {t('roleDashboards.admin.sections.recentActivity.subtitle')}
            </p>
          </div>
          <Link
            href={auditHubPath}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            {t('roleDashboards.admin.sections.recentActivity.cta')}
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14m0 0l-6-6m6 6l-6 6"
              />
            </svg>
          </Link>
        </div>
        <div className="space-y-3">
          {recentActivities.map(item => (
            <article key={item.key} className="rounded-xl border border-border bg-surface-elevated/80 p-4">
              <p className="text-sm font-medium text-text-primary">{item.title}</p>
              <p className="text-xs text-text-secondary">{item.detail}</p>
              <p className="mt-1 text-xs text-text-muted">{item.time}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        data-testid="admin-dashboard-education-follow-up"
        className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-6 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {t('roleDashboards.admin.sections.educationFollowUp.title')}
            </h3>
            <p className="text-xs text-text-secondary">
              {t('roleDashboards.admin.sections.educationFollowUp.subtitle')}
            </p>
          </div>
          <Link
            href={educationFollowUpPath}
            data-testid="admin-dashboard-education-follow-up-link"
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-600"
          >
            {t('roleDashboards.admin.sections.educationFollowUp.cta')}
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14m0 0l-6-6m6 6l-6 6"
              />
            </svg>
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-100 bg-surface p-4">
            <p className="text-xs text-amber-700">
              {t('roleDashboards.admin.sections.educationFollowUp.metrics.followUp')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {educationFollowUp?.needs_follow_up_count ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-surface p-4">
            <p className="text-xs text-amber-700">
              {t('roleDashboards.admin.sections.educationFollowUp.metrics.overdue')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {educationFollowUp?.overdue_count ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-surface p-4">
            <p className="text-xs text-amber-700">
              {t('roleDashboards.admin.sections.educationFollowUp.metrics.pendingRecords')}
            </p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {educationFollowUp?.pending_record_count ?? 0}
            </p>
          </div>
        </div>

        {educationFollowUp?.items?.length ? (
          <div className="space-y-3">
            {educationFollowUp.items.map(item => (
              <Link
                key={item.id}
                href={`/${locale}/education/${item.id}`}
                data-testid="admin-dashboard-education-follow-up-item"
                className="block rounded-xl border border-amber-100 bg-surface p-4 transition hover:border-amber-200 hover:shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.title}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {t('roleDashboards.admin.sections.educationFollowUp.itemSummary', {
                        passed: item.passed_records,
                        records: item.total_records,
                        users: item.active_user_count
                      })}
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-medium ${
                    item.is_overdue
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.is_overdue
                      ? t('roleDashboards.admin.sections.educationFollowUp.status.overdue')
                      : t('roleDashboards.admin.sections.educationFollowUp.status.needsRecord')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-emerald-100 bg-surface p-4 text-sm text-emerald-700">
            {t('roleDashboards.admin.sections.educationFollowUp.empty')}
          </p>
        )}
      </section>
    </section>
  )
}

function AuditorDashboard({
  locale,
  t
}: {
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
}) {
  const basePath = `/${locale}/audit`

  const assignedAudits: AuditorAuditItem[] = [
    {
      id: 'quarterly',
      name: t('roleDashboards.auditor.sections.assignedAudits.items.quarterly.name'),
      period: t('roleDashboards.auditor.sections.assignedAudits.items.quarterly.period'),
      status: 'fieldwork',
      nextStep: t('roleDashboards.auditor.sections.assignedAudits.items.quarterly.nextStep')
    },
    {
      id: 'supplier',
      name: t('roleDashboards.auditor.sections.assignedAudits.items.supplier.name'),
      period: t('roleDashboards.auditor.sections.assignedAudits.items.supplier.period'),
      status: 'planning',
      nextStep: t('roleDashboards.auditor.sections.assignedAudits.items.supplier.nextStep')
    }
  ]

  const checklistProgress: AuditorChecklistItem[] = [
    {
      id: 'isoClauses',
      label: t('roleDashboards.auditor.sections.checklistProgress.items.isoClauses.label'),
      statusLabel: t('roleDashboards.auditor.sections.checklistProgress.items.isoClauses.status'),
      progress: 75
    },
    {
      id: 'annexSampling',
      label: t('roleDashboards.auditor.sections.checklistProgress.items.annexSampling.label'),
      statusLabel: t('roleDashboards.auditor.sections.checklistProgress.items.annexSampling.status'),
      progress: 60
    },
    {
      id: 'followUp',
      label: t('roleDashboards.auditor.sections.checklistProgress.items.followUp.label'),
      statusLabel: t('roleDashboards.auditor.sections.checklistProgress.items.followUp.status'),
      progress: 45
    }
  ]

  const findings: AuditorFindingSummary[] = [
    {
      id: 'critical',
      label: t('roleDashboards.auditor.sections.findings.items.critical.label'),
      description: t('roleDashboards.auditor.sections.findings.items.critical.description'),
      count: 1,
      tone: 'urgent'
    },
    {
      id: 'minor',
      label: t('roleDashboards.auditor.sections.findings.items.minor.label'),
      description: t('roleDashboards.auditor.sections.findings.items.minor.description'),
      count: 4,
      tone: 'warning'
    },
    {
      id: 'recommendation',
      label: t('roleDashboards.auditor.sections.findings.items.recommendation.label'),
      description: t('roleDashboards.auditor.sections.findings.items.recommendation.description'),
      count: 7,
      tone: 'info'
    }
  ]

  const reportActions: AuditorReportAction[] = [
    {
      id: 'draftReport',
      title: t('roleDashboards.auditor.sections.reports.items.draftReport.title'),
      description: t('roleDashboards.auditor.sections.reports.items.draftReport.description'),
      due: t('roleDashboards.auditor.sections.reports.items.draftReport.due'),
      href: `${basePath}/reports`
    },
    {
      id: 'closingMeeting',
      title: t('roleDashboards.auditor.sections.reports.items.closingMeeting.title'),
      description: t('roleDashboards.auditor.sections.reports.items.closingMeeting.description'),
      due: t('roleDashboards.auditor.sections.reports.items.closingMeeting.due'),
      href: basePath
    },
    {
      id: 'followUpPlan',
      title: t('roleDashboards.auditor.sections.reports.items.followUpPlan.title'),
      description: t('roleDashboards.auditor.sections.reports.items.followUpPlan.description'),
      due: t('roleDashboards.auditor.sections.reports.items.followUpPlan.due'),
      href: `${basePath}/nonconformities`
    }
  ]

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('roleDashboards.auditor.title')}</h2>
          <p className="text-sm text-text-secondary">{t('roleDashboards.auditor.subtitle')}</p>
        </div>
        <Link
          href={basePath}
          data-testid="auditor-dashboard-workspace-link"
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-surface px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-800"
        >
          {t('roleDashboards.auditor.viewWorkspace')}
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
          </svg>
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {t('roleDashboards.auditor.sections.assignedAudits.title')}
              </h3>
              <p className="text-xs text-text-muted">
                {t('roleDashboards.auditor.sections.assignedAudits.subtitle')}
              </p>
            </div>
            <Link
              href={basePath}
              data-testid="auditor-dashboard-assigned-audits-link"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t('roleDashboards.auditor.sections.assignedAudits.manageLink')}
            </Link>
          </header>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-4 py-3 font-medium text-text-muted">
                    {t('roleDashboards.auditor.sections.assignedAudits.columns.name')}
                  </th>
                  <th className="px-4 py-3 font-medium text-text-muted">
                    {t('roleDashboards.auditor.sections.assignedAudits.columns.period')}
                  </th>
                  <th className="px-4 py-3 font-medium text-text-muted">
                    {t('roleDashboards.auditor.sections.assignedAudits.columns.status')}
                  </th>
                  <th className="px-4 py-3 font-medium text-text-muted">
                    {t('roleDashboards.auditor.sections.assignedAudits.columns.nextStep')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {assignedAudits.map(item => (
                  <tr key={item.id} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{item.period}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${auditorStatusTone(item.status)}`}
                      >
                        {t(`roleDashboards.auditor.statusLabels.${item.status}` as any)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{item.nextStep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <header>
            <h3 className="text-base font-semibold text-text-primary">
              {t('roleDashboards.auditor.sections.findings.title')}
            </h3>
            <p className="text-xs text-text-muted">
              {t('roleDashboards.auditor.sections.findings.subtitle')}
            </p>
          </header>
          <div className="space-y-3">
            {findings.map(item => (
              <article
                key={item.id}
                className={`rounded-xl border border-border p-4 ${findingBackgroundTone(item.tone)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">{item.label}</h4>
                    <p className="text-xs text-text-secondary">{item.description}</p>
                  </div>
                  <span className="text-xl font-semibold text-text-primary">{item.count}</span>
                </div>
              </article>
            ))}
          </div>
          <Link
            href={`${basePath}/nonconformities`}
            data-testid="auditor-dashboard-findings-link"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            {t('roleDashboards.auditor.sections.findings.manageLink')}
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
            </svg>
          </Link>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {t('roleDashboards.auditor.sections.checklistProgress.title')}
              </h3>
              <p className="text-xs text-text-muted">
                {t('roleDashboards.auditor.sections.checklistProgress.subtitle')}
              </p>
            </div>
            <Link
              href={`${basePath}/requirements`}
              data-testid="auditor-dashboard-checklist-link"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t('roleDashboards.auditor.sections.checklistProgress.manageLink')}
            </Link>
          </header>
          <div className="space-y-4">
            {checklistProgress.map(item => (
              <div key={item.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text-primary">{item.label}</span>
                  <span className="text-xs text-text-muted">{item.statusLabel}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-elevated">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: `${item.progress}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="home-theme-card space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <header>
            <h3 className="text-base font-semibold text-text-primary">
              {t('roleDashboards.auditor.sections.reports.title')}
            </h3>
            <p className="text-xs text-text-muted">
              {t('roleDashboards.auditor.sections.reports.subtitle')}
            </p>
          </header>
          <ul className="space-y-3 text-sm">
            {reportActions.map(item => (
              <li key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="text-xs text-text-secondary">{item.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>{item.due}</span>
                    <Link
                      href={item.href}
                      data-testid={`auditor-dashboard-report-action-${item.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {t('roleDashboards.auditor.sections.reports.openLink')}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href={`${basePath}/reports`}
            data-testid="auditor-dashboard-reports-link"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
          >
            {t('roleDashboards.auditor.sections.reports.cta')}
          </Link>
        </section>
      </div>
    </section>
  )
}

type AuditorStatus = 'planning' | 'fieldwork' | 'reporting' | 'followUp'

interface AuditorAuditItem {
  id: string
  name: string
  period: string
  status: AuditorStatus
  nextStep: string
}

interface AuditorChecklistItem {
  id: string
  label: string
  statusLabel: string
  progress: number
}

interface AuditorFindingSummary {
  id: string
  label: string
  description: string
  count: number
  tone: 'urgent' | 'warning' | 'info'
}

interface AuditorReportAction {
  id: string
  title: string
  description: string
  due: string
  href: string
}

function auditorStatusTone(status: AuditorStatus) {
  switch (status) {
    case 'planning':
      return 'bg-surface-elevated text-text-secondary'
    case 'fieldwork':
      return 'bg-indigo-100 text-indigo-700'
    case 'reporting':
      return 'bg-amber-100 text-amber-700'
    case 'followUp':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-surface-elevated text-text-secondary'
  }
}

function findingBackgroundTone(tone: AuditorFindingSummary['tone']) {
  switch (tone) {
    case 'urgent':
      return 'bg-rose-50'
    case 'warning':
      return 'bg-amber-50'
    case 'info':
    default:
      return 'bg-surface-elevated'
  }
}

function getInsights({
  stats,
  subscriptionStatus,
  subscription,
  locale,
  t
}: {
  stats: DashboardStats | null
  subscriptionStatus: string
  subscription: any
  locale: string
  t: ReturnType<typeof useTranslations<'home'>>
}): string[] {
  const items: string[] = []

  if ((stats?.documentCount ?? 0) === 0) {
    items.push(t('insights.items.noDocuments'))
  }
  if ((stats?.pendingReviewDocumentCount ?? 0) > 0) {
    items.push(t('insights.items.documentsInReview', { count: stats?.pendingReviewDocumentCount ?? 0 }))
  }
  if ((stats?.activeTaskCount ?? 0) > 5) {
    items.push(t('insights.items.tasksOverload', { count: stats?.activeTaskCount ?? 0 }))
  }
  if ((stats?.overdueTaskCount ?? 0) > 0) {
    items.push(t('insights.items.tasksOverdue', { count: stats?.overdueTaskCount ?? 0 }))
  }
  if ((stats?.activeRiskCount ?? 0) === 0) {
    items.push(t('insights.items.noRisks'))
  }
  if ((stats?.inProgressAuditCount ?? 0) > 0) {
    items.push(t('insights.items.upcomingAudits', { count: stats?.inProgressAuditCount ?? 0 }))
  }
  if (subscriptionStatus === 'trialing' && subscription?.trial_end) {
    items.push(t('insights.items.trialCountdown', { date: formatDate(subscription.trial_end, locale) }))
  }

  return items
}

function getGreeting(name: string, t: ReturnType<typeof useTranslations<'home'>>) {
  return t('hero.greeting', { name })
}

function formatDate(dateString?: string | null, locale: string = 'ja') {
  if (!dateString) return '—'
  try {
    return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateString))
  } catch (error) {
    return dateString
  }
}
