'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RiskService } from '@/lib/services/risk'
import { IsoControlService, type IsoControl } from '@/lib/services/isoControl'
import { UserService } from '@/lib/services/user'
import { AssetSummaryList } from '@/components/assets/AssetSummaryList'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  assessEvidenceVaultReadiness,
  assessResidualAcceptanceReadiness,
  type RiskReadinessStatus
} from '@/lib/utils/riskOperationalReadiness'
import type { RiskWithRelations, RiskTreatment, RiskAssetWithDetails } from '@/lib/services/risk'
import type { UserRole, UserProfile } from '@/lib/services/user'

interface TreatmentFormState {
  treatment_type: RiskTreatment['treatment_type']
  description: string
  responsibleId: string
  targetDate: string
  residualReviewDueDate: string
  controlIds: string[]
}

type TreatmentWithControls = NonNullable<RiskWithRelations['treatments']>[number]

const createInitialTreatmentState = (): TreatmentFormState => ({
  treatment_type: 'reduce',
  description: '',
  responsibleId: '',
  targetDate: new Date().toISOString().split('T')[0],
  residualReviewDueDate: '',
  controlIds: []
})

const TREATMENT_STATUS_ORDER: Array<'planned' | 'in_progress' | 'completed' | 'cancelled'> = [
  'planned',
  'in_progress',
  'completed',
  'cancelled'
]

