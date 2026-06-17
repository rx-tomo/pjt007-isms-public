'use client'

import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type {
  IsmsPhase,
  OnboardingProgress,
  OnboardingStepId,
  OnboardingStepStatus,
  OnboardingProgressPeriod
} from '@/lib/services/onboarding'

interface OnboardingChecklistProps {
  locale: string
  progress: OnboardingProgress | null
  isLoading?: boolean
  onRequestPhaseSetup?: () => void
}

const STEP_ICONS: Record<OnboardingStepId, JSX.Element> = {
  profile: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 20.25a7.5 7.5 0 0115 0" />
    </svg>
  ),
  team: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11c1.657 0 3-1.79 3-4s-1.343-4-3-4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11c1.657 0 3-1.79 3-4S9.657 3 8 3" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.5 21a5.5 5.5 0 0111 0" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.5 21a5.5 5.5 0 00-4-5.291" />
    </svg>
  ),
  structure: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.25l4.5 2.625M12 8.25L7.5 10.875" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 12l4.5 2.625M12 12l-4.5 2.625" />
    </svg>
  ),
  departments: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4h16v5H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9v11M15 9v11" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 15h16" />
    </svg>
  ),
  scope: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.75a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10.5v10.125" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12a7.5 7.5 0 0115 0c0 3.75-3.75 6-7.5 8.625C8.25 18 4.5 15.75 4.5 12z" />
    </svg>
  ),
  documents: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 4h6l3 3v13.5A1.5 1.5 0 0116.5 22h-9A1.5 1.5 0 016 20.5V5.5A1.5 1.5 0 017.5 4H9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13.5h6M9 10.5h3" />
    </svg>
  ),
  tasks: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 5.25A2.25 2.25 0 016.75 3h10.5A2.25 2.25 0 0119.5 5.25v13.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75z" />
    </svg>
  ),
  risks: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5h.008v.008H12z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78A1.5 1.5 0 0021.18 18L12.71 3.86a1.5 1.5 0 00-2.42 0z" />
    </svg>
  ),
  phase_scope_review: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21c4.5-3.5 7.5-7.5 7.5-11a7.5 7.5 0 10-15 0c0 3.5 3 7.5 7.5 11z" />
      <circle cx="12" cy="10" r="2" strokeWidth={1.5} />
    </svg>
  ),
  phase_risk_cycle: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5h.008v.008H12z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78A1.5 1.5 0 0021.18 18L12.71 3.86a1.5 1.5 0 00-2.42 0z" />
    </svg>
  ),
  phase_task_followup: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12l3 3 6-6" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 21h6" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12" />
    </svg>
  ),
  phase_audit_readiness: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5.25l6 6-6 6" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 19.5l15-15" />
    </svg>
  ),
  phase_management_review: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 15h6" />
    </svg>
  )
}

const PHASE_BADGE_TONE: Record<IsmsPhase, string> = {
  initial: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  surveillance: 'bg-emerald-50 text-emerald-700 ring-emerald-100'
}

const STATUS_BADGE_STYLE: Record<OnboardingStepStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  in_progress: 'bg-amber-50 text-amber-700 border border-amber-100',
  not_started: 'bg-surface-elevated text-text-secondary border border-border'
}

const STATUS_FILTERS: Array<{ value: 'all' | OnboardingStepStatus; key: string }> = [
  { value: 'all', key: 'all' },
  { value: 'completed', key: 'completed' },
  { value: 'in_progress', key: 'inProgress' },
  { value: 'not_started', key: 'notStarted' }
]

