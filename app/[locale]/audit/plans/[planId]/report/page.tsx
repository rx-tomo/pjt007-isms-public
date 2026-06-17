'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuditAccess } from '@/lib/hooks/useAuditAccess'
import {
  type AuditApprovalStatus,
  type AuditPlanWithRelations,
  type AuditReport,
  type AuditStatus
} from '@/lib/services/audit'
import { buildAuditReportFileName } from '@/lib/utils/exporters/auditReportPdf'

interface ToastState {
  type: 'success' | 'error'
  message: string
}

interface ReportFormState {
  executive_summary: string
  scope: string
  methodology: string
  positive_findings: string
  improvement_opportunities: string
  conclusion: string
  report_date: string
  approval_status: AuditApprovalStatus
  rejection_reason: string
  approved_by: string
}

const STATUS_OPTIONS: AuditStatus[] = ['planning', 'scheduled', 'in_progress', 'completed', 'cancelled']

export default function AuditReportPage(
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
  const { isAuthorized, isLoading: accessLoading, error: accessError } = useAuditAccess()
  const [plan, setPlan] = useState<AuditPlanWithRelations | null>(null)
  const [formState, setFormState] = useState<ReportFormState>({
    executive_summary: '',
    scope: '',
    methodology: '',
    positive_findings: '',
    improvement_opportunities: '',
    conclusion: '',
    report_date: '',
    approval_status: 'draft',
    rejection_reason: '',
    approved_by: ''
  })
  const [status, setStatus] = useState<AuditStatus>('in_progress')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [submittingApproval, setSubmittingApproval] = useState(false)

  const loadData = useCallback(async () => {
    if (!planId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/audit?action=plan&planId=${encodeURIComponent(planId)}`)
      if (!response.ok) {
        throw new Error('failed')
      }
      const planData = await response.json() as AuditPlanWithRelations | null
      if (!planData) {
        setToast({ type: 'error', message: t('report.toast.loadFailed') })
        return
      }
      setPlan(planData)
      setStatus(planData.status)
      if (planData.report) {
        setFormState({
          executive_summary: planData.report.executive_summary || '',
          scope: planData.report.scope || '',
          methodology: planData.report.methodology || '',
          positive_findings: planData.report.positive_findings || '',
          improvement_opportunities: planData.report.improvement_opportunities || '',
          conclusion: planData.report.conclusion || '',
          report_date: planData.report.report_date ? planData.report.report_date.substring(0, 10) : '',
          approval_status: planData.report.approval_status || 'draft',
          rejection_reason: planData.report.rejection_reason || '',
          approved_by: planData.report.approved_by || ''
        })
      }
    } catch (err) {
      console.error('[AuditReport] Failed to load plan', err)
      setToast({ type: 'error', message: t('report.toast.loadFailed') })
    } finally {
      setLoading(false)
    }
  }, [planId, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleChange = (field: keyof ReportFormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!plan) return
    const currentReport = plan.report
      ? Array.isArray(plan.report)
        ? plan.report[0]
        : plan.report
      : null

    setSaving(true)
    try {
      const payload: Partial<AuditReport> = {
        executive_summary: formState.executive_summary || undefined,
        scope: formState.scope || undefined,
        methodology: formState.methodology || undefined,
        positive_findings: formState.positive_findings || undefined,
        improvement_opportunities: formState.improvement_opportunities || undefined,
        conclusion: formState.conclusion || undefined,
        report_date: formState.report_date || undefined
      }

      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auditReport',
          report: {
            id: currentReport?.id,
            audit_plan_id: plan.id,
            ...payload
          }
        })
      })

      if (!response.ok) {
        throw new Error('failed')
      }
      const report = await response.json() as AuditReport
      setFormState(prev => ({
        ...prev,
        approval_status: report.approval_status || 'draft',
        rejection_reason: report.rejection_reason || '',
        approved_by: report.approved_by || '',
      }))

      if (status !== plan.status) {
        const updatedPlan = await fetch('/api/audit', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: plan.id,
            resourceType: 'plan',
            updates: { status }
          })
        })
        if (!updatedPlan.ok) {
          throw new Error('failed')
        }
        const updatedPlanData = await updatedPlan.json() as Partial<AuditPlanWithRelations>
        setPlan(prev => (prev ? { ...prev, ...updatedPlanData, report } : prev))
      } else {
        setPlan(prev => (prev ? { ...prev, report } : prev))
      }

      setToast({ type: 'success', message: t('report.toast.saveSuccess') })
    } catch (err) {
      console.error('[AuditReport] Failed to save report', err)
      setToast({ type: 'error', message: t('report.toast.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitForApproval = async () => {
    if (!plan?.report?.id) {
      setToast({ type: 'error', message: t('report.toast.saveBeforeSubmit') })
      return
    }

    setSubmittingApproval(true)
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitAuditReportApproval',
          reportId: plan.report.id
        })
      })

      if (!response.ok) {
        throw new Error('failed')
      }
      await loadData()
      setToast({ type: 'success', message: t('report.toast.submitSuccess') })
    } catch (error) {
      console.error('[AuditReport] Failed to submit approval request', error)
      setToast({ type: 'error', message: t('report.toast.submitFailed') })
    } finally {
      setSubmittingApproval(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!plan?.report?.id) {
      setToast({ type: 'error', message: t('report.toast.downloadUnavailable') })
      return
    }

    setDownloading(true)
    try {
      const response = await fetch(`/api/audit/reports/${plan.report.id}/export`)

      if (!response.ok) {
        throw new Error('failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${buildAuditReportFileName(plan.title, plan.report.report_date)}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[AuditReport] Failed to download pdf', error)
      setToast({ type: 'error', message: t('report.toast.downloadFailed') })
    } finally {
      setDownloading(false)
    }
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
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">{t('report.title')}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!plan?.report || downloading}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary shadow-sm transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading ? t('report.actions.downloading') : t('report.actions.downloadPdf')}
            </button>
            <Link
              href={`/${locale}/audit/plans/${planId}`}
              className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
            >
              {t('report.actions.backToPlan')}
            </Link>
          </div>
        </div>
        <p className="text-sm text-text-secondary">{t('report.description')}</p>
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
        <div className="mt-8 text-center text-text-muted">{t('report.loading')}</div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{plan?.title}</h2>
                <p className="text-sm text-text-secondary">{t('report.planSummary')}</p>
              </div>
              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('report.fields.status')}</span>
                <select
                  className="rounded-md border border-border px-3 py-2"
                  value={status}
                  onChange={event => setStatus(event.target.value as AuditStatus)}
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {t(`plans.status.${option}` as const)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="grid gap-6">
              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('report.fields.executiveSummary')}</span>
                <textarea
                  data-testid="audit-report-executive-summary"
                  className="min-h-[120px] rounded-md border border-border px-3 py-2"
                  value={formState.executive_summary}
                  onChange={event => handleChange('executive_summary', event.target.value)}
                />
              </label>

              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('report.fields.scope')}</span>
                <textarea
                  data-testid="audit-report-scope"
                  className="min-h-[100px] rounded-md border border-border px-3 py-2"
                  value={formState.scope}
                  onChange={event => handleChange('scope', event.target.value)}
                />
              </label>

              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('report.fields.methodology')}</span>
                <textarea
                  data-testid="audit-report-methodology"
                  className="min-h-[100px] rounded-md border border-border px-3 py-2"
                  value={formState.methodology}
                  onChange={event => handleChange('methodology', event.target.value)}
                />
              </label>

              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('report.fields.positiveFindings')}</span>
                <textarea
                  data-testid="audit-report-positive-findings"
                  className="min-h-[100px] rounded-md border border-border px-3 py-2"
                  value={formState.positive_findings}
                  onChange={event => handleChange('positive_findings', event.target.value)}
                />
              </label>

              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('report.fields.improvementOpportunities')}</span>
                <textarea
                  data-testid="audit-report-improvement-opportunities"
                  className="min-h-[100px] rounded-md border border-border px-3 py-2"
                  value={formState.improvement_opportunities}
                  onChange={event => handleChange('improvement_opportunities', event.target.value)}
                />
              </label>

              <label className="flex flex-col text-sm text-text-secondary">
                <span className="mb-1 font-medium">{t('report.fields.conclusion')}</span>
                <textarea
                  data-testid="audit-report-conclusion"
                  className="min-h-[100px] rounded-md border border-border px-3 py-2"
                  value={formState.conclusion}
                  onChange={event => handleChange('conclusion', event.target.value)}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col text-sm text-text-secondary">
                  <span className="mb-1 font-medium">{t('report.fields.approvalStatus')}</span>
                  <span
                    className="rounded-md border border-border bg-surface-elevated px-3 py-2 font-medium text-text-primary"
                    data-testid="audit-report-approval-status"
                  >
                    {t(`report.approvalStatuses.${formState.approval_status}` as any)}
                  </span>
                </div>
                <label className="flex flex-col text-sm text-text-secondary">
                  <span className="mb-1 font-medium">{t('report.fields.reportDate')}</span>
                  <input
                    type="date"
                    data-testid="audit-report-report-date"
                    className="rounded-md border border-border px-3 py-2"
                    value={formState.report_date}
                    onChange={event => handleChange('report_date', event.target.value)}
                  />
                </label>
                <label className="flex flex-col text-sm text-text-secondary">
                  <span className="mb-1 font-medium">{t('report.fields.approvedBy')}</span>
                  <input
                    type="text"
                    className="rounded-md border border-border px-3 py-2"
                    value={formState.approved_by}
                    readOnly
                  />
                </label>
              </div>

              {formState.approval_status === 'rejected' && (
                <label className="flex flex-col text-sm text-text-secondary">
                  <span className="mb-1 font-medium">差戻し理由</span>
                  <textarea
                    data-testid="audit-report-rejection-reason"
                    className="min-h-[80px] rounded-md border border-border px-3 py-2"
                    value={formState.rejection_reason}
                    onChange={event => handleChange('rejection_reason', event.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={submittingApproval || !plan?.report?.id || formState.approval_status === 'submitted' || formState.approval_status === 'approved'}
                className="rounded-md border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="audit-report-submit-approval"
              >
                {submittingApproval ? t('report.actions.submittingApproval') : t('report.actions.submitApproval')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                data-testid="audit-report-save-button"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                {saving ? t('report.actions.saving') : t('report.actions.save')}
              </button>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  )
}