export default function RiskDetailPage(
  props: {
    params: Promise<{ locale: string; id: string }>
  }
) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const t = useTranslations('risks')
  const assetDetailText = useTranslations('risks.detail.assets')
  const assetLabelT = useTranslations('settings.assets.labels')
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [risk, setRisk] = useState<RiskWithRelations | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [showTreatmentForm, setShowTreatmentForm] = useState(false)
  const [treatmentForm, setTreatmentForm] = useState<TreatmentFormState>(() => createInitialTreatmentState())
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [availableControls, setAvailableControls] = useState<IsoControl[]>([])
  const [controlCategories, setControlCategories] = useState<string[]>([])
  const [controlSearch, setControlSearch] = useState('')
  const [controlCategory, setControlCategory] = useState('')
  const [controlsLoading, setControlsLoading] = useState(false)
  const [controlLoadError, setControlLoadError] = useState<string | null>(null)
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null)
  const [editingControlIds, setEditingControlIds] = useState<string[]>([])
  const [controlLinkSaving, setControlLinkSaving] = useState(false)
  const [controlLinkError, setControlLinkError] = useState<string | null>(null)
  const [completingTreatmentId, setCompletingTreatmentId] = useState<string | null>(null)
  const [submittingResidualAcceptanceId, setSubmittingResidualAcceptanceId] = useState<string | null>(null)

  const riskService = useMemo(() => new RiskService(), [])
  const isoControlService = useMemo(() => new IsoControlService(), [])
  const userService = useMemo(() => new UserService(), [])

  const loadRiskDetails = useCallback(async () => {
    setLoading(true)
    try {
      // Load risk details
      const riskData = await riskService.getRiskById(id)
      if (!riskData) {
        throw new Error('Risk not found')
      }
      setRisk(riskData)
      setOrganizationId(riskData.organization_id || null)

      if (riskData?.organization_id) {
        const orgUsers = await userService.getOrganizationUsers(riskData.organization_id)
        setUsers(orgUsers)
      }

      const profile = await userService.getUserProfile()
      if (profile) {
        setUserRole(profile.role as UserRole)
      }
    } catch (err) {
      console.error('Error loading risk details:', err)
    } finally {
      setLoading(false)
    }
  }, [id, riskService, userService])

  useEffect(() => {
    loadRiskDetails()
  }, [loadRiskDetails])

  const loadIsoControlOptions = useCallback(async () => {
    if (!organizationId) return
    setControlsLoading(true)
    setControlLoadError(null)
    try {
      const controls = await isoControlService.searchControls(
        organizationId,
        controlSearch,
        controlCategory || undefined
      )
      setAvailableControls(controls)
    } catch (err) {
      console.error('Failed to load ISO controls', err)
      setControlLoadError(t('treatment.controls.loadError'))
    } finally {
      setControlsLoading(false)
    }
  }, [organizationId, isoControlService, controlSearch, controlCategory, t])

  useEffect(() => {
    if (!organizationId) {
      setAvailableControls([])
      return
    }

    const handler = setTimeout(() => {
      loadIsoControlOptions()
    }, 300)

    return () => clearTimeout(handler)
  }, [organizationId, controlSearch, controlCategory, loadIsoControlOptions])

  useEffect(() => {
    if (!organizationId) {
      setControlCategories([])
      return
    }

    let isMounted = true
    ;(async () => {
      try {
        const categories = await isoControlService.getCategories(organizationId)
        if (isMounted) {
          setControlCategories(categories)
        }
      } catch (err) {
        console.error('Failed to load ISO control categories', err)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [organizationId, isoControlService])

  const layoutSummary = risk
    ? {
        name: risk.title,
        organizationName: risk.owner?.full_name || risk.owner?.email || undefined
      }
    : undefined
  const riskDescription = risk?.description?.trim() ? risk.description : t('detail.noDescription')

  const formatDate = useCallback(
    (value?: string | null) => {
      if (!value) return '-'
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return value
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(parsed)
    },
    [locale]
  )

  const treatmentSummary = useMemo(() => {
    const treatments = risk?.treatments ?? []
    const statuses = treatments.reduce<Record<string, number>>((acc, item) => {
      const key = item.status ?? 'planned'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const completed = statuses.completed ?? 0

    return {
      total: treatments.length,
      active: treatments.length - completed,
      completed,
      statuses
    }
  }, [risk?.treatments])

  const linkedControls = useMemo(() => {
    if (!risk?.treatments) return []
    const map = new Map<string, IsoControl>()

    risk.treatments.forEach((treatment) => {
      treatment.control_links?.forEach((link) => {
        if (link.iso_control?.id && !map.has(link.iso_control.id)) {
          map.set(link.iso_control.id, link.iso_control)
        }
      })
    })

    return Array.from(map.values())
  }, [risk?.treatments])

  const residualAcceptanceReadiness = useMemo(
    () => assessResidualAcceptanceReadiness(risk?.treatments ?? []),
    [risk?.treatments]
  )

  const evidenceVaultReadiness = useMemo(
    () => assessEvidenceVaultReadiness(risk?.treatments ?? []),
    [risk?.treatments]
  )

  const getRiskLevelColor = (score?: number | null) => {
    if (!score) return 'bg-green-100 text-green-800 border-green-300'
    if (score >= 15) return 'bg-red-100 text-red-800 border-red-300'
    if (score >= 8) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-green-100 text-green-800 border-green-300'
  }

  const getRiskLevelText = (score?: number | null) => {
    if (!score || score < 8) return t('levels.low')
    if (score >= 15) return t('levels.high')
    if (score >= 8) return t('levels.medium')
    return t('levels.low')
  }

  const getStatusBadge = (status: RiskWithRelations['status']) => {
    const statusConfig: Record<string, string> = {
      identified: 'bg-surface-elevated text-text-primary',
      analyzing: 'bg-blue-100 text-blue-800',
      treating: 'bg-yellow-100 text-yellow-800',
      monitoring: 'bg-green-100 text-green-800',
      closed: 'bg-surface-elevated text-text-secondary'
    }
    return status ? statusConfig[status] ?? '' : ''
  }

  const getReadinessBadge = (status: RiskReadinessStatus) => {
    const statusConfig: Record<RiskReadinessStatus, string> = {
      ready: 'bg-emerald-50 text-emerald-700',
      needs_attention: 'bg-amber-50 text-amber-700',
      not_ready: 'bg-surface-elevated text-text-secondary'
    }
    return statusConfig[status]
  }

  const handleAddTreatment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!risk) return

    try {
      await riskService.addRiskTreatment(
        risk.id,
        {
          treatment_type: treatmentForm.treatment_type,
          description: treatmentForm.description,
          responsible_id: treatmentForm.responsibleId || null,
          due_date: treatmentForm.targetDate,
          residual_review_due_date: treatmentForm.treatment_type === 'accept'
            ? treatmentForm.residualReviewDueDate || null
            : null,
          status: 'planned'
        },
        treatmentForm.controlIds
      )

      await loadRiskDetails()
      setShowTreatmentForm(false)
      setTreatmentForm(createInitialTreatmentState())
    } catch (err) {
      console.error('Error adding treatment:', err)
    }
  }

  const handleToggleControl = useCallback((controlId: string) => {
    setTreatmentForm((prev) => {
      const exists = prev.controlIds.includes(controlId)
      return {
        ...prev,
        controlIds: exists
          ? prev.controlIds.filter((id) => id !== controlId)
          : [...prev.controlIds, controlId]
      }
    })
  }, [])

  const handleStartControlLinkEdit = useCallback((treatment: TreatmentWithControls) => {
    setEditingTreatmentId(treatment.id)
    setEditingControlIds((treatment.control_links ?? [])
      .map((link) => link.iso_control?.id ?? link.iso_control_id)
      .filter((controlId): controlId is string => Boolean(controlId))
    )
    setControlLinkError(null)
  }, [])

  const handleToggleEditingControl = useCallback((controlId: string) => {
    setEditingControlIds((prev) => {
      const exists = prev.includes(controlId)
      return exists
        ? prev.filter((id) => id !== controlId)
        : [...prev, controlId]
    })
  }, [])

  const handleSaveControlLinks = useCallback(async () => {
    if (!editingTreatmentId) return
    setControlLinkSaving(true)
    setControlLinkError(null)
    try {
      await riskService.updateTreatment(editingTreatmentId, {}, editingControlIds)
      await loadRiskDetails()
      setEditingTreatmentId(null)
      setEditingControlIds([])
    } catch (err) {
      console.error('Error updating treatment controls:', err)
      setControlLinkError(t('treatment.controls.updateError'))
    } finally {
      setControlLinkSaving(false)
    }
  }, [editingControlIds, editingTreatmentId, loadRiskDetails, riskService, t])

  const handleMarkTreatmentCompleted = useCallback(async (treatmentId: string) => {
    setCompletingTreatmentId(treatmentId)
    try {
      await riskService.updateTreatment(treatmentId, { status: 'completed' })
      await loadRiskDetails()
    } catch (err) {
      console.error('Error completing treatment:', err)
    } finally {
      setCompletingTreatmentId(null)
    }
  }, [loadRiskDetails, riskService])

  const handleSubmitResidualAcceptanceApproval = useCallback(async (treatmentId: string) => {
    setSubmittingResidualAcceptanceId(treatmentId)
    try {
      const response = await fetch(`/api/risk-treatments/${treatmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_residual_acceptance_approval' }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? `API error ${response.status}`)
      }

      await loadRiskDetails()
    } catch (err) {
      console.error('Error submitting residual acceptance approval:', err)
    } finally {
      setSubmittingResidualAcceptanceId(null)
    }
  }, [loadRiskDetails])

  const ownerDisplayName = risk?.owner?.full_name || risk?.owner?.email || t('detail.unassigned')
  const categoryDisplayName = risk?.category?.name || '-'
  const riskScore = risk?.risk_score || 0
  const assetCount = risk?.assets?.length ?? 0
  const identifiedDate = formatDate(risk?.identified_date)
  const updatedDate = formatDate(risk?.updated_at)
  const treatmentStatusEntries = TREATMENT_STATUS_ORDER.map((status) => ({
    status,
    label: t(`treatment.statuses.${status}` as const),
    count: treatmentSummary.statuses[status] ?? 0
  }))
  const canEdit = userRole ? ['system_operator', 'org_admin'].includes(userRole) : false

  const renderLoading = () => (
    <div className="max-w-5xl mx-auto">
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-40 rounded bg-surface-elevated" />
          <div className="h-10 w-3/4 rounded bg-surface-elevated" />
          <div className="space-y-3">
            <div className="h-5 rounded bg-surface-elevated" />
            <div className="h-5 rounded bg-surface-elevated" />
            <div className="h-5 rounded bg-surface-elevated" />
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotFound = () => (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-red-800">
        <p className="text-sm font-semibold">{t('errors.notFound')}</p>
        <Link
          href={`/${locale}/risks`}
          className="mt-4 inline-flex items-center text-sm font-medium text-red-700 underline-offset-4 hover:underline"
        >
          {t('detail.backToList')}
        </Link>
      </div>
    </div>
  )

  if (loading) {
    return (
      <DashboardLayout locale={locale} headerSummary={layoutSummary}>
        <div className="px-4 py-8 sm:px-6 lg:px-8">{renderLoading()}</div>
      </DashboardLayout>
    )
  }

  if (!risk) {
    return (
      <DashboardLayout locale={locale} headerSummary={layoutSummary}>
        <div className="px-4 py-8 sm:px-6 lg:px-8">{renderNotFound()}</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale} headerSummary={layoutSummary}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="rounded-3xl border border-white/60 bg-surface p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <Link
                  href={`/${locale}/risks`}
                  className="inline-flex items-center text-xs font-medium text-text-muted hover:text-text-primary"
                >
                  <span aria-hidden="true" className="mr-2">&larr;</span>
                  {t('detail.backToList')}
                </Link>
                <h1 className="text-3xl font-semibold text-text-primary">{risk.title}</h1>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusBadge(risk.status)}`}
                  >
                    {t(`status.${risk.status}` as const)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getRiskLevelColor(riskScore)}`}
                  >
                    {getRiskLevelText(riskScore)} ({riskScore || 0})
                  </span>
                </div>
                {canEdit && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={`/${locale}/risks/${risk.id}/edit`}
                      className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                    >
                      {t('actions.edit')}
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-app p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.riskScore')}</dt>
                <dd className="mt-2 text-2xl font-semibold text-text-primary">{riskScore || 0}</dd>
                <p className="text-xs text-text-muted">{getRiskLevelText(riskScore)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.impact')}</dt>
                <dd className="mt-2 text-base font-medium text-text-primary">
                  {risk.impact_level
                    ? `${risk.impact_level} · ${t(`form.impactLevels.${risk.impact_level}` as const)}`
                    : '-'}
                </dd>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.likelihood')}</dt>
                <dd className="mt-2 text-base font-medium text-text-primary">
                  {risk.likelihood_level
                    ? `${risk.likelihood_level} · ${t(`form.likelihoodLevels.${risk.likelihood_level}` as const)}`
                    : '-'}
                </dd>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.owner')}</dt>
                <dd className="mt-2 text-base font-medium text-text-primary">{ownerDisplayName}</dd>
              </div>
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">{t('detail.riskDetails')}</h2>
                    <p className="text-sm text-text-muted">{t('detail.detailIntro')}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    ID: {risk.id.slice(0, 8)}
                  </span>
                </div>
                <p className="mt-4 text-sm text-text-secondary whitespace-pre-line">{riskDescription}</p>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.category')}</dt>
                    <dd className="mt-1 text-base font-medium text-text-primary">{categoryDisplayName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.status')}</dt>
                    <dd className="mt-1 text-base font-medium text-text-primary">{t(`status.${risk.status}` as const)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.identifiedDate')}</dt>
                    <dd className="mt-1 text-base font-medium text-text-primary">{identifiedDate}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('detail.lastUpdated')}</dt>
                    <dd className="mt-1 text-base font-medium text-text-primary">{updatedDate}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-text-primary">{t('detail.riskAssessment')}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.impact')}</p>
                    <p className="mt-2 text-2xl font-semibold text-text-primary">{risk.impact_level ?? '-'}</p>
                    <p className="text-xs text-text-muted">
                      {risk.impact_level ? t(`form.impactLevels.${risk.impact_level}` as const) : '-'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.likelihood')}</p>
                    <p className="mt-2 text-2xl font-semibold text-text-primary">{risk.likelihood_level ?? '-'}</p>
                    <p className="text-xs text-text-muted">
                      {risk.likelihood_level ? t(`form.likelihoodLevels.${risk.likelihood_level}` as const) : '-'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('form.riskScore')}</p>
                    <p className="mt-2 text-2xl font-semibold text-text-primary">{riskScore || '-'}</p>
                    <p className="text-xs text-text-muted">{getRiskLevelText(riskScore)}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-text-primary">{assetDetailText('title')}</h2>
                  <span className="text-sm text-text-muted">{assetCount}</span>
                </div>
                <div className="mt-4">
                  <AssetSummaryList
                    assets={(risk.assets ?? []) as RiskAssetWithDetails[]}
                    labels={{
                      title: assetDetailText('title'),
                      empty: assetDetailText('empty'),
                      classification: assetDetailText('classification'),
                      criticality: assetDetailText('criticality')
                    }}
                    formatAssetType={(value) => assetLabelT(`types.${value}`)}
                    formatClassification={(value) => assetLabelT(`classification.${value}`)}
                    formatCriticality={(value) => assetLabelT(`criticality.${value}`)}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">{t('detail.treatments')}</h2>
                    <p className="text-sm text-text-muted">
                      {treatmentSummary.total > 0
                        ? t('detail.treatmentCount', { count: treatmentSummary.total })
                        : t('detail.noTreatments')}
                    </p>
                  </div>
                  {canEdit && !showTreatmentForm && (
                    <button
                      onClick={() => {
                        setTreatmentForm(createInitialTreatmentState())
                        setShowTreatmentForm(true)
                      }}
                      data-testid="risk-add-treatment-button"
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      {t('actions.addTreatment')}
                    </button>
                  )}
                </div>

                {showTreatmentForm && (
                  <form onSubmit={handleAddTreatment} className="mt-6 rounded-2xl border border-border bg-app p-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          {t('treatment.strategy')}
                        </label>
                        <select
                          value={treatmentForm.treatment_type}
                          onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_type: e.target.value as RiskTreatment['treatment_type'] })}
                          data-testid="risk-treatment-strategy"
                          className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          required
                        >
                          <option value="reduce">{t('treatment.strategies.reduce')}</option>
                          <option value="transfer">{t('treatment.strategies.transfer')}</option>
                          <option value="accept">{t('treatment.strategies.accept')}</option>
                          <option value="avoid">{t('treatment.strategies.avoid')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          {t('treatment.description')}
                        </label>
                        <textarea
                          value={treatmentForm.description}
                          onChange={(e) => setTreatmentForm({ ...treatmentForm, description: e.target.value })}
                          data-testid="risk-treatment-description"
                          rows={3}
                          className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          required
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            {t('treatment.responsible')}
                          </label>
                          <select
                            value={treatmentForm.responsibleId}
                            onChange={(e) => setTreatmentForm({ ...treatmentForm, responsibleId: e.target.value })}
                            data-testid="risk-treatment-responsible"
                            className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            required
                          >
                            <option value="">{t('treatment.controls.searchPlaceholder')}</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.full_name || user.email}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            {t('treatment.targetDate')}
                          </label>
                          <input
                            type="date"
                            value={treatmentForm.targetDate}
                            onChange={(e) => setTreatmentForm({ ...treatmentForm, targetDate: e.target.value })}
                            data-testid="risk-treatment-target-date"
                            className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            required
                          />
                        </div>
                      </div>
                      {treatmentForm.treatment_type === 'accept' && (
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            {t('treatment.residualReviewDueDate')}
                          </label>
                          <input
                            type="date"
                            value={treatmentForm.residualReviewDueDate}
                            onChange={(e) => setTreatmentForm({ ...treatmentForm, residualReviewDueDate: e.target.value })}
                            data-testid="risk-treatment-residual-review-due-date"
                            className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            required
                          />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-text-secondary">
                            {t('treatment.controls.title')}
                          </label>
                          <span className="text-xs text-text-muted">
                            {t('treatment.controls.selectedCount', { count: treatmentForm.controlIds.length })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">{t('treatment.controls.description')}</p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={controlSearch}
                          onChange={(e) => setControlSearch(e.target.value)}
                          data-testid="risk-treatment-control-search"
                          placeholder={t('treatment.controls.searchPlaceholder')}
                          className="w-full sm:w-1/2 rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                          <select
                            value={controlCategory}
                            onChange={(e) => setControlCategory(e.target.value)}
                            data-testid="risk-treatment-control-category"
                            className="w-full sm:w-1/2 rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="">{t('treatment.controls.allCategories')}</option>
                            {controlCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-border bg-surface">
                          {controlsLoading ? (
                            <p className="p-3 text-sm text-text-muted">{t('treatment.controls.loading')}</p>
                          ) : controlLoadError ? (
                            <p className="p-3 text-sm text-red-600">{controlLoadError}</p>
                          ) : availableControls.length === 0 ? (
                            <p className="p-3 text-sm text-text-muted">{t('treatment.controls.noResults')}</p>
                          ) : (
                            <ul className="divide-y divide-border">
                              {availableControls.map((control) => {
                                const selected = treatmentForm.controlIds.includes(control.id)
                                return (
                                  <li key={control.id}>
                                    <label className="flex items-start gap-3 p-3 hover:bg-surface-hover">
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => handleToggleControl(control.id)}
                                        className="mt-1 rounded border-border text-blue-600 focus:ring-blue-500"
                                      />
                                      <div>
                                        <p className="text-sm font-medium text-text-primary">{control.title}</p>
                                        <p className="text-xs text-text-muted">
                                          <span>{control.category || '-'}</span>
                                          {control.control_code && <span className="ml-1">· {control.control_code}</span>}
                                        </p>
                                      </div>
                                    </label>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowTreatmentForm(false)}
                          className="text-sm font-medium text-text-secondary hover:text-text-primary"
                        >
                          {t('form.cancel')}
                        </button>
                        <button
                          type="submit"
                          data-testid="risk-treatment-save-button"
                          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                        >
                          {t('form.save')}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {risk.treatments && risk.treatments.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    {risk.treatments.map((treatment) => (
                      <div key={treatment.id} className="rounded-2xl border border-border p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {t(`treatment.strategies.${treatment.treatment_type}` as const)}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                treatment.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : treatment.status === 'in_progress'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-surface-elevated text-text-secondary'
                              }`}
                            >
                              {t(`treatment.statuses.${treatment.status}` as const)}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted">
                            {t('treatment.targetDate')}: {treatment.due_date ? formatDate(treatment.due_date) : '-'}
                          </p>
                        </div>
                        <p className="mt-3 text-sm text-text-secondary">{treatment.description}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {t('treatment.responsible')}: {users.find((user) => user.id === treatment.responsible_id)?.full_name || treatment.responsible_id || '-'}
                        </p>
                        {treatment.treatment_type === 'accept' && (
                          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">
                            <p className="font-semibold">
                              {t('treatment.residualApproval.title')}
                            </p>
                            <p className="mt-1" data-testid={`risk-treatment-residual-approval-status-${treatment.id}`}>
                              {t('treatment.residualApproval.statusLabel')}: {t(`treatment.residualApproval.statuses.${treatment.residual_approval_status ?? 'draft'}` as const)}
                            </p>
                            {treatment.residual_rejection_reason && (
                              <p className="mt-1 text-red-700" data-testid={`risk-treatment-residual-rejection-${treatment.id}`}>
                                {t('treatment.residualApproval.rejectionReason', { reason: treatment.residual_rejection_reason })}
                              </p>
                            )}
                            <p className="mt-1" data-testid={`risk-treatment-residual-review-due-date-${treatment.id}`}>
                              {t('treatment.residualReviewDueDate')}: {treatment.residual_review_due_date ? formatDate(treatment.residual_review_due_date) : '-'}
                            </p>
                          </div>
                        )}
                        {treatment.control_links && treatment.control_links.length > 0 && (
                          <div className="mt-4 rounded-xl border border-border bg-app p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                              {t('treatment.controls.assignedTitle')}
                            </p>
                            <ul className="mt-2 space-y-2">
                              {treatment.control_links.map((link) => (
                                <li key={link.id} className="text-sm text-text-secondary">
                                  <p className="font-medium text-text-primary">
                                    {link.iso_control?.title || t('treatment.controls.unknown')}
                                  </p>
                                  <p className="text-xs text-text-muted">
                                    <span>{link.iso_control?.category || '-'}</span>
                                    {link.iso_control?.control_code && <span className="ml-1">· {link.iso_control.control_code}</span>}
                                  </p>
                                  {link.iso_control?.description && (
                                    <p className="mt-1 text-xs text-text-muted">{link.iso_control.description}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {canEdit && (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            {treatment.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleMarkTreatmentCompleted(treatment.id)}
                                disabled={completingTreatmentId === treatment.id}
                                data-testid={`risk-treatment-complete-button-${treatment.id}`}
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {completingTreatmentId === treatment.id
                                  ? t('treatment.completing')
                                  : t('treatment.markCompleted')}
                              </button>
                            )}
                            {treatment.treatment_type === 'accept' && treatment.status === 'completed' && !['submitted', 'approved'].includes(treatment.residual_approval_status ?? 'draft') && (
                              <button
                                type="button"
                                onClick={() => handleSubmitResidualAcceptanceApproval(treatment.id)}
                                disabled={submittingResidualAcceptanceId === treatment.id}
                                data-testid={`risk-treatment-submit-residual-approval-${treatment.id}`}
                                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {submittingResidualAcceptanceId === treatment.id
                                  ? t('treatment.residualApproval.submitting')
                                  : t('treatment.residualApproval.submit')}
                              </button>
                            )}
                            {editingTreatmentId === treatment.id ? (
                              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3" data-testid="risk-treatment-control-editor">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-text-primary">{t('treatment.controls.title')}</p>
                                    <p className="text-xs text-text-muted">
                                      {t('treatment.controls.selectedCount', { count: editingControlIds.length })}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTreatmentId(null)
                                        setEditingControlIds([])
                                        setControlLinkError(null)
                                      }}
                                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover"
                                    >
                                      {t('treatment.controls.cancelEdit')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleSaveControlLinks}
                                      disabled={controlLinkSaving}
                                      data-testid="risk-treatment-control-save-button"
                                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {controlLinkSaving ? t('treatment.controls.saving') : t('treatment.controls.saveLinks')}
                                    </button>
                                  </div>
                                </div>
                                {controlLinkError && (
                                  <p className="mt-2 text-xs text-red-600">{controlLinkError}</p>
                                )}
                                <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-border bg-surface">
                                  {controlsLoading ? (
                                    <p className="p-3 text-sm text-text-muted">{t('treatment.controls.loading')}</p>
                                  ) : controlLoadError ? (
                                    <p className="p-3 text-sm text-red-600">{controlLoadError}</p>
                                  ) : availableControls.length === 0 ? (
                                    <p className="p-3 text-sm text-text-muted">{t('treatment.controls.noResults')}</p>
                                  ) : (
                                    <ul className="divide-y divide-border">
                                      {availableControls.map((control) => {
                                        const selected = editingControlIds.includes(control.id)
                                        return (
                                          <li key={control.id}>
                                            <label className="flex items-start gap-3 p-3 hover:bg-surface-hover">
                                              <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => handleToggleEditingControl(control.id)}
                                                data-testid={`risk-treatment-control-edit-${control.id}`}
                                                className="mt-1 rounded border-border text-blue-600 focus:ring-blue-500"
                                              />
                                              <div>
                                                <p className="text-sm font-medium text-text-primary">{control.title}</p>
                                                <p className="text-xs text-text-muted">
                                                  <span>{control.category || '-'}</span>
                                                  {control.control_code && <span className="ml-1">· {control.control_code}</span>}
                                                </p>
                                              </div>
                                            </label>
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartControlLinkEdit(treatment)}
                                data-testid={`risk-treatment-control-edit-button-${treatment.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800"
                              >
                                {t('treatment.controls.editLinks')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-text-muted">{t('detail.noTreatments')}</p>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm" data-testid="residual-risk-acceptance-panel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{t('operationalReadiness.residualAcceptance.title')}</h3>
                    <p className="mt-1 text-xs text-text-muted">{t('operationalReadiness.residualAcceptance.description')}</p>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getReadinessBadge(residualAcceptanceReadiness.status)}`}>
                    <span data-testid="residual-risk-acceptance-status">
                      {t(`operationalReadiness.statuses.${residualAcceptanceReadiness.status}` as const)}
                    </span>
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border bg-app p-3">
                    <dt className="text-xs text-text-muted">{t('operationalReadiness.residualAcceptance.acceptedTreatments')}</dt>
                    <dd className="mt-1 font-semibold text-text-primary" data-testid="residual-risk-acceptance-count">{residualAcceptanceReadiness.acceptedTreatments}</dd>
                  </div>
                  <div className="rounded-xl border border-border bg-app p-3">
                    <dt className="text-xs text-text-muted">{t('operationalReadiness.residualAcceptance.readyAcceptances')}</dt>
                    <dd className="mt-1 font-semibold text-text-primary" data-testid="residual-risk-acceptance-ready-count">{residualAcceptanceReadiness.acceptedReady}</dd>
                  </div>
                </dl>
                {residualAcceptanceReadiness.gaps.length > 0 && (
                  <ul className="mt-4 space-y-2 text-xs text-text-secondary">
                    {residualAcceptanceReadiness.gaps.map((gap) => (
                      <li key={gap} className="rounded-lg bg-app px-3 py-2">
                        {t(`operationalReadiness.residualAcceptance.gaps.${gap}` as const)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm" data-testid="evidence-vault-readiness-panel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{t('operationalReadiness.evidenceVault.title')}</h3>
                    <p className="mt-1 text-xs text-text-muted">{t('operationalReadiness.evidenceVault.description')}</p>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getReadinessBadge(evidenceVaultReadiness.status)}`}>
                    {t(`operationalReadiness.statuses.${evidenceVaultReadiness.status}` as const)}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border bg-app p-3">
                    <dt className="text-xs text-text-muted">{t('operationalReadiness.evidenceVault.linkedControls')}</dt>
                    <dd className="mt-1 font-semibold text-text-primary">{evidenceVaultReadiness.linkedControls}</dd>
                  </div>
                  <div className="rounded-xl border border-border bg-app p-3">
                    <dt className="text-xs text-text-muted">{t('operationalReadiness.evidenceVault.treatmentsWithControls')}</dt>
                    <dd className="mt-1 font-semibold text-text-primary">
                      {evidenceVaultReadiness.treatmentsWithControls}/{evidenceVaultReadiness.totalTreatments}
                    </dd>
                  </div>
                </dl>
                {evidenceVaultReadiness.gaps.length > 0 && (
                  <ul className="mt-4 space-y-2 text-xs text-text-secondary">
                    {evidenceVaultReadiness.gaps.map((gap) => (
                      <li key={gap} className="rounded-lg bg-app px-3 py-2">
                        {t(`operationalReadiness.evidenceVault.gaps.${gap}` as const)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm">
                <h3 className="text-base font-semibold text-text-primary">{t('detail.treatmentStatus')}</h3>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  {treatmentStatusEntries.map((entry) => (
                    <div key={entry.status} className="flex items-center justify-between">
                      <span>{entry.label}</span>
                      <span className="font-semibold text-text-primary">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </section>

              {linkedControls.length > 0 && (
                <section className="rounded-2xl border border-white/60 bg-surface p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-text-primary">{t('treatment.controls.title')}</h3>
                    <span className="text-xs text-text-muted">
                      {t('treatment.controls.selectedCount', { count: linkedControls.length })}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {linkedControls.map((control) => (
                      <li key={control.id} className="rounded-xl border border-border p-3">
                        <p className="text-sm font-medium text-text-primary">
                          {control.control_code ? `${control.control_code} · ${control.title}` : control.title}
                        </p>
                        <p className="text-xs text-text-muted">{control.category || '-'}</p>
                        {control.description && (
                          <p className="mt-1 text-xs text-text-muted">{control.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
