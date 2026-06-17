'use client'

import { useState, useCallback, useRef, useEffect, use } from 'react';
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { UserService } from '@/lib/services/user'
import { OrganizationService } from '@/lib/services/organization'

type SectionKey = 'organizationData' | 'auditUnits' | 'risks' | 'tasks' | 'assets'

type ParsedRow = {
  name: string
  unit_type: string
  description: string
}

type ImportResult = {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

type SectionCounts = {
  auditUnits: number
  risks: number
  tasks: number
  assets: number
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function StatusBadge({ count, t }: { count: number; t: ReturnType<typeof useTranslations> }) {
  if (count > 0) {
    return (
      <span className="text-sm px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        {t('status.itemsRegistered', { count })}
      </span>
    )
  }
  return (
    <span className="text-sm px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary">
      {t('status.notStarted')}
    </span>
  )
}

function ImportResultDisplay({ result, t }: { result: ImportResult; t: (key: string) => string }) {
  return (
    <div className="mt-4 bg-surface border rounded-lg p-4">
      <h4 className="text-sm font-semibold text-text-primary mb-3">{t('result')}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-green-700">{result.created}</p>
          <p className="text-xs text-green-600">{t('created')}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-blue-700">{result.updated}</p>
          <p className="text-xs text-blue-600">{t('updated')}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-yellow-700">{result.skipped}</p>
          <p className="text-xs text-yellow-600">{t('skipped')}</p>
        </div>
        <div className={`rounded-lg p-2 text-center ${result.errors.length > 0 ? 'bg-red-50' : 'bg-surface-elevated'}`}>
          <p className={`text-xl font-bold ${result.errors.length > 0 ? 'text-red-700' : 'text-text-secondary'}`}>{result.errors.length}</p>
          <p className={`text-xs ${result.errors.length > 0 ? 'text-red-600' : 'text-text-muted'}`}>{t('errors')}</p>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-red-700 mb-1">{t('errors')}:</h5>
          <ul className="list-disc list-inside space-y-0.5">
            {result.errors.map((err, idx) => (
              <li key={idx} className="text-xs text-red-600">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {result.errors.length === 0 && (
        <p className="text-sm text-green-600 mt-1">{t('importSuccess')}</p>
      )}
    </div>
  )
}

export default function SetupPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.setup')

  // Audit Units state (existing)
  const auditFileInputRef = useRef<HTMLInputElement>(null)
  const [auditFile, setAuditFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([])
  const [isImportingAudit, setIsImportingAudit] = useState(false)
  const [auditResult, setAuditResult] = useState<ImportResult | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)

  // Risks state
  const risksFileInputRef = useRef<HTMLInputElement>(null)
  const [risksFile, setRisksFile] = useState<File | null>(null)
  const [isImportingRisks, setIsImportingRisks] = useState(false)
  const [risksResult, setRisksResult] = useState<ImportResult | null>(null)
  const [risksError, setRisksError] = useState<string | null>(null)

  // Tasks state
  const tasksFileInputRef = useRef<HTMLInputElement>(null)
  const [tasksFile, setTasksFile] = useState<File | null>(null)
  const [isImportingTasks, setIsImportingTasks] = useState(false)
  const [tasksResult, setTasksResult] = useState<ImportResult | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)

  // General state
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [openSection, setOpenSection] = useState<SectionKey | null>(null)
  const [counts, setCounts] = useState<SectionCounts>({
    auditUnits: 0,
    risks: 0,
    tasks: 0,
    assets: 0
  })

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSection(prev => prev === key ? null : key)
  }, [])

  const refreshCounts = useCallback(async (orgId: string) => {
    try {
      const response = await fetch(`/api/setup/counts?organizationId=${encodeURIComponent(orgId)}`)
      if (!response.ok) return
      const data = await response.json()
      setCounts({
        auditUnits: data.auditUnits ?? 0,
        risks: data.risks ?? 0,
        tasks: data.tasks ?? 0,
        assets: data.assets ?? 0
      })
    } catch {
      // counts remain at previous values
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function checkAccess() {
      try {
        const userService = new UserService()
        const user = await userService.getCurrentUser()
        if (cancelled) return
        if (!user || !['system_operator', 'org_admin'].includes(user.role)) {
          setIsAuthorized(false)
          return
        }
        setIsAuthorized(true)

        const orgService = new OrganizationService()
        const org = await orgService.getCurrentOrganization()
        if (cancelled) return
        if (org) {
          setOrganizationId(org.id)
          refreshCounts(org.id)
        }
      } catch {
        if (!cancelled) {
          setIsAuthorized(false)
        }
      }
    }
    checkAccess()
    return () => { cancelled = true }
  }, [refreshCounts])

  // ===== Audit Units handlers (existing, preserved) =====
  const parseCsvPreview = useCallback((text: string): ParsedRow[] => {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)

    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const nameIdx = headers.indexOf('name')
    const typeIdx = headers.indexOf('unit_type')
    const descIdx = headers.indexOf('description')

    if (nameIdx === -1) return []

    const rows: ParsedRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const name = values[nameIdx] ?? ''
      if (!name) continue
      rows.push({
        name,
        unit_type: typeIdx >= 0 ? (values[typeIdx] ?? '') : '',
        description: descIdx >= 0 ? (values[descIdx] ?? '') : ''
      })
    }
    return rows
  }, [])

  const handleAuditFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuditResult(null)
    setAuditError(null)
    const selectedFile = e.target.files?.[0] ?? null
    setAuditFile(selectedFile)

    if (!selectedFile) {
      setPreviewRows([])
      return
    }

    try {
      const text = await selectedFile.text()
      const rows = parseCsvPreview(text)
      setPreviewRows(rows)
    } catch {
      setPreviewRows([])
    }
  }, [parseCsvPreview])

  const handleAuditDownloadTemplate = useCallback(() => {
    const template = 'name,unit_type,description\n本社,site,東京本社\n情報管理プロセス,process,情報管理に関するプロセス'
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit_units_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleAuditImport = useCallback(async () => {
    if (!auditFile || !organizationId) return
    setIsImportingAudit(true)
    setAuditResult(null)
    setAuditError(null)

    try {
      const formData = new FormData()
      formData.append('file', auditFile)
      formData.append('organizationId', organizationId)

      const response = await fetch('/api/audit-units/import', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setAuditError(data.error ?? t('importError'))
        return
      }

      setAuditResult(data.summary)
      refreshCounts(organizationId)
    } catch {
      setAuditError(t('importError'))
    } finally {
      setIsImportingAudit(false)
    }
  }, [auditFile, organizationId, t, refreshCounts])

  const unitTypeLabel = (type: string) => {
    if (type === 'site') return t('site')
    if (type === 'process') return t('process')
    return type
  }

  // ===== Generic import handler for risks / tasks =====
  const handleGenericImport = useCallback(async (
    type: 'risks' | 'tasks',
    file: File
  ) => {
    if (!organizationId) return

    const setImporting = type === 'risks' ? setIsImportingRisks : setIsImportingTasks
    const setResult = type === 'risks' ? setRisksResult : setTasksResult
    const setError = type === 'risks' ? setRisksError : setTasksError

    setImporting(true)
    setResult(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organizationId', organizationId)

      const response = await fetch(`/api/${type}/import`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || t('importError'))
        return
      }

      setResult(data.summary)
      refreshCounts(organizationId)
    } catch {
      setError(t('importError'))
    } finally {
      setImporting(false)
    }
  }, [organizationId, t, refreshCounts])

  const handleGenericTemplateDownload = useCallback(async (type: 'risks' | 'tasks') => {
    try {
      const url = type === 'risks'
        ? '/api/risks/export?template=true&format=csv'
        : '/api/tasks/export?template=true'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${type}_template.csv`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // silently fail for template download
    }
  }, [])

  const handleRisksFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRisksResult(null)
    setRisksError(null)
    const selectedFile = e.target.files?.[0] ?? null
    setRisksFile(selectedFile)
  }, [])

  const handleTasksFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTasksResult(null)
    setTasksError(null)
    const selectedFile = e.target.files?.[0] ?? null
    setTasksFile(selectedFile)
  }, [])

  // ===== Loading state =====
  if (isAuthorized === null) {
    return (
      <DashboardLayout locale={locale}>
        <div className="p-6">
          <div className="animate-pulse h-8 bg-surface-elevated rounded w-48 mb-4" />
          <div className="animate-pulse h-4 bg-surface-elevated rounded w-96" />
        </div>
      </DashboardLayout>
    )
  }

  // ===== Forbidden state =====
  if (isAuthorized === false) {
    return (
      <DashboardLayout locale={locale}>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">Forbidden: system_operator or org_admin role required</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // ===== Main render =====
  return (
    <DashboardLayout locale={locale}>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
          <p className="mt-2 text-text-secondary">{t('description')}</p>
        </div>

        {/* Section 1: Organization Data */}
        <div className="border rounded-lg mb-4">
          <button
            type="button"
            onClick={() => toggleSection('organizationData')}
            className="w-full p-4 flex justify-between items-center hover:bg-surface-elevated rounded-lg"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-text-primary">{t('sections.organizationData.title')}</h3>
            </div>
            {openSection === 'organizationData'
              ? <ChevronUpIcon className="w-5 h-5 text-text-muted" />
              : <ChevronDownIcon className="w-5 h-5 text-text-muted" />}
          </button>
          {openSection === 'organizationData' && (
            <div className="p-4 border-t">
              <p className="text-sm text-text-muted mb-4">{t('sections.organizationData.description')}</p>
              <Link
                href={`/${locale}/settings/organization`}
                className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('sections.organizationData.link')}
              </Link>
            </div>
          )}
        </div>

        {/* Section 2: Audit Units (existing functionality preserved) */}
        <div className="border rounded-lg mb-4">
          <button
            type="button"
            onClick={() => toggleSection('auditUnits')}
            className="w-full p-4 flex justify-between items-center hover:bg-surface-elevated rounded-lg"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-text-primary">{t('sections.auditUnits.title')}</h3>
              <StatusBadge count={counts.auditUnits} t={t} />
            </div>
            {openSection === 'auditUnits'
              ? <ChevronUpIcon className="w-5 h-5 text-text-muted" />
              : <ChevronDownIcon className="w-5 h-5 text-text-muted" />}
          </button>
          {openSection === 'auditUnits' && (
            <div className="p-4 border-t">
              <p className="text-sm text-text-muted mb-4">{t('sections.auditUnits.description')}</p>

              {/* Template Download */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleAuditDownloadTemplate}
                  className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  {t('downloadTemplate')}
                </button>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('uploadCsv')}
                </label>
                <input
                  ref={auditFileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleAuditFileChange}
                  className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Preview Table */}
              {previewRows.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-text-secondary mb-2">
                    {t('preview')} ({previewRows.length} rows)
                  </h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-surface-elevated">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">#</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">{t('name')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">{t('unitType')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase">{t('columnDescription')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-surface divide-y divide-border">
                        {previewRows.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-text-muted">{idx + 1}</td>
                            <td className="px-4 py-2 text-sm text-text-primary">{row.name}</td>
                            <td className="px-4 py-2 text-sm text-text-secondary">{unitTypeLabel(row.unit_type)}</td>
                            <td className="px-4 py-2 text-sm text-text-secondary">{row.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Button */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleAuditImport}
                  disabled={!auditFile || isImportingAudit}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImportingAudit ? t('importing') : t('importData')}
                </button>
                {!auditFile && (
                  <span className="text-sm text-text-muted">{t('noFile')}</span>
                )}
              </div>

              {/* Audit Error Message */}
              {auditError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-700 text-sm">{auditError}</p>
                </div>
              )}

              {/* Audit Import Result */}
              {auditResult && <ImportResultDisplay result={auditResult} t={t} />}
            </div>
          )}
        </div>

        {/* Section 3: Risk Register */}
        <div className="border rounded-lg mb-4">
          <button
            type="button"
            onClick={() => toggleSection('risks')}
            className="w-full p-4 flex justify-between items-center hover:bg-surface-elevated rounded-lg"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-text-primary">{t('sections.risks.title')}</h3>
              <StatusBadge count={counts.risks} t={t} />
            </div>
            {openSection === 'risks'
              ? <ChevronUpIcon className="w-5 h-5 text-text-muted" />
              : <ChevronDownIcon className="w-5 h-5 text-text-muted" />}
          </button>
          {openSection === 'risks' && (
            <div className="p-4 border-t">
              <p className="text-sm text-text-muted mb-4">{t('sections.risks.description')}</p>

              {/* Template Download */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => handleGenericTemplateDownload('risks')}
                  className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  {t('downloadTemplate')}
                </button>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('uploadCsv')}
                </label>
                <input
                  ref={risksFileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleRisksFileChange}
                  className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Import Button */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => risksFile && handleGenericImport('risks', risksFile)}
                  disabled={!risksFile || isImportingRisks}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImportingRisks ? t('importing') : t('importData')}
                </button>
                {!risksFile && (
                  <span className="text-sm text-text-muted">{t('noFile')}</span>
                )}
              </div>

              {/* Risks Error Message */}
              {risksError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-700 text-sm">{risksError}</p>
                </div>
              )}

              {/* Risks Import Result */}
              {risksResult && <ImportResultDisplay result={risksResult} t={t} />}
            </div>
          )}
        </div>

        {/* Section 4: Tasks */}
        <div className="border rounded-lg mb-4">
          <button
            type="button"
            onClick={() => toggleSection('tasks')}
            className="w-full p-4 flex justify-between items-center hover:bg-surface-elevated rounded-lg"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-text-primary">{t('sections.tasks.title')}</h3>
              <StatusBadge count={counts.tasks} t={t} />
            </div>
            {openSection === 'tasks'
              ? <ChevronUpIcon className="w-5 h-5 text-text-muted" />
              : <ChevronDownIcon className="w-5 h-5 text-text-muted" />}
          </button>
          {openSection === 'tasks' && (
            <div className="p-4 border-t">
              <p className="text-sm text-text-muted mb-4">{t('sections.tasks.description')}</p>

              {/* Template Download */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => handleGenericTemplateDownload('tasks')}
                  className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  {t('downloadTemplate')}
                </button>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('uploadCsv')}
                </label>
                <input
                  ref={tasksFileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleTasksFileChange}
                  className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Import Button */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => tasksFile && handleGenericImport('tasks', tasksFile)}
                  disabled={!tasksFile || isImportingTasks}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImportingTasks ? t('importing') : t('importData')}
                </button>
                {!tasksFile && (
                  <span className="text-sm text-text-muted">{t('noFile')}</span>
                )}
              </div>

              {/* Tasks Error Message */}
              {tasksError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-700 text-sm">{tasksError}</p>
                </div>
              )}

              {/* Tasks Import Result */}
              {tasksResult && <ImportResultDisplay result={tasksResult} t={t} />}
            </div>
          )}
        </div>

        {/* Section 5: Information Assets */}
        <div className="border rounded-lg mb-4">
          <button
            type="button"
            onClick={() => toggleSection('assets')}
            className="w-full p-4 flex justify-between items-center hover:bg-surface-elevated rounded-lg"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-text-primary">{t('sections.assets.title')}</h3>
              <StatusBadge count={counts.assets} t={t} />
            </div>
            {openSection === 'assets'
              ? <ChevronUpIcon className="w-5 h-5 text-text-muted" />
              : <ChevronDownIcon className="w-5 h-5 text-text-muted" />}
          </button>
          {openSection === 'assets' && (
            <div className="p-4 border-t">
              <p className="text-sm text-text-muted mb-4">{t('sections.assets.description')}</p>
              <Link
                href={`/${locale}/settings/assets`}
                className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-secondary bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('sections.assets.link')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
