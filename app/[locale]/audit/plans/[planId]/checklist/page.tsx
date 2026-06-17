'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuditAccess } from '@/lib/hooks/useAuditAccess'
import {
  AuditService,
  type AuditChecklist,
  type AuditPlanWithRelations,
  type ChecklistStatus,
  type AuditResult,
  type NonconformityType
} from '@/lib/services/audit'

interface ToastState {
  type: 'success' | 'error'
  message: string
}

interface NonconformityForm {
  type: NonconformityType
  description: string
}

const STATUS_OPTIONS: ChecklistStatus[] = ['not_started', 'in_progress', 'completed']
const RESULT_OPTIONS: AuditResult[] = ['conformity', 'minor_nc', 'major_nc', 'observation', 'not_applicable']
const NONCONFORMITY_TYPES: NonconformityType[] = ['major', 'minor']

export default function AuditChecklistPage(
  props: {
    params: Promise<{ locale: string; planId: string }>
  }
) {
  const params = use(props.params);

  const {
    locale,
    planId
  } = params;

  const t = useTranslations('audit')
  const { isAuthorized, isLoading: accessLoading, error: accessError, profile } = useAuditAccess()
  const [plan, setPlan] = useState<AuditPlanWithRelations | null>(null)
  const [checklists, setChecklists] = useState<AuditChecklist[]>([])
  const [filteredAuditorId, setFilteredAuditorId] = useState<string>('all')
  const [nonconformityForms, setNonconformityForms] = useState<Record<string, NonconformityForm>>({})
  const [loading, setLoading] = useState(true)
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null)
  const [uploadingChecklistId, setUploadingChecklistId] = useState<string | null>(null)
  const [creatingNonconformityId, setCreatingNonconformityId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const auditService = useMemo(() => new AuditService(), [])

  const loadData = useCallback(async () => {
    if (!planId) return
    setLoading(true)
    try {
      const planData = await auditService.getAuditPlanById(planId)
      if (!planData) {
        setToast({ type: 'error', message: t('checklist.toast.loadFailed') })
        return
      }
      setPlan(planData)
      setChecklists(planData.checklists || [])
    } catch (err) {
      console.error('[AuditChecklist] Failed to load plan', err)
      setToast({ type: 'error', message: t('checklist.toast.loadFailed') })
    } finally {
      setLoading(false)
    }
  }, [auditService, planId, t])

  useEffect(() => {
    if (accessLoading) return
    if (!isAuthorized) {
      setLoading(false)
      return
    }
    loadData()
  }, [accessLoading, isAuthorized, loadData])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const teamMembers = plan?.team_members || []

  const filteredChecklists = useMemo(() => {
    if (filteredAuditorId === 'all') return checklists
    return checklists.filter(checklist => checklist.auditor_id === filteredAuditorId)
  }, [checklists, filteredAuditorId])

  const handleChecklistFieldChange = (
    checklistId: string,
    field: keyof AuditChecklist,
    value: AuditChecklist[keyof AuditChecklist]
  ) => {
    setChecklists(prev =>
      prev.map(checklist => (checklist.id === checklistId ? { ...checklist, [field]: value } : checklist))
    )
  }

  const handleSaveChecklist = async (checklist: AuditChecklist) => {
    setSavingChecklistId(checklist.id)
    try {
      const updated = await auditService.updateChecklist(checklist.id, {
        status: checklist.status,
        auditor_id: checklist.auditor_id,
        result: checklist.result,
        findings: checklist.findings,
        evidence_provided: checklist.evidence_provided
      })
      setChecklists(prev => prev.map(item => (item.id === checklist.id ? { ...item, ...updated } : item)))
      setToast({ type: 'success', message: t('checklist.toast.saveSuccess') })
    } catch (err) {
      console.error('[AuditChecklist] Failed to save checklist', err)
      setToast({ type: 'error', message: t('checklist.toast.saveFailed') })
    } finally {
      setSavingChecklistId(null)
    }
  }

  const handleEvidenceUpload = async (
    checklist: AuditChecklist,
    file: File | null,
    description: string
  ) => {
    if (!file) {
      setToast({ type: 'error', message: t('checklist.toast.fileRequired') })
      return
    }
    if (!profile?.id) {
      setToast({ type: 'error', message: t('checklist.toast.profileRequired') })
      return
    }

    setUploadingChecklistId(checklist.id)
    try {
      const evidence = await auditService.uploadEvidence(checklist.id, file, profile.id, description)
      setChecklists(prev =>
        prev.map(item =>
          item.id === checklist.id
            ? {
                ...item,
                evidence: [...(item.evidence || []), evidence]
              }
            : item
        )
      )
      setToast({ type: 'success', message: t('checklist.toast.evidenceUploaded') })
    } catch (err) {
      console.error('[AuditChecklist] Failed to upload evidence', err)
      setToast({ type: 'error', message: t('checklist.toast.evidenceFailed') })
    } finally {
      setUploadingChecklistId(null)
    }
  }

  const handleEvidenceDelete = async (checklistId: string, evidenceId: string) => {
    try {
      await auditService.deleteEvidence(evidenceId)
      setChecklists(prev =>
        prev.map(item =>
          item.id === checklistId
            ? {
                ...item,
                evidence: item.evidence?.filter(evidenceItem => evidenceItem.id !== evidenceId)
              }
            : item
        )
      )
      setToast({ type: 'success', message: t('checklist.toast.evidenceDeleted') })
    } catch (err) {
      console.error('[AuditChecklist] Failed to delete evidence', err)
      setToast({ type: 'error', message: t('checklist.toast.evidenceDeleteFailed') })
    }
  }

  const handleCreateNonconformity = async (checklist: AuditChecklist) => {
    const form = nonconformityForms[checklist.id]
    if (!form?.description) {
      setToast({ type: 'error', message: t('checklist.toast.ncDescriptionRequired') })
      return
    }

    setCreatingNonconformityId(checklist.id)
    try {
      const nc = await auditService.createNonconformity({
        audit_checklist_id: checklist.id,
        type: form.type,
        description: form.description,
        status: 'open'
      })
      setChecklists(prev =>
        prev.map(item =>
          item.id === checklist.id
            ? {
                ...item,
                nonconformities: [...(item.nonconformities || []), nc]
              }
            : item
        )
      )
      setNonconformityForms(prev => ({ ...prev, [checklist.id]: { type: 'minor', description: '' } }))
      setToast({ type: 'success', message: t('checklist.toast.ncCreated') })
    } catch (err) {
      console.error('[AuditChecklist] Failed to create nonconformity', err)
      setToast({ type: 'error', message: t('checklist.toast.ncFailed') })
    } finally {
      setCreatingNonconformityId(null)
    }
  }

  const renderChecklistCard = (checklist: AuditChecklist) => {
    return (
      <div key={checklist.id} className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-muted">
              {checklist.requirement?.clause_number || t('checklist.labels.manualItem')}
            </p>
            <h3 className="text-lg font-semibold text-text-primary">{checklist.requirement?.title || checklist.check_item}</h3>
            {checklist.requirement?.description && (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {checklist.requirement.description}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              checklist.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : checklist.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-surface-elevated text-text-primary'
            }`}
          >
            {t(`checklist.status.${checklist.status}` as const)}
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-sm text-text-secondary">
            <span className="mb-1 font-medium">{t('checklist.fields.status')}</span>
            <select
              className="rounded-md border border-border px-3 py-2"
              value={checklist.status}
              onChange={event => handleChecklistFieldChange(checklist.id, 'status', event.target.value as ChecklistStatus)}
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>
                  {t(`checklist.status.${status}` as const)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-text-secondary">
            <span className="mb-1 font-medium">{t('checklist.fields.result')}</span>
            <select
              className="rounded-md border border-border px-3 py-2"
              value={checklist.result || ''}
              onChange={event => handleChecklistFieldChange(checklist.id, 'result', event.target.value as AuditResult)}
            >
              <option value="">{t('checklist.fields.resultPlaceholder')}</option>
              {RESULT_OPTIONS.map(result => (
                <option key={result} value={result}>
                  {t(`checklist.result.${result}` as const)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-text-secondary">
            <span className="mb-1 font-medium">{t('checklist.fields.assignee')}</span>
            <select
              className="rounded-md border border-border px-3 py-2"
              value={checklist.auditor_id || ''}
              onChange={event => handleChecklistFieldChange(checklist.id, 'auditor_id', event.target.value || null)}
            >
              <option value="">{t('checklist.fields.assigneePlaceholder')}</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.user_id}>
                  {member.user?.full_name || member.user?.email || t('checklist.labels.unknownUser')}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-text-secondary">
            <span className="mb-1 font-medium">{t('checklist.fields.evidence')}</span>
            <textarea
              className="min-h-[80px] rounded-md border border-border px-3 py-2"
              value={checklist.evidence_provided || ''}
              onChange={event => handleChecklistFieldChange(checklist.id, 'evidence_provided', event.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 flex flex-col text-sm text-text-secondary">
          <span className="mb-1 font-medium">{t('checklist.fields.findings')}</span>
          <textarea
            className="min-h-[100px] rounded-md border border-border px-3 py-2"
            value={checklist.findings || ''}
            onChange={event => handleChecklistFieldChange(checklist.id, 'findings', event.target.value)}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleSaveChecklist(checklist)}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingChecklistId === checklist.id}
          >
            {savingChecklistId === checklist.id ? t('checklist.actions.saving') : t('checklist.actions.save')}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-text-primary">{t('checklist.sections.evidence')}</h4>
            <p className="text-xs text-text-muted">{t('checklist.sections.evidenceDescription')}</p>
            <form
              className="mt-3 space-y-3"
              onSubmit={event => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                const file = formData.get('file') as File | null
                const description = (formData.get('description') as string) || ''
                handleEvidenceUpload(checklist, file, description)
                event.currentTarget.reset()
              }}
            >
              <input name="file" type="file" className="block w-full text-sm text-text-secondary" />
              <input
                name="description"
                type="text"
                placeholder={t('checklist.fields.evidenceDescriptionPlaceholder')}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
                disabled={uploadingChecklistId === checklist.id}
              >
                {uploadingChecklistId === checklist.id
                  ? t('checklist.actions.uploading')
                  : t('checklist.actions.uploadEvidence')}
              </button>
            </form>
            <ul className="mt-4 space-y-2">
              {(checklist.evidence || []).map(evidence => (
                <li key={evidence.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-text-primary">{evidence.file_name}</p>
                    <p className="text-xs text-text-muted">
                      {evidence.description || t('checklist.labels.noDescription')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="#"
                      className="text-indigo-600 hover:text-indigo-700"
                      onClick={async event => {
                        event.preventDefault()
                        try {
                          const url = await auditService.getEvidenceUrl(evidence.file_path)
                          window.open(url, '_blank', 'noopener')
                        } catch (err) {
                          console.error('[AuditChecklist] Failed to open evidence', err)
                          setToast({ type: 'error', message: t('checklist.toast.evidenceOpenFailed') })
                        }
                      }}
                    >
                      {t('checklist.actions.viewEvidence')}
                    </Link>
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:text-red-700"
                      onClick={() => handleEvidenceDelete(checklist.id, evidence.id)}
                    >
                      {t('checklist.actions.deleteEvidence')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-text-primary">{t('checklist.sections.nonconformity')}</h4>
            <p className="text-xs text-text-muted">{t('checklist.sections.nonconformityDescription')}</p>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('checklist.fields.ncType')}</span>
                <select
                  className="rounded-md border border-border px-3 py-2"
                  value={nonconformityForms[checklist.id]?.type || 'minor'}
                  onChange={event =>
                    setNonconformityForms(prev => ({
                      ...prev,
                      [checklist.id]: {
                        type: event.target.value as NonconformityType,
                        description: prev[checklist.id]?.description || ''
                      }
                    }))
                  }
                >
                  {NONCONFORMITY_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`checklist.ncType.${type}` as const)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('checklist.fields.ncDescription')}</span>
                <textarea
                  className="min-h-[80px] rounded-md border border-border px-3 py-2"
                  value={nonconformityForms[checklist.id]?.description || ''}
                  onChange={event =>
                    setNonconformityForms(prev => ({
                      ...prev,
                      [checklist.id]: {
                        type: prev[checklist.id]?.type || 'minor',
                        description: event.target.value
                      }
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => handleCreateNonconformity(checklist)}
                disabled={creatingNonconformityId === checklist.id}
              >
                {creatingNonconformityId === checklist.id
                  ? t('checklist.actions.creatingNc')
                  : t('checklist.actions.createNc')}
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {(checklist.nonconformities || []).map(nc => (
                <li key={nc.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-900">
                      {t(`checklist.ncType.${nc.type}` as const)}
                    </span>
                    <span className="text-xs text-amber-800">{t(`checklist.ncStatus.${nc.status}` as const)}</span>
                  </div>
                  <p className="mt-1 text-amber-900 whitespace-pre-wrap">{nc.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout locale={locale}>
      {!isAuthorized && !accessLoading ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-900">
          <h3 className="text-sm font-semibold">{t('accessDenied.title')}</h3>
          <p className="mt-2 text-sm">
            {accessError === 'permission_fetch_failed'
              ? t('accessDenied.permissionFetchFailed')
              : t('accessDenied.description')}
          </p>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t('checklist.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('checklist.description')}</p>
        </div>
        <Link
          href={`/${locale}/audit/plans/${planId}`}
          className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
        >
          {t('checklist.actions.backToPlan')}
        </Link>
      </div>

      {toast && (
        <div
          role="status"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-center text-text-muted">{t('checklist.loading')}</div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{plan?.title}</h2>
                <p className="text-sm text-text-secondary">{t('checklist.planSummary')}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="font-medium">{t('checklist.filters.assignee')}</span>
                  <select
                    className="rounded-md border border-border px-3 py-2"
                    value={filteredAuditorId}
                    onChange={event => setFilteredAuditorId(event.target.value)}
                  >
                    <option value="all">{t('checklist.filters.all')}</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.user_id}>
                        {member.user?.full_name || member.user?.email || t('checklist.labels.unknownUser')}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {filteredChecklists.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-text-muted">
                {t('checklist.empty')}
              </div>
            ) : (
              filteredChecklists.map(checklist => renderChecklistCard(checklist))
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  )
}
