'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  IsoControlService,
  type IsoControl,
  type SoaVersion,
  type SoaDecisionStatus,
  type SoaReadinessControl
} from '@/lib/services/isoControl'
import { UserService } from '@/lib/services/user'
import { OrganizationService } from '@/lib/services/organization'
import type { UserProfile } from '@/lib/services/user'
import { useToast } from '@/components/ui/ToastProvider'
import { ControlTemplateWizard } from '@/components/settings/controls/ControlTemplateWizard'

interface ControlFormState {
  id?: string
  title: string
  category: string
  controlCode: string
  description: string
  tags: string
}

interface SoaDecisionDraft {
  status: SoaDecisionStatus
  applicabilityReason: string
  exclusionReason: string
}

const defaultFormState: ControlFormState = {
  title: '',
  category: '',
  controlCode: '',
  description: '',
  tags: ''
}

const parseTags = (value: string): string[] =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)

export default function ControlsManagementPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.controls')
  const router = useRouter()
  const { pushToast } = useToast()

  const isoControlService = useMemo(() => new IsoControlService(), [])
  const userService = useMemo(() => new UserService(), [])
  const organizationService = useMemo(() => new OrganizationService(), [])

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [hasAccess, setHasAccess] = useState(true)

  const [controls, setControls] = useState<IsoControl[]>([])
  const [soaRows, setSoaRows] = useState<SoaReadinessControl[]>([])
  const [soaVersions, setSoaVersions] = useState<SoaVersion[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSoaLoading, setIsSoaLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savingSoaId, setSavingSoaId] = useState<string | null>(null)
  const [submittingSoaId, setSubmittingSoaId] = useState<string | null>(null)
  const [isPublishingSoaVersion, setIsPublishingSoaVersion] = useState(false)
  const [isSubmittingSoaVersionReview, setIsSubmittingSoaVersionReview] = useState(false)
  const [soaVersionChangeSummary, setSoaVersionChangeSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ControlFormState>(defaultFormState)
  const [soaDrafts, setSoaDrafts] = useState<Record<string, SoaDecisionDraft>>({})
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  const resetForm = useCallback(() => {
    setForm(defaultFormState)
    setIsEditing(false)
  }, [])

  const ensureAccess = useCallback(
    async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [user, org] = await Promise.all([
          userService.getCurrentUser(),
          organizationService.getCurrentOrganization()
        ])

        if (!user || !org) {
          router.push(`/${locale}/auth/login`)
          return
        }

        setCurrentUser(user)
        setOrganizationId(org.id)

        if (['system_operator', 'org_admin'].includes(user.role)) {
          setHasAccess(true)
          return
        }

        setHasAccess(false)
        try {
          router.push(`/${locale}/home`)
        } catch {}
        return
      } catch (err) {
        console.error('Failed to load access context', err)
        setError(t('errors.loadFailed'))
        setHasAccess(false)
      } finally {
        setIsLoading(false)
      }
    },
    [locale, organizationService, router, t, userService]
  )

  useEffect(() => {
    ensureAccess()
  }, [ensureAccess])

  const loadControls = useCallback(async () => {
    if (!organizationId) return
    try {
      const data = await isoControlService.searchControls(
        organizationId,
        search,
        categoryFilter || undefined
      )
      setControls(data)
    } catch (err) {
      console.error('Failed to load ISO controls', err)
      setError(t('errors.loadFailed'))
    }
  }, [categoryFilter, isoControlService, organizationId, search, t])

  const loadSoaReadiness = useCallback(async () => {
    if (!organizationId) return
    setIsSoaLoading(true)
    try {
      const data = await isoControlService.getSoaReadiness(organizationId)
      setSoaRows(data)
      setSoaDrafts((prev) => {
        const next = { ...prev }
        data.forEach((row) => {
          next[row.id] = {
            status: (row.soa_status as SoaDecisionStatus | null) ?? 'not_reviewed',
            applicabilityReason: row.soa_applicability_reason ?? '',
            exclusionReason: row.soa_exclusion_reason ?? '',
          }
        })
        return next
      })
    } catch (err) {
      console.error('Failed to load applicability decision readiness', err)
      setError(t('errors.loadSoaFailed'))
    } finally {
      setIsSoaLoading(false)
    }
  }, [isoControlService, organizationId, t])

  const loadSoaVersions = useCallback(async () => {
    if (!organizationId) return
    try {
      const data = await isoControlService.getSoaVersions(organizationId)
      setSoaVersions(data)
    } catch (err) {
      console.error('Failed to load applicability decision versions', err)
      setError(t('errors.loadSoaVersionsFailed'))
    }
  }, [isoControlService, organizationId, t])

  const handleTemplatesSeeded = useCallback(async () => {
    await loadControls()
    if (organizationId) {
      try {
        const categoryList = await isoControlService.getCategories(organizationId)
        setCategories(categoryList)
      } catch (err) {
        console.warn('Failed to refresh categories after seeding', err)
      }
    }
  }, [loadControls, isoControlService, organizationId])

  useEffect(() => {
    if (!organizationId || !hasAccess) return
    const handler = setTimeout(() => {
      loadControls()
      loadSoaReadiness()
      loadSoaVersions()
    }, 300)
    return () => clearTimeout(handler)
  }, [organizationId, hasAccess, search, categoryFilter, loadControls, loadSoaReadiness, loadSoaVersions])

  useEffect(() => {
    if (!organizationId || !hasAccess) return
    ;(async () => {
      try {
        const categoryList = await isoControlService.getCategories(organizationId)
        setCategories(categoryList)
      } catch (err) {
        console.error('Failed to load ISO control categories', err)
      }
    })()
  }, [organizationId, hasAccess, isoControlService])

  const handleOpenCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleEdit = (control: IsoControl) => {
    setForm({
      id: control.id,
      title: control.title,
      category: control.category,
      controlCode: control.control_code ?? '',
      description: control.description ?? '',
      tags: (control.tags ?? []).join(', ')
    })
    setIsEditing(true)
    setShowForm(true)
  }

  const handleDelete = async (control: IsoControl) => {
    if (!organizationId) return
    const confirmed = window.confirm(
      t('actions.confirmDelete', { title: control.title })
    )
    if (!confirmed) return

    try {
      await isoControlService.deleteControl(control.id)
      pushToast({ message: t('messages.deleted', { title: control.title }), variant: 'success' })
      await loadControls()
      await loadSoaReadiness()
      const categoryList = await isoControlService.getCategories(organizationId)
      setCategories(categoryList)
    } catch (err) {
      console.error('Failed to delete ISO control', err)
      setError(t('errors.deleteFailed'))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!organizationId) return

    setIsSaving(true)
    setError(null)

    const payload = {
      organization_id: organizationId,
      category: form.category.trim(),
      title: form.title.trim(),
      control_code: form.controlCode.trim() || null,
      description: form.description.trim() || null,
      tags: parseTags(form.tags)
    }

    try {
      if (!payload.category || !payload.title) {
        setError(t('errors.required'))
        return
      }

      if (isEditing && form.id) {
        await isoControlService.updateControl(form.id, {
          category: payload.category,
          title: payload.title,
          control_code: payload.control_code,
          description: payload.description,
          tags: payload.tags
        })
        pushToast({ message: t('messages.updated', { title: payload.title }), variant: 'success' })
      } else {
        await isoControlService.createControl(payload)
        pushToast({ message: t('messages.created', { title: payload.title }), variant: 'success' })
      }

      resetForm()
      setShowForm(false)
      await loadControls()
      await loadSoaReadiness()
      const categoryList = await isoControlService.getCategories(organizationId)
      setCategories(categoryList)
    } catch (err) {
      console.error('Failed to save ISO control', err)
      setError(t('errors.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const updateSoaDraft = (controlId: string, patch: Partial<SoaDecisionDraft>) => {
    setSoaDrafts((prev) => ({
      ...prev,
      [controlId]: {
        status: prev[controlId]?.status ?? 'not_reviewed',
        applicabilityReason: prev[controlId]?.applicabilityReason ?? '',
        exclusionReason: prev[controlId]?.exclusionReason ?? '',
        ...patch,
      },
    }))
  }

  const handleSaveSoaDecision = async (row: SoaReadinessControl) => {
    if (!organizationId) return
    const draft = soaDrafts[row.id] ?? {
      status: (row.soa_status as SoaDecisionStatus | null) ?? 'not_reviewed',
      applicabilityReason: row.soa_applicability_reason ?? '',
      exclusionReason: row.soa_exclusion_reason ?? '',
    }

    setSavingSoaId(row.id)
    setError(null)
    try {
      await isoControlService.updateSoaDecision({
        id: row.id,
        organizationId,
        soaStatus: draft.status,
        soaApplicabilityReason: draft.applicabilityReason,
        soaExclusionReason: draft.exclusionReason,
      })
      pushToast({ message: t('soa.messages.saved', { title: row.title }), variant: 'success' })
      await loadSoaReadiness()
    } catch (err) {
      console.error('Failed to save applicability decision', err)
      setError(t('errors.saveSoaFailed'))
    } finally {
      setSavingSoaId(null)
    }
  }

  const handleSubmitSoaApproval = async (row: SoaReadinessControl) => {
    if (!organizationId) return
    setSubmittingSoaId(row.id)
    setError(null)
    try {
      await isoControlService.submitSoaApproval({
        id: row.id,
        organizationId,
      })
      pushToast({ message: t('soa.messages.submitted', { title: row.title }), variant: 'success' })
      await loadSoaReadiness()
      await loadSoaVersions()
    } catch (err) {
      console.error('Failed to submit applicability decision approval', err)
      setError(t('errors.submitSoaFailed'))
    } finally {
      setSubmittingSoaId(null)
    }
  }

  const handlePublishSoaVersion = async () => {
    if (!organizationId) return
    setIsPublishingSoaVersion(true)
    setError(null)
    try {
      const result = await isoControlService.publishSoaVersion(organizationId, soaVersionChangeSummary)
      pushToast({
        message: t('soa.messages.versionPublished', {
          version: result.version.versionNumber ?? result.version.version_number ?? '-',
        }),
        variant: 'success',
      })
      setSoaVersionChangeSummary('')
      await loadSoaVersions()
    } catch (err) {
      console.error('Failed to publish applicability decision version', err)
      setError(t('errors.publishSoaVersionFailed'))
    } finally {
      setIsPublishingSoaVersion(false)
    }
  }

  const handleSubmitSoaVersionReview = async () => {
    if (!organizationId || !latestSoaVersion) return
    setIsSubmittingSoaVersionReview(true)
    setError(null)
    try {
      await isoControlService.submitSoaVersionReview(organizationId, latestSoaVersion.id)
      pushToast({
        message: t('soa.messages.versionReviewSubmitted', {
          version: latestSoaVersionNumber ?? '-',
        }),
        variant: 'success',
      })
      await loadSoaVersions()
    } catch (err) {
      console.error('Failed to submit applicability decision version review', err)
      setError(t('errors.submitSoaVersionReviewFailed'))
    } finally {
      setIsSubmittingSoaVersionReview(false)
    }
  }

  const filteredControls = controls

  const soaSummary = useMemo(() => {
    const total = soaRows.length
    const linked = soaRows.filter((row) => row.applicability === 'linked').length
    const ready = soaRows.filter((row) => row.completedTreatmentCount > 0).length
    return {
      total,
      linked,
      ready,
      unlinked: Math.max(total - linked, 0),
    }
  }, [soaRows])

  const latestSoaVersion = soaVersions[0]
  const latestSoaVersionNumber = latestSoaVersion?.versionNumber ?? latestSoaVersion?.version_number
  const latestSoaVersionPublishedAt = latestSoaVersion?.publishedAt ?? latestSoaVersion?.published_at
  const latestSoaVersionChangeSummary = latestSoaVersion?.changeSummary ?? latestSoaVersion?.change_summary
  const latestSoaVersionReviewStatus = latestSoaVersion?.reviewStatus ?? latestSoaVersion?.review_status ?? 'draft'
  const latestSoaVersionRejectionReason = latestSoaVersion?.rejectionReason ?? latestSoaVersion?.rejection_reason
  const latestSoaDiff = latestSoaVersion?.diffFromPrevious ?? null

  const existingTemplateMap = useMemo(() => {
    const map = new Map<string, IsoControl>()
    controls.forEach(control => {
      if (control.template_key) {
        map.set(control.template_key, control)
      }
    })
    return map
  }, [controls])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-surface shadow-sm rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-surface-elevated rounded w-1/3"></div>
            <div className="h-4 bg-surface-elevated rounded w-1/4"></div>
            <div className="h-48 bg-surface-elevated rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto bg-surface border border-border rounded-lg p-8 text-center">
          <h1 className="text-2xl font-semibold text-text-primary mb-3">{t('noAccess.title')}</h1>
          <p className="text-text-secondary mb-6">{t('noAccess.description')}</p>
          <button
            onClick={() => router.push(`/${locale}/home`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {t('noAccess.back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface shadow-sm rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
            <p className="text-text-secondary">{t('description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsWizardOpen(true)}
              disabled={!organizationId}
              className="px-4 py-2 rounded-md border border-indigo-200 bg-surface text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              {t('actions.openWizard')}
            </button>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('actions.create')}
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('filters.search')}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filters.searchPlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('filters.category')}
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('filters.allCategories')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="bg-surface shadow-sm rounded-lg p-6" data-testid="soa-readiness-panel">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{t('soa.title')}</h2>
            <p className="mt-1 text-sm text-text-secondary">{t('soa.description')}</p>
          </div>
          <button
            type="button"
            onClick={() => loadSoaReadiness()}
            disabled={isSoaLoading || !organizationId}
            className="px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-surface-elevated disabled:opacity-60"
          >
            {isSoaLoading ? t('soa.actions.loading') : t('soa.actions.refresh')}
          </button>
          <button
            type="button"
            onClick={handlePublishSoaVersion}
            disabled={isPublishingSoaVersion || !organizationId || soaRows.length === 0}
            className="px-3 py-2 text-sm font-medium rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
            data-testid="soa-version-publish"
          >
            {isPublishingSoaVersion ? t('soa.actions.publishingVersion') : t('soa.actions.publishVersion')}
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium text-text-secondary" htmlFor="soa-version-change-summary">
          {t('soa.version.changeSummaryLabel')}
        </label>
        <textarea
          id="soa-version-change-summary"
          value={soaVersionChangeSummary}
          onChange={(event) => setSoaVersionChangeSummary(event.target.value)}
          rows={2}
          placeholder={t('soa.version.changeSummaryPlaceholder')}
          className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
          data-testid="soa-version-change-summary"
        />
        <div className="mt-4 rounded-md border border-border bg-surface-elevated px-4 py-3 text-sm text-text-secondary" data-testid="soa-version-summary">
          {latestSoaVersion
            ? t('soa.version.latest', {
                version: latestSoaVersionNumber ?? '-',
                count: latestSoaVersion.controlCount ?? latestSoaVersion.control_count ?? 0,
                date: latestSoaVersionPublishedAt ? new Date(latestSoaVersionPublishedAt).toLocaleString(locale) : '-',
              })
            : t('soa.version.none')}
        </div>
        {latestSoaVersionChangeSummary && (
          <div className="mt-2 text-sm text-text-secondary" data-testid="soa-version-change-summary-latest">
            {t('soa.version.latestChangeSummary', { summary: latestSoaVersionChangeSummary })}
          </div>
        )}
        {latestSoaVersion && (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-border px-4 py-3 text-sm text-text-secondary md:flex-row md:items-center md:justify-between">
            <div>
              <p data-testid="soa-version-review-status">
                {t(`soa.version.reviewStatus.${latestSoaVersionReviewStatus}`)}
              </p>
              {latestSoaVersionRejectionReason && (
                <p className="mt-1 text-xs text-red-600" data-testid="soa-version-review-rejection-reason">
                  {t('soa.version.reviewRejectionReason', { reason: latestSoaVersionRejectionReason })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmitSoaVersionReview}
              disabled={
                isSubmittingSoaVersionReview ||
                latestSoaVersionReviewStatus === 'submitted' ||
                latestSoaVersionReviewStatus === 'approved'
              }
              className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              data-testid="soa-version-review-submit"
            >
              {isSubmittingSoaVersionReview ? t('soa.actions.submitting') : t('soa.actions.submitVersionReview')}
            </button>
          </div>
        )}
        {latestSoaDiff && (
          <div
            className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950"
            data-testid="soa-version-diff-summary"
          >
            <p className="font-semibold">
              {t('soa.version.diffSummary', {
                added: latestSoaDiff.addedCount,
                removed: latestSoaDiff.removedCount,
                changed: latestSoaDiff.changedCount,
              })}
            </p>
            {latestSoaDiff.changedControls.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {latestSoaDiff.changedControls.slice(0, 3).map((control) => (
                  <li key={control.id} data-testid={`soa-version-diff-control-${control.id}`}>
                    {control.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs font-medium text-text-muted">{t('soa.summary.total')}</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary" data-testid="soa-summary-total">{soaSummary.total}</p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-700">{t('soa.summary.linked')}</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900" data-testid="soa-summary-linked">{soaSummary.linked}</p>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-700">{t('soa.summary.ready')}</p>
            <p className="mt-1 text-2xl font-semibold text-blue-900" data-testid="soa-summary-ready">{soaSummary.ready}</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">{t('soa.summary.unlinked')}</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900" data-testid="soa-summary-unlinked">{soaSummary.unlinked}</p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('soa.table.control')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('soa.table.status')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('soa.table.links')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('soa.table.evidence')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">{t('soa.table.decision')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">{t('soa.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {soaRows.map((row) => {
                const draft = soaDrafts[row.id] ?? {
                  status: (row.soa_status as SoaDecisionStatus | null) ?? 'not_reviewed',
                  applicabilityReason: row.soa_applicability_reason ?? '',
                  exclusionReason: row.soa_exclusion_reason ?? '',
                }
                return (
                  <tr key={`soa-${row.id}`} data-testid={`soa-row-${row.id}`}>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm font-medium text-text-primary">{row.control_code ? `${row.control_code} ` : ''}{row.title}</p>
                      <p className="mt-1 text-xs text-text-muted">{row.category}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.applicability === 'linked'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.applicability === 'linked' ? t('soa.status.linked') : t('soa.status.unlinked')}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-text-secondary">
                      <p>{t('soa.links.risks', { count: row.linkedRiskCount })}</p>
                      <p>{t('soa.links.treatments', { count: row.linkedTreatmentCount })}</p>
                      {row.treatments.slice(0, 2).map((treatment) => (
                        <p key={treatment.id} className="mt-1 text-xs text-text-muted">{treatment.riskTitle}</p>
                      ))}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-text-secondary">
                      {row.completedTreatmentCount > 0
                        ? t('soa.evidence.ready', { count: row.completedTreatmentCount })
                        : t('soa.evidence.notReady')}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-2 min-w-64">
                        <select
                          value={draft.status}
                          onChange={(event) => updateSoaDraft(row.id, { status: event.target.value as SoaDecisionStatus })}
                          className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                          data-testid={`soa-decision-status-${row.id}`}
                        >
                          <option value="not_reviewed">{t('soa.decision.status.notReviewed')}</option>
                          <option value="applicable">{t('soa.decision.status.applicable')}</option>
                          <option value="not_applicable">{t('soa.decision.status.notApplicable')}</option>
                        </select>
                        <textarea
                          value={draft.applicabilityReason}
                          onChange={(event) => updateSoaDraft(row.id, { applicabilityReason: event.target.value })}
                          rows={2}
                          placeholder={t('soa.decision.applicabilityReason')}
                          className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                          data-testid={`soa-decision-reason-${row.id}`}
                        />
                        {draft.status === 'not_applicable' && (
                          <textarea
                            value={draft.exclusionReason}
                            onChange={(event) => updateSoaDraft(row.id, { exclusionReason: event.target.value })}
                            rows={2}
                            placeholder={t('soa.decision.exclusionReason')}
                            className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                            data-testid={`soa-exclusion-reason-${row.id}`}
                          />
                        )}
                        {row.soa_reviewed_at && (
                          <p className="text-xs text-text-muted">{t('soa.decision.reviewedAt', { date: new Date(row.soa_reviewed_at).toLocaleDateString(locale) })}</p>
                        )}
                        <p className="text-xs text-text-secondary" data-testid={`soa-approval-status-${row.id}`}>
                          {t(`soa.approval.status.${row.soa_approval_status ?? 'draft'}`)}
                        </p>
                        {row.soa_rejection_reason && (
                          <p
                            className="text-xs text-red-600"
                            data-testid={`soa-rejection-reason-${row.id}`}
                          >
                            {t('soa.approval.rejectionReason', { reason: row.soa_rejection_reason })}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveSoaDecision(row)}
                          disabled={savingSoaId === row.id}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                          data-testid={`soa-decision-save-${row.id}`}
                        >
                          {savingSoaId === row.id ? t('soa.actions.saving') : t('soa.actions.saveDecision')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitSoaApproval(row)}
                          disabled={
                            submittingSoaId === row.id ||
                            row.soa_status === 'not_reviewed' ||
                            row.soa_approval_status === 'submitted' ||
                            row.soa_approval_status === 'approved'
                          }
                          className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          data-testid={`soa-approval-submit-${row.id}`}
                        >
                          {submittingSoaId === row.id ? t('soa.actions.submitting') : t('soa.actions.submitApproval')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {soaRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
                    {isSoaLoading ? t('soa.states.loading') : t('soa.states.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface shadow-sm rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t('table.columns.title')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t('table.columns.category')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t('table.columns.controlCode')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t('table.columns.updatedAt')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t('table.columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {filteredControls.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                    {t('table.empty')}
                  </td>
                </tr>
              ) : (
                filteredControls.map((control) => (
                  <tr key={control.id}>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm font-medium text-text-primary">{control.title}</p>
                      {control.description && (
                        <p className="mt-1 text-xs text-text-muted">{control.description}</p>
                      )}
                      {control.tags && control.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {control.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{control.category}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{control.control_code || '-'}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">
                      {control.updated_at ? new Date(control.updated_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(control)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        {t('actions.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(control)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        {t('actions.delete')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="bg-surface shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            {isEditing ? t('form.editTitle') : t('form.createTitle')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('form.fields.title')}
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('form.fields.category')}
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {t('form.fields.controlCode')}
                </label>
                <input
                  type="text"
                  value={form.controlCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, controlCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('form.fields.controlCodePlaceholder')}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('form.fields.description')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('form.fields.tags')}
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder={t('form.fields.tagsPlaceholder')}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-text-muted">{t('form.fields.tagsHint')}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-elevated"
              >
                {t('form.actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
              >
                {isSaving ? t('form.actions.saving') : t('form.actions.save')}
              </button>
            </div>
          </form>
        </div>
      )}
      {organizationId && (
        <ControlTemplateWizard
          open={isWizardOpen}
          locale={locale}
          organizationId={organizationId}
          existingControls={existingTemplateMap}
          onClose={() => setIsWizardOpen(false)}
          onSeeded={handleTemplatesSeeded}
        />
      )}
    </div>
  )
}
