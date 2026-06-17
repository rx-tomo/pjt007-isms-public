'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AssetSelector } from '@/components/assets/AssetSelector'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { RiskService } from '@/lib/services/risk'
import { UserService } from '@/lib/services/user'
import { InformationAssetService, type InformationAssetForRisk } from '@/lib/services/informationAsset'
import { TaskService, type TaskStatus, type TaskWithRelations } from '@/lib/services/task'
import type { RiskCategory, RiskWithRelations } from '@/lib/services/risk'
import type { UserProfile } from '@/lib/services/user'

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-surface-elevated text-text-primary',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-yellow-100 text-yellow-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-surface-hover text-text-secondary'
}

interface RiskFormState {
  title: string
  description: string
  categoryId: string
  impact: 1 | 2 | 3 | 4 | 5
  likelihood: 1 | 2 | 3 | 4 | 5
  ownerId: string
  identifiedDate: string
}

export default function EditRiskPage(
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
  const assetText = useTranslations('risks.form.assets')
  const assetLabelT = useTranslations('settings.assets.labels')
  const editText = useTranslations('risks.edit')
  const tasksListT = useTranslations('tasks.list')
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [risk, setRisk] = useState<RiskWithRelations | null>(null)
  const [categories, setCategories] = useState<RiskCategory[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [assets, setAssets] = useState<InformationAssetForRisk[]>([])
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [assetSaving, setAssetSaving] = useState(false)
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [taskSelection, setTaskSelection] = useState<string[]>([])
  const [taskSearch, setTaskSearch] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'assets' | 'tasks'>('details')

  // Form state
  const [formData, setFormData] = useState<RiskFormState>({
    title: '',
    description: '',
    categoryId: '',
    impact: 3,
    likelihood: 3,
    ownerId: '',
    identifiedDate: ''
  })

  // Calculate risk score
  const riskScore = formData.impact * formData.likelihood

  const filteredTasks = useMemo(() => {
    const normalized = taskSearch.trim().toLowerCase()
    if (!normalized) return tasks
    return tasks.filter(task => {
      const description = task.description?.toLowerCase() ?? ''
      const assigneeName = task.assignee?.full_name?.toLowerCase() ?? ''
      return (
        task.title.toLowerCase().includes(normalized) ||
        description.includes(normalized) ||
        assigneeName.includes(normalized)
      )
    })
  }, [taskSearch, tasks])

  const tabItems: { id: 'details' | 'assets' | 'tasks'; label: string }[] = [
    { id: 'details', label: editText('tabs.details') },
    { id: 'assets', label: editText('tabs.assets') },
    { id: 'tasks', label: editText('tabs.tasks') }
  ]

  // Get risk level color
  const getRiskLevelColor = () => {
    if (riskScore >= 15) return 'bg-red-100 text-red-800 border-red-300'
    if (riskScore >= 8) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-green-100 text-green-800 border-green-300'
  }

  // Get risk level text
  const getRiskLevelText = () => {
    if (riskScore >= 15) return t('levels.high')
    if (riskScore >= 8) return t('levels.medium')
    return t('levels.low')
  }

  const riskService = useMemo(() => new RiskService(), [])
  const userService = useMemo(() => new UserService(), [])
  const assetService = useMemo(() => new InformationAssetService(), [])
  const taskService = useMemo(() => new TaskService(), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const riskData = await riskService.getRiskById(id)
      if (!riskData) {
        throw new Error('Risk not found')
      }
      setRisk(riskData)
      setSelectedAssetIds((riskData.assets ?? []).map(asset => asset.asset_id))

      setFormData({
        title: riskData.title,
        description: riskData.description || '',
        categoryId: riskData.category_id || '',
        impact: (riskData.impact_level ?? 1) as RiskFormState['impact'],
        likelihood: (riskData.likelihood_level ?? 1) as RiskFormState['likelihood'],
        ownerId: riskData.owner_id || '',
        identifiedDate: riskData.identified_date || ''
      })

      const profile = await userService.getCurrentUser()
      const orgId = profile?.organization_id || riskData.organization_id || null
      if (!orgId) {
        setError('Organization not found')
        return
      }
      setOrganizationId(orgId)

      const [categoriesData, orgUsers, assetList, orgTasks] = await Promise.all([
        riskService.getRiskCategories(orgId),
        userService.getOrganizationUsers(orgId),
        assetService.getAssetsForRisk(orgId),
        taskService.getTasks({ organizationId: orgId })
      ])

      setCategories(categoriesData)
      setUsers(orgUsers)
      setAssets(assetList)
      setTasks(orgTasks)
      setTaskSelection(
        orgTasks
          .filter(task => task.related_risk_id === riskData.id)
          .map(task => task.id)
      )
    } catch (err) {
      console.error('Error loading data:', err)
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [assetService, id, riskService, t, taskService, userService])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      await riskService.updateRisk(id, {
        title: formData.title,
        description: formData.description,
        category_id: formData.categoryId,
        impact_level: formData.impact as 1 | 2 | 3 | 4 | 5,
        likelihood_level: formData.likelihood as 1 | 2 | 3 | 4 | 5,
        owner_id: formData.ownerId,
        identified_date: formData.identifiedDate
      })

      router.push(`/${locale}/risks`)
    } catch (err) {
      console.error('Error updating risk:', err)
      setError(t('errors.updateFailed'))
      setSaving(false)
    }
  }

  const handleSaveAssets = async () => {
    if (!risk) return
    setAssetSaving(true)
    setError(null)
    try {
      await riskService.setRiskAssets(risk.id, selectedAssetIds)
      const refreshed = await riskService.getRiskById(risk.id)
      if (refreshed) {
        setRisk(refreshed)
        setSelectedAssetIds((refreshed.assets ?? []).map(asset => asset.asset_id))
      }
    } catch (err) {
      console.error('Error updating risk assets:', err)
      setError(t('errors.assetUpdateFailed'))
    } finally {
      setAssetSaving(false)
    }
  }

  const handleSaveTasks = async () => {
    if (!risk || !organizationId) return
    setTaskSaving(true)
    setError(null)
    try {
      const currentlyLinked = tasks
        .filter(task => task.related_risk_id === risk.id)
        .map(task => task.id)
      const toLink = taskSelection.filter(id => !currentlyLinked.includes(id))
      const toUnlink = currentlyLinked.filter(id => !taskSelection.includes(id))

      await Promise.all([
        ...toLink.map(taskId => taskService.updateTask(taskId, { related_risk_id: risk.id })),
        ...toUnlink.map(taskId => taskService.updateTask(taskId, { related_risk_id: null }))
      ])

      const updatedTasks = await taskService.getTasks({ organizationId })
      setTasks(updatedTasks)
      setTaskSelection(
        updatedTasks
          .filter(task => task.related_risk_id === risk.id)
          .map(task => task.id)
      )
    } catch (err) {
      console.error('Error updating related tasks:', err)
      setError(t('errors.taskUpdateFailed'))
    } finally {
      setTaskSaving(false)
    }
  }

  const toggleTaskSelection = (taskId: string) => {
    setTaskSelection(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const handleChange = <K extends keyof RiskFormState>(field: K, value: RiskFormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <DashboardLayout locale={locale}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-surface shadow-sm rounded-lg p-8">
              <div className="animate-pulse">
                <div className="h-8 bg-surface-elevated rounded w-1/3 mb-8"></div>
                <div className="space-y-6">
                  <div className="h-10 bg-surface-elevated rounded"></div>
                  <div className="h-24 bg-surface-elevated rounded"></div>
                  <div className="h-10 bg-surface-elevated rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!risk) {
    return (
      <DashboardLayout locale={locale}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-md p-6">
              <p className="text-red-600">{t('errors.notFound')}</p>
              <Link href={`/${locale}/risks`} className="text-blue-600 hover:underline mt-2 inline-block">
                {t('list.backToList')}
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{t('form.editRisk')}</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="mt-4 border-b border-border">
          <nav className="-mb-px flex gap-6" aria-label={editText('tabs.aria')}>
            {tabItems.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'details' && (
          <form onSubmit={handleSubmit} className="bg-surface shadow-sm rounded-lg p-6 space-y-6 mt-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.riskTitle')}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.description')}
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.category')}
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={saving}
            >
              <option value="">選択してください</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('form.impact')}
              </label>
              <select
                value={formData.impact}
                onChange={(e) => handleChange('impact', Number(e.target.value) as RiskFormState['impact'])}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              >
                <option value="1">{t('form.impactLevels.1')}</option>
                <option value="2">{t('form.impactLevels.2')}</option>
                <option value="3">{t('form.impactLevels.3')}</option>
                <option value="4">{t('form.impactLevels.4')}</option>
                <option value="5">{t('form.impactLevels.5')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('form.likelihood')}
              </label>
              <select
                value={formData.likelihood}
                onChange={(e) => handleChange('likelihood', Number(e.target.value) as RiskFormState['likelihood'])}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              >
                <option value="1">{t('form.likelihoodLevels.1')}</option>
                <option value="2">{t('form.likelihoodLevels.2')}</option>
                <option value="3">{t('form.likelihoodLevels.3')}</option>
                <option value="4">{t('form.likelihoodLevels.4')}</option>
                <option value="5">{t('form.likelihoodLevels.5')}</option>
              </select>
            </div>
          </div>

          {/* Risk Score Display */}
          <div className={`p-4 rounded-lg border ${getRiskLevelColor()}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{t('form.riskScore')}</p>
                <p className="text-xs opacity-75 mt-1">
                  {t('form.impact')} ({formData.impact}) × {t('form.likelihood')} ({formData.likelihood})
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{riskScore}</p>
                <p className="text-sm font-medium">{getRiskLevelText()}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.owner')}
            </label>
            <select
              value={formData.ownerId}
              onChange={(e) => handleChange('ownerId', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={saving}
            >
              <option value="">選択してください</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.identifiedDate')}
            </label>
            <input
              type="date"
              value={formData.identifiedDate}
              onChange={(e) => handleChange('identifiedDate', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={saving}
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link
              href={`/${locale}/risks`}
              className="px-4 py-2 border border-border rounded-md hover:bg-surface-elevated"
            >
              {t('form.cancel')}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('form.saving') : t('form.save')}
            </button>
          </div>
          </form>
        )}

        {activeTab === 'assets' && (
          <section className="bg-surface shadow-sm rounded-lg p-6 space-y-6 mt-6">
            <p className="text-sm text-text-secondary">{editText('assets.description')}</p>
            <AssetSelector
              assets={assets}
              selectedAssetIds={selectedAssetIds}
              onChange={setSelectedAssetIds}
                labels={{
                  title: assetText('title'),
                  searchPlaceholder: assetText('search'),
                  empty: assetText('empty'),
                  selectedCount: (count: number) => assetText('selectedCount', { count }),
                  classification: assetText('classification'),
                  criticality: assetText('criticality'),
                  owner: assetText('owner'),
                  department: assetText('department')
                }}
              formatAssetType={(value) => assetLabelT(`types.${value}`)}
              formatClassification={(value) => assetLabelT(`classification.${value}`)}
              formatCriticality={(value) => assetLabelT(`criticality.${value}`)}
            />
            {assets.length === 0 && (
              <p className="text-xs text-text-muted">
                {assetText('noAssets')}{' '}
                <Link href={`/${locale}/settings/assets`} className="text-indigo-600 hover:underline">
                  {assetText('manageLink')}
                </Link>
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveAssets}
                disabled={assetSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {assetSaving ? editText('assets.saving') : editText('assets.save')}
              </button>
            </div>
          </section>
        )}

        {activeTab === 'tasks' && (
          <section className="bg-surface shadow-sm rounded-lg p-6 space-y-6 mt-6">
            <p className="text-sm text-text-secondary">{editText('tasks.description')}</p>
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder={editText('tasks.searchPlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="rounded-md border border-border divide-y divide-border">
              {filteredTasks.map(task => {
                const isLocked = Boolean(task.related_risk_id && task.related_risk_id !== risk.id)
                const isChecked = taskSelection.includes(task.id)
                return (
                  <label key={task.id} className={`flex flex-col gap-2 p-4 ${isLocked ? 'bg-surface-elevated' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                        checked={isChecked}
                        onChange={() => toggleTaskSelection(task.id)}
                        disabled={isLocked}
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-text-primary">{task.title}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_COLORS[task.status]}`}>
                            {tasksListT(`status.${task.status}`)}
                          </span>
                          {task.assignee?.full_name && (
                            <span className="text-xs text-text-muted">
                              {tasksListT('columns.assignee')}: {task.assignee.full_name}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="mt-1 text-sm text-text-muted line-clamp-2">{task.description}</p>
                        )}
                        {isLocked && (
                          <p className="mt-1 text-xs text-amber-600">{editText('tasks.locked')}</p>
                        )}
                      </div>
                      <div className="text-xs text-text-muted text-right min-w-[90px]">
                        {task.due_date && (
                          <span>{tasksListT('columns.dueDate')}: {task.due_date}</span>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
            {filteredTasks.length === 0 && (
              <p className="text-sm text-text-muted">{editText('tasks.empty')}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-muted">{editText('tasks.helper')}</p>
              <button
                type="button"
                onClick={handleSaveTasks}
                disabled={taskSaving || !organizationId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {taskSaving ? editText('tasks.saving') : editText('tasks.save')}
              </button>
            </div>
          </section>
        )}
      </div>
      </div>
    </DashboardLayout>
  )
}
