'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RiskService } from '@/lib/services/risk'
import { UserService } from '@/lib/services/user'
import { InformationAssetService, type InformationAssetForRisk } from '@/lib/services/informationAsset'
import { AssetSelector } from '@/components/assets/AssetSelector'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type { RiskCategory } from '@/lib/services/risk'
import type { UserProfile } from '@/lib/services/user'

interface RiskFormState {
  title: string
  description: string
  categoryId: string
  impact: 1 | 2 | 3 | 4 | 5
  likelihood: 1 | 2 | 3 | 4 | 5
  ownerId: string
  identifiedDate: string
}

export default function NewRiskPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('risks')
  const assetText = useTranslations('risks.form.assets')
  const assetLabelT = useTranslations('settings.assets.labels')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<RiskCategory[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [assets, setAssets] = useState<InformationAssetForRisk[]>([])
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])

  // Form state
  const [formData, setFormData] = useState<RiskFormState>({
    title: '',
    description: '',
    categoryId: '',
    impact: 3,
    likelihood: 3,
    ownerId: '',
    identifiedDate: new Date().toISOString().split('T')[0]
  })

  // Calculate risk score
  const riskScore = formData.impact * formData.likelihood

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

  const loadFormData = useCallback(async () => {
    try {
      // Load user profile first
      const profile = await userService.getCurrentUser()
      if (!profile?.organization_id) {
        setError('Organization not found')
        setLoading(false)
        return
      }

      const [categoriesData, orgUsers, assetList] = await Promise.all([
        riskService.getRiskCategories(profile.organization_id),
        userService.getOrganizationUsers(profile.organization_id),
        assetService.getAssetsForRisk(profile.organization_id)
      ])

      setCategories(categoriesData)
      setUsers(orgUsers)
      setAssets(assetList)
      setSelectedAssetIds([])
    } catch (err) {
      console.error('Error loading form data:', err)
      setError(t('errors.loadFailed'))
    }
  }, [assetService, riskService, t, userService])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const profile = await userService.getUserProfile()

      if (!profile?.organization_id) {
        throw new Error('Organization not found')
      }

      const createdRisk = await riskService.createRisk({
        title: formData.title,
        description: formData.description,
        category_id: formData.categoryId,
        impact_level: formData.impact as 1 | 2 | 3 | 4 | 5,
        likelihood_level: formData.likelihood as 1 | 2 | 3 | 4 | 5,
        owner_id: formData.ownerId || null,
        identified_date: formData.identifiedDate,
        organization_id: profile.organization_id,
        status: 'identified'
      }, selectedAssetIds)

      router.push(`/${locale}/risks/${createdRisk.id}`)
    } catch (err) {
      console.error('Error creating risk:', err)
      setError(t('errors.createFailed'))
      setLoading(false)
    }
  }

  const handleChange = <K extends keyof RiskFormState>(field: K, value: RiskFormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">{t('list.newRisk')}</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface shadow-sm rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.riskTitle')}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              data-testid="risk-title-input"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
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
              data-testid="risk-description-input"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.category')}
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              data-testid="risk-category-select"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            >
              <option value="">選択してください</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
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
              <p className="mt-2 text-xs text-text-muted">
                {assetText('noAssets')}{' '}
                <Link href={`/${locale}/settings/assets`} className="text-indigo-600 hover:underline">
                  {assetText('manageLink')}
                </Link>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('form.impact')}
              </label>
            <select
              value={formData.impact}
              onChange={(e) => handleChange('impact', Number(e.target.value) as RiskFormState['impact'])}
              data-testid="risk-impact-select"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
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
              data-testid="risk-likelihood-select"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
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
              data-testid="risk-owner-select"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
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
              data-testid="risk-identified-date"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
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
              disabled={loading}
              data-testid="risk-save-button"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      </div>
      </div>
    </DashboardLayout>
  )
}