export default function OnboardingChecklist({
  locale,
  progress,
  isLoading,
  onRequestPhaseSetup
}: OnboardingChecklistProps) {
  const t = useTranslations('home')
  const router = useRouter()

  const loadingView = (
    <section className="rounded-3xl border border-indigo-100 bg-surface/90 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            {t('onboardingChecklist.badge')}
          </div>
          <div className="space-y-1">
            <div className="h-5 w-52 animate-pulse rounded-full bg-surface-elevated" />
            <div className="h-3 w-72 animate-pulse rounded-full bg-surface-elevated" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20">
            <div className="h-full w-full animate-pulse rounded-full bg-indigo-100" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-32 rounded-full bg-surface-elevated" />
            <div className="h-3 w-24 rounded-full bg-surface-elevated" />
          </div>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map(item => (
          <div key={`onboarding-skeleton-${item}`} className="h-20 rounded-2xl border border-border bg-surface/70">
            <div className="h-full w-full animate-pulse rounded-2xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />
          </div>
        ))}
      </div>
    </section>
  )

  const unavailableView = (
    <section className="rounded-3xl border border-indigo-100 bg-surface/90 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            {t('onboardingChecklist.badge')}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('onboardingChecklist.unavailable.title')}</h2>
            <p className="text-sm text-text-secondary">{t('onboardingChecklist.unavailable.description')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1 rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
          >
            {t('onboardingChecklist.unavailable.retry')}
          </button>
          <Link
            href={`/${locale}/settings/organization`}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
          >
            {t('onboardingChecklist.unavailable.settings')}
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14m0 0l-6-6m6 6l-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )

  const periodCandidates = useMemo(() => {
    if (!progress) {
      return [] as OnboardingProgressPeriod[]
    }
    const periods: OnboardingProgressPeriod[] = [progress.periods.current]
    if (progress.periods.previous) {
      periods.push(progress.periods.previous)
    }
    return periods
  }, [progress])

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => periodCandidates[0]?.fiscalYear ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | OnboardingStepStatus>('all')

  useEffect(() => {
    if (periodCandidates.length === 0) {
      setSelectedPeriod('')
      return
    }
    if (!periodCandidates.find(period => period.fiscalYear === selectedPeriod)) {
      setSelectedPeriod(periodCandidates[0].fiscalYear)
    }
  }, [periodCandidates, selectedPeriod])

  useEffect(() => {
    setStatusFilter('all')
  }, [selectedPeriod])

  const activePeriod = useMemo(() => {
    if (periodCandidates.length === 0) {
      return null
    }
    return periodCandidates.find(period => period.fiscalYear === selectedPeriod) ?? periodCandidates[0]
  }, [periodCandidates, selectedPeriod])

  const statusCounters = useMemo(() => {
    const counters: Record<'all' | OnboardingStepStatus, number> = {
      all: 0,
      completed: 0,
      in_progress: 0,
      not_started: 0
    }
    if (activePeriod) {
      counters.all = activePeriod.steps.length
      activePeriod.steps.forEach(step => {
        counters[step.status] += 1
      })
    }
    return counters
  }, [activePeriod])

  const filteredSteps = useMemo(() => {
    if (!activePeriod) {
      return []
    }
    if (statusFilter === 'all') {
      return activePeriod.steps
    }
    return activePeriod.steps.filter(step => step.status === statusFilter)
  }, [activePeriod, statusFilter])

  if (isLoading) {
    return loadingView
  }

  if (!progress || !activePeriod) {
    return unavailableView
  }

  const metrics = buildStepMetrics(activePeriod, locale)
  const stepTargets: Record<OnboardingStepId, number> = {
    profile: activePeriod.meta.profileComplete ? 1 : 1,
    team: 2,
    structure: Math.max(activePeriod.counts.structureRequiredRoles || 0, 1),
    departments: 1,
    scope: 1,
    documents: 1,
    tasks: 1,
    risks: 1,
    phase_scope_review: 1,
    phase_risk_cycle: 1,
    phase_task_followup: 1,
    phase_audit_readiness: 1,
    phase_management_review: 1
  }
  const stepConfigs = activePeriod.steps.map(step => ({
    id: step.id,
    href: metrics[step.id]?.href ?? `/${locale}/home`,
    count: metrics[step.id]?.count ?? 0
  }))

  const circumference = 2 * Math.PI * 36
  const progressOffset = circumference * (1 - activePeriod.completionRate / 100)
  const effectivePhase = progress.phase.effective
  const phaseLabel = t(`onboardingChecklist.phases.${effectivePhase}` as const)
  const phaseBadgeTone = PHASE_BADGE_TONE[effectivePhase]
  const formattedPhaseSetAt = progress.phase.setAt ? formatPhaseTimestamp(progress.phase.setAt, locale) : null
  const phaseHistoryEntries = progress.phaseHistory.slice(0, 3)

  return (
    <section className="rounded-3xl border border-indigo-100 bg-surface/90 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            {t('onboardingChecklist.badge')}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('onboardingChecklist.title')}</h2>
            <p className="text-sm text-text-secondary">{t('onboardingChecklist.description')}</p>
          </div>
          <div className="text-xs text-text-muted">
            {t('onboardingChecklist.lastUpdated', { date: formattedPhaseSetAt ?? '—' })}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-end">
          <div className="flex flex-col items-center justify-center">
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90 text-border" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="36"
                  stroke="#4f46e5"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={progressOffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold text-indigo-600">{activePeriod.completionRate}%</span>
              </div>
            </div>
            <span className="text-xs text-text-muted">{t('onboardingChecklist.rateLabel')}</span>
          </div>
          <div className="rounded-2xl bg-surface-elevated p-3 text-sm text-text-secondary">
            {t('onboardingChecklist.summary', {
              completed: activePeriod.completedSteps,
              total: activePeriod.totalSteps
            })}
            <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">{activePeriod.label}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    {periodCandidates.length > 1 && (
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <span>{t('onboardingChecklist.filters.period.label')}</span>
            <div className="inline-flex rounded-full bg-surface-elevated p-1">
              {periodCandidates.map(period => (
                <button
                  key={period.fiscalYear}
                  type="button"
                  onClick={() => setSelectedPeriod(period.fiscalYear)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    period.fiscalYear === activePeriod.fiscalYear
                      ? 'bg-surface text-indigo-600 shadow'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-text-secondary">
          <span>{t('onboardingChecklist.filters.status.label')}</span>
          <div className="inline-flex rounded-full bg-surface-elevated p-1">
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
                  statusFilter === filter.value ? 'bg-surface text-indigo-600 shadow' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {t(`onboardingChecklist.filters.status.${filter.key}` as const)}
                <span className="rounded-full bg-surface px-1.5 text-[10px] font-semibold text-text-secondary">
                  {statusCounters[filter.value] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {progress.phase.alert === 'missing' && (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-800">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-surface/70 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {t('onboardingChecklist.badge')}
              </span>
              <p>{t('onboardingChecklist.phaseMissing')}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onRequestPhaseSetup}
                className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-amber-500"
              >
                {t('onboardingChecklist.phaseMissingCta')}
              </button>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="rounded-full border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-surface"
              >
                {t('onboardingChecklist.unavailable.retry')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {filteredSteps.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface-elevated/80 p-6 text-sm text-text-secondary">
              {t('onboardingChecklist.filters.status.empty')}
            </div>
          ) : (
            filteredSteps.map(step => {
              const isComplete = step.completed
              const target = stepTargets[step.id] ?? 1
              const count = stepConfigs.find(config => config.id === step.id)?.count ?? 0
              const href = stepConfigs.find(config => config.id === step.id)?.href ?? `/${locale}/home`
              const statusBadge = STATUS_BADGE_STYLE[step.status]
              const completedLabel = step.completedAt ? formatPhaseTimestamp(step.completedAt, locale) : null

              return (
                <Link
                  key={step.id}
                  href={href}
                  data-testid={`onboarding-step-${step.id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/80 p-4 transition hover:border-indigo-200 hover:bg-surface"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        {STEP_ICONS[step.id]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{t(`onboardingChecklist.steps.${step.id}.title`)}</p>
                        <p className="text-xs text-text-muted">{t(`onboardingChecklist.steps.${step.id}.description`)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge}`}>
                        {t(`onboardingChecklist.statusLabels.${step.status}` as const)}
                      </div>
                      {completedLabel && (
                        <div className="text-[11px] text-text-muted">
                          {t('onboardingChecklist.completedAt', { date: completedLabel })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>
                      {isComplete
                        ? t(`onboardingChecklist.steps.${step.id}.complete`, { count })
                        : t(`onboardingChecklist.steps.${step.id}.pending`, { count, target })}
                    </span>
                    <span>
                      {count}/{target}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-surface-elevated">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${isComplete ? 'bg-indigo-500' : 'bg-border'}`}
                      style={{ width: `${Math.min(100, Math.round((count / Math.max(target, 1)) * 100))}%` }}
                    />
                  </div>
                </Link>
              )
            })
          )}
        </div>

        <div className="space-y-4">
          <div className={`rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 ${phaseBadgeTone}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('onboardingChecklist.phasesTitle')}</p>
                <p className="text-lg font-semibold text-text-primary">{phaseLabel}</p>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-indigo-600">
                {activePeriod.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">{t('onboardingChecklist.description')}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface/80 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{t('onboardingChecklist.history.title')}</h3>
                <p className="text-xs text-text-muted">{t('onboardingChecklist.history.subtitle')}</p>
              </div>
              <Link
                href={`/${locale}/settings/organization?tab=phase`}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('onboardingChecklist.history.manage')}
              </Link>
            </div>
            <ol className="mt-3 space-y-3 text-sm text-text-secondary">
              {phaseHistoryEntries.length === 0 && <li className="text-xs text-text-muted">{t('onboardingChecklist.history.empty')}</li>}
              {phaseHistoryEntries.map(entry => (
                <li key={entry.id} className="flex items-center justify-between rounded-xl border border-border bg-surface/80 px-3 py-2">
                  <div>
                    <p className="font-semibold text-text-primary">{t(`onboardingChecklist.phases.${entry.phase}` as const)}</p>
                    <p className="text-xs text-text-muted">{formatPhaseTimestamp(entry.recordedAt, locale)}</p>
                  </div>
                  <span className="text-xs text-text-muted">{t(`onboardingChecklist.history.source.${entry.source}`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

function buildStepMetrics(period: OnboardingProgressPeriod, locale: string) {
  const orgSettingsHref = `/${locale}/settings/organization`
  return {
    profile: {
      count: period.meta.profileComplete ? 1 : 0,
      href: orgSettingsHref
    },
    team: {
      count: period.counts.activeUsers,
      href: `/${locale}/settings/users`
    },
    structure: {
      count:
        period.counts.structureRequiredRoles > 0
          ? period.counts.structureSatisfiedRoles
          : period.counts.structureAssignments,
      href: orgSettingsHref
    },
    departments: {
      count: period.counts.departmentCount,
      href: orgSettingsHref
    },
    scope: {
      count: period.counts.scopeItemCount,
      href: orgSettingsHref
    },
    documents: {
      count: period.counts.documentCount,
      href: `/${locale}/documents`
    },
    tasks: {
      count: period.counts.taskCount,
      href: `/${locale}/tasks`
    },
    risks: {
      count: period.counts.riskCount,
      href: `/${locale}/risks`
    },
    phase_scope_review: {
      count: period.counts.scopeItemCount,
      href: orgSettingsHref
    },
    phase_risk_cycle: {
      count: period.counts.riskCount,
      href: `/${locale}/risks`
    },
    phase_task_followup: {
      count: period.counts.correctiveTasksOpen,
      href: `/${locale}/tasks?status=review`
    },
    phase_audit_readiness: {
      count: period.counts.auditPlansInProgress + period.counts.auditPlansCompleted,
      href: `/${locale}/audit`
    },
    phase_management_review: {
      count: period.counts.documentCount,
      href: `/${locale}/documents`
    }
  } satisfies Record<OnboardingStepId, { count: number; href: string }>
}

function formatPhaseTimestamp(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(value))
  } catch (err) {
    console.warn('[OnboardingChecklist] failed to format timestamp', err)
    return value
  }
}
