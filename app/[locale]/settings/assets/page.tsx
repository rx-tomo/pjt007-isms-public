'use client'

import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { InformationAssetService, type InformationAsset } from '@/lib/services/informationAsset'
import { UserService, type UserProfile } from '@/lib/services/user'
import { useToast } from '@/components/ui/ToastProvider'

interface AssetFormState {
  name: string
  assetType: InformationAsset['asset_type']
  classification: InformationAsset['classification']
  criticality: InformationAsset['criticality']
  ownerId: string
  location: string
  status: InformationAsset['status']
  description: string
}

const defaultFormState: AssetFormState = {
  name: '',
  assetType: 'data',
  classification: 'internal',
  criticality: 'medium',
  ownerId: '',
  location: '',
  status: 'in_use',
  description: ''
}

export default function AssetManagementPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.assets')
  const router = useRouter()
  const assetService = useMemo(() => new InformationAssetService(), [])
  const userService = useMemo(() => new UserService(), [])

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [assets, setAssets] = useState<InformationAsset[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [formState, setFormState] = useState<AssetFormState>(defaultFormState)
  const [editingAsset, setEditingAsset] = useState<InformationAsset | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false)
  const [importMode, setImportMode] = useState<'insert' | 'upsert' | 'replace'>('insert')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { pushToast } = useToast()

  const assetTypes = useMemo<InformationAsset['asset_type'][]>(
    () => ['hardware', 'software', 'data', 'service', 'facility', 'personnel', 'other'],
    []
  )
  const classifications = useMemo<InformationAsset['classification'][]>(
    () => ['restricted', 'internal', 'public'],
    []
  )
  const criticalities = useMemo<InformationAsset['criticality'][]>(
    () => ['low', 'medium', 'high'],
    []
  )
  const statuses = useMemo<InformationAsset['status'][]>(
    () => ['in_use', 'retired', 'planned'],
    []
  )

  const ownerInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; email: string | null }>()
    users.forEach((user) => {
      map.set(user.id, {
        name: user.full_name || user.email || '',
        email: user.email ?? null
      })
    })
    return map
  }, [users])

  const filteredAssets = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) {
      return assets
    }

    return assets.filter((asset) => {
      const ownerInfo = asset.owner_id ? ownerInfoMap.get(asset.owner_id) : null
      return [
        asset.name,
        asset.asset_type,
        asset.classification,
        asset.criticality,
        asset.status,
        asset.location ?? '',
        asset.description ?? '',
        ownerInfo?.name ?? '',
        ownerInfo?.email ?? ''
      ]
        .filter((v): v is string => Boolean(v))
        .some((value) => value.toLowerCase().includes(keyword))
    })
  }, [assets, ownerInfoMap, searchTerm])

  const resetForm = () => {
    setFormState(defaultFormState)
    setEditingAsset(null)
  }

  const loadAssets = useCallback(async () => {
    setIsLoading(true)

    try {
      const profile = await userService.getUserProfile()
      if (!profile?.organization_id) {
        throw new Error('Organization not found')
      }

      if (!['system_operator', 'org_admin'].includes(profile.role as string)) {
        pushToast({ message: t('messages.forbidden'), variant: 'error', duration: 0 })
        try {
          router.push(`/${locale}/home`)
        } catch {}
        setIsLoading(false)
        return
      }

      setOrganizationId(profile.organization_id)
      setCurrentUserId(profile.id)
      setCurrentUserRole(profile.role ?? null)

      const [assetList, orgUsers] = await Promise.all([
        assetService.getAssets(profile.organization_id),
        userService.getOrganizationUsers(profile.organization_id)
      ])

      setAssets(assetList)
      setUsers(orgUsers)
    } catch (err) {
      console.error('Failed to load information assets', err)
      pushToast({ message: t('messages.loadFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsLoading(false)
    }
  }, [assetService, locale, pushToast, router, t, userService])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const handleChange = <K extends keyof AssetFormState>(field: K, value: AssetFormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!organizationId) return

    setIsSubmitting(true)

    try {
      const payload = {
        organization_id: organizationId,
        name: formState.name,
        asset_type: formState.assetType,
        classification: formState.classification,
        criticality: formState.criticality,
        owner_id: formState.ownerId || null,
        location: formState.location || null,
        status: formState.status,
        description: formState.description || null
      }

      if (editingAsset) {
        await assetService.updateAsset(editingAsset.id, payload)
        pushToast({ message: t('messages.updated'), variant: 'success' })
      } else {
        await assetService.createAsset(payload)
        pushToast({ message: t('messages.created'), variant: 'success' })
      }

      await loadAssets()
      resetForm()
    } catch (err) {
      console.error('Failed to save information asset', err)
      pushToast({ message: t('messages.saveFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (asset: InformationAsset) => {
    setEditingAsset(asset)
    setFormState({
      name: asset.name,
      assetType: asset.asset_type,
      classification: asset.classification,
      criticality: asset.criticality,
      ownerId: asset.owner_id ?? '',
      location: asset.location ?? '',
      status: asset.status,
      description: asset.description ?? ''
    })
  }

  const handleDelete = async (asset: InformationAsset) => {
    if (!window.confirm(t('confirmation.delete'))) {
      return
    }

    try {
      await assetService.deleteAsset(asset.id)
      pushToast({ message: t('messages.deleted'), variant: 'success' })
      if (editingAsset?.id === asset.id) {
        resetForm()
      }
      await loadAssets()
    } catch (err) {
      console.error('Failed to delete information asset', err)
      pushToast({ message: t('messages.deleteFailed'), variant: 'error', duration: 0 })
    }
  }

  const downloadCsv = async (options: { template?: boolean }) => {
    if (!organizationId) {
      pushToast({ message: t('messages.forbidden'), variant: 'error', duration: 0 })
      return
    }

    if (!options.template && filteredAssets.length === 0) {
      return
    }

    const setBusy = options.template ? setIsTemplateDownloading : setIsExporting
    setBusy(true)
    try {
      const idsParam =
        !options.template && filteredAssets.length > 0
          ? `&ids=${encodeURIComponent(filteredAssets.map(asset => asset.id).join(','))}`
          : ''
      const response = await fetch(
        `/api/information-assets/export?organizationId=${organizationId}${options.template ? '&template=1' : ''}${idsParam}`
      )
      if (!response.ok) {
        throw new Error('export_failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = options.template
        ? 'information-assets_template.csv'
        : `information-assets_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      pushToast({
        message: options.template
          ? t('messages.templateDownloaded')
          : t('messages.exportSuccess', { count: filteredAssets.length }),
        variant: 'success'
      })
    } catch (exportError) {
      console.error('Failed to export information assets to CSV', exportError)
      pushToast({
        message: options.template ? t('messages.templateFailed') : t('messages.exportFailed'),
        variant: 'error',
        duration: 0
      })
    } finally {
      setBusy(false)
    }
  }

  const handleExportCsv = () => downloadCsv({ template: false })
  const handleDownloadTemplate = () => downloadCsv({ template: true })

  const handleCsvChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (!organizationId || !currentUserId) {
      pushToast({ message: t('messages.importFailed'), variant: 'error', duration: 0 })
      return
    }

    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organizationId', organizationId)
      formData.append('userId', currentUserId)
      formData.append('mode', importMode)

      const response = await fetch('/api/information-assets/import', {
        method: 'POST',
        body: formData
      })

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch (jsonError) {
        console.error('Failed to parse asset import response', jsonError)
      }

      if (!payload || typeof payload !== 'object' || !('jobId' in payload)) {
        const message = (payload as { error?: string } | null)?.error ?? t('messages.importFailed')
        throw new Error(message)
      }

      const summary = payload as {
        jobId: string
        totalRows: number
        successCount: number
        upsertCount: number
        errorCount: number
        errors?: { line?: number; message?: string }[]
      }

      await loadAssets()

      const insertCount = summary.successCount - (summary.upsertCount ?? 0)
      const hasUpserts = (summary.upsertCount ?? 0) > 0

      if (summary.errorCount > 0) {
        const rawDetails = (summary.errors ?? [])
          .slice(0, 3)
          .map((entry) =>
            t('messages.importErrorLine', {
              line: entry.line ?? '-',
              message: entry.message ?? 'unknown'
            })
          )
          .join(' / ')

        const detailText = rawDetails
          ? t('messages.importErrorPreview', { details: rawDetails })
          : ''

        pushToast({
          message: hasUpserts
            ? t('messages.importPartialWithUpsert', {
                insertCount,
                upsertCount: summary.upsertCount,
                errorCount: summary.errorCount,
                jobId: summary.jobId,
                details: detailText
              })
            : t('messages.importPartial', {
                successCount: summary.successCount,
                errorCount: summary.errorCount,
                jobId: summary.jobId,
                details: detailText
              }),
          variant: 'info',
          duration: 0
        })
      } else {
        pushToast({
          message: hasUpserts
            ? t('messages.importSuccessWithUpsert', {
                insertCount,
                upsertCount: summary.upsertCount,
                jobId: summary.jobId
              })
            : t('messages.importSuccess', { count: summary.successCount, jobId: summary.jobId }),
          variant: 'success'
        })
      }
    } catch (importError) {
      console.error('Failed to import information assets from CSV', importError)
      const message = importError instanceof Error ? importError.message : t('messages.importFailed')
      pushToast({
        message: t('messages.importFailedWithReason', { reason: message }),
        variant: 'error',
        duration: 0
      })
    } finally {
      setIsImporting(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return '—'
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(isoString))
    } catch (err) {
      return isoString
    }
  }

  if (isLoading) {
    return (
      <div className="bg-surface shadow-sm rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface-elevated rounded w-1/3" />
          <div className="h-32 bg-surface-elevated rounded" />
        </div>
      </div>
    )
  }

  // organizationId が null/undefined/空文字の場合はエラー画面を表示
  // 注: state型は string | null だが、profile.organization_id が空文字の場合も考慮
  if (!organizationId || organizationId.trim() === '') {
    return (
      <div className="bg-surface shadow-sm rounded-lg p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">{t('messages.accessDenied')}</h2>
        <p className="text-sm text-text-secondary mb-4">{t('messages.organizationNotResolved')}</p>
        <button
          onClick={() => router.push(`/${locale}/home`)}
          className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {t('messages.goHome')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="bg-surface shadow-sm rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-text-primary">
            {editingAsset ? t('form.editTitle') : t('form.createTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t('description')}</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('importModes.label')}
            </label>
            <select
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as typeof importMode)}
              className="w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 md:min-w-[240px]"
            >
              <option value="insert">{t('importModes.insert')}</option>
              <option value="upsert">{t('importModes.upsert')}</option>
              {currentUserRole === 'system_operator' && (
                <option value="replace">{t('importModes.replace')}</option>
              )}
            </select>
            {currentUserRole !== 'system_operator' && (
              <p className="mt-1 text-xs text-text-muted">{t('importModes.replaceRestricted')}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={isTemplateDownloading || !organizationId}
              className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {isTemplateDownloading ? t('actions.downloadingTemplate') : t('actions.downloadTemplate')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || !organizationId}
              className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {isImporting ? t('actions.importing') : t('actions.importCsv')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvChange}
              className="hidden"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">{t('form.fields.name')}</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formState.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder={t('form.placeholders.name')}
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">{t('form.fields.description')}</label>
              <textarea
                rows={4}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formState.description}
                onChange={(event) => handleChange('description', event.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('form.fields.assetType')}</label>
                <select
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={formState.assetType ?? ''}
                  onChange={(event) => handleChange('assetType', event.target.value as InformationAsset['asset_type'])}
                  disabled={isSubmitting}
                >
                  {assetTypes.map((type) => (
                    <option key={type} value={type ?? ''}>
                      {t(`labels.types.${type}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('form.fields.classification')}</label>
                <select
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={formState.classification ?? ''}
                  onChange={(event) =>
                    handleChange('classification', event.target.value as InformationAsset['classification'])
                  }
                  disabled={isSubmitting}
                >
                  {classifications.map((value) => (
                    <option key={value} value={value ?? ''}>
                      {t(`labels.classification.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('form.fields.criticality')}</label>
                <select
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={formState.criticality ?? ''}
                  onChange={(event) =>
                    handleChange('criticality', event.target.value as InformationAsset['criticality'])
                  }
                  disabled={isSubmitting}
                >
                  {criticalities.map((value) => (
                    <option key={value} value={value ?? ''}>
                      {t(`labels.criticality.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('form.fields.status')}</label>
                <select
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={formState.status ?? ''}
                  onChange={(event) => handleChange('status', event.target.value as InformationAsset['status'])}
                  disabled={isSubmitting}
                >
                  {statuses.map((value) => (
                    <option key={value} value={value ?? ''}>
                      {t(`labels.status.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">{t('form.fields.owner')}</label>
              <select
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formState.ownerId}
                onChange={(event) => handleChange('ownerId', event.target.value)}
                disabled={isSubmitting}
              >
                <option value="">{t('labels.ownerUnset')}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">{t('form.fields.location')}</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formState.location}
                onChange={(event) => handleChange('location', event.target.value)}
                placeholder={t('form.placeholders.location')}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex items-center justify-end gap-3">
            {editingAsset && (
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                {t('form.actions.cancel')}
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {editingAsset ? t('form.actions.update') : t('form.actions.create')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{t('table.title')}</h2>
              <p className="mt-1 text-sm text-text-muted">{t('table.description')}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="w-full sm:w-64">
                <label className="sr-only" htmlFor="asset-search">
                  {t('table.searchPlaceholder')}
                </label>
                <input
                  id="asset-search"
                  type="search"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('table.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  disabled={assets.length === 0}
                />
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExporting || filteredAssets.length === 0}
                className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? t('actions.exportingCsv') : t('actions.exportCsv')}
              </button>
            </div>
          </div>
        </div>
        {assets.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted">{t('table.empty')}</div>
        ) : filteredAssets.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted">
            {t('table.noResults', { keyword: searchTerm })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t('table.headers.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t('table.headers.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t('table.headers.classification')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t('table.headers.criticality')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t('table.headers.owner')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t('table.headers.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    {t('table.headers.updatedAt')}
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-surface-elevated">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-text-primary">{asset.name}</div>
                      {asset.location && <div className="text-xs text-text-muted">{asset.location}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                        {t(`labels.types.${asset.asset_type}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {t(`labels.classification.${asset.classification}`)}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {t(`labels.criticality.${asset.criticality}`)}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {asset.owner_id
                        ? ownerInfoMap.get(asset.owner_id)?.name ?? t('labels.ownerUnset')
                        : t('labels.ownerUnset')}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {t(`labels.status.${asset.status}`)}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {formatDateTime(asset.updated_at)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                      <button
                        type="button"
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => handleEdit(asset)}
                      >
                        {t('actions.edit', { defaultValue: '編集' })}
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDelete(asset)}
                      >
                        {t('actions.delete', { defaultValue: '削除' })}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
