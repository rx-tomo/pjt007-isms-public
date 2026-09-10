'use client'

import { useEffect, useMemo, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { RiskService } from '@/lib/services/risk'
import { OrganizationService } from '@/lib/services/organization'
import { UserService } from '@/lib/services/user'
import type { RiskWithRelations } from '@/lib/services/risk'
import {
  aggregateRisks,
  createRiskGapPdf,
  sanitizeRiskGapFileName,
  summarizeRiskTotals
} from '@/lib/utils/exporters/riskGapAnalysis'

export default function RiskGapAnalysisPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('risks.gapAnalysis')
  const permissionT = useTranslations('tasks.errors')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [risks, setRisks] = useState<RiskWithRelations[]>([])
  const [permissionDenied, setPermissionDenied] = useState(false)
  const riskService = useMemo(() => new RiskService(), [])
  const organizationService = useMemo(() => new OrganizationService(), [])
  const userService = useMemo(() => new UserService(), [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const profile = await userService.getUserProfile()
        if (!profile) {
          router.push(`/${locale}/auth/login`)
          return
        }
        if (profile.effective_capabilities?.modules.risks.read !== true) {
          setPermissionDenied(true)
          return
        }
        setPermissionDenied(false)
        const org = await organizationService.getCurrentOrganization()
        if (!org) return
        setOrganizationId(org.id)
        const riskList = await riskService.getRisks(org.id)
        setRisks(riskList)
      } catch (error) {
        console.error('Failed to load gap analysis data', error)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [locale, organizationService, riskService, router, userService])

  const aggregated = useMemo(() => aggregateRisks(risks), [risks])
  const totals = useMemo(() => summarizeRiskTotals(aggregated), [aggregated])

  const handleExportCsv = () => {
    const header = ['category', 'status', 'count']
    const rows = aggregated.map(row => [row.category, row.status, String(row.count)])
    const csv = [header, ...rows].map(columns => columns.join(',')).join('\n')
    triggerDownload(csv, `${sanitizeRiskGapFileName('risk-gap-analysis')}.csv`, 'text/csv;charset=utf-8')
  }

  const handleExportPdf = () => {
    const lines = [
      t('exportTitle'),
      `Organization: ${organizationId ?? '—'}`,
      ''
    ]
    aggregated.forEach(row => {
      lines.push(`${row.category} / ${row.status} : ${row.count}`)
    })
    const pdf = createRiskGapPdf(lines)
    triggerBlobDownload(pdf, `${sanitizeRiskGapFileName('risk-gap-analysis')}.pdf`)
  }

  if (permissionDenied) {
    return (
      <DashboardLayout locale={locale}>
        <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-700 shadow-sm">
            <h1 className="text-lg font-semibold">{permissionT('permissionDenied')}</h1>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
              disabled={aggregated.length === 0}
            >
              {t('exportCsv')}
            </button>
            <button
              onClick={handleExportPdf}
              className="rounded-full border border-blue-500 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100"
              disabled={aggregated.length === 0}
            >
              {t('exportPdf')}
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : aggregated.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-sm text-text-secondary">
            {t('empty')}
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {t('columns.category')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {t('columns.status')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {t('columns.count')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aggregated.map(row => (
                  <tr key={`${row.category}-${row.status}`}>
                    <td className="px-4 py-3 text-sm text-text-primary">{row.category}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{row.status}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-text-primary">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {!isLoading && aggregated.length > 0 && (
          <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
            <h2 className="text-sm font-semibold text-blue-700">{t('summary.title')}</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-blue-600">{t('summary.total')}</dt>
                <dd className="text-lg font-semibold text-blue-900">{totals.total}</dd>
              </div>
              <div>
                <dt className="text-xs text-blue-600">{t('summary.open')}</dt>
                <dd className="text-lg font-semibold text-blue-900">{totals.open}</dd>
              </div>
              <div>
                <dt className="text-xs text-blue-600">{t('summary.treating')}</dt>
                <dd className="text-lg font-semibold text-blue-900">{totals.treating}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}

function triggerDownload(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  triggerBlobDownload(blob, fileName)
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}
