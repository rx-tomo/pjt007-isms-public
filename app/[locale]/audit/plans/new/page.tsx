'use client'

import { useState, useEffect, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuditService, type AuditUnit } from '@/lib/services/audit'
import { UserService } from '@/lib/services/user'
import DashboardLayout from '@/components/layout/DashboardLayout'
import type { AuditType } from '@/lib/services/audit'
import type { Database } from '@/types/database.types'
import { useAuditAccess } from '@/lib/hooks/useAuditAccess'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

export default function NewAuditPlanPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('audit')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [auditUnits, setAuditUnits] = useState<AuditUnit[]>([])
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([])
  const { isAuthorized, isLoading: accessLoading, error: accessError, profile } = useAuditAccess()

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    auditType: 'internal' as AuditType,
    standard: 'ISO27001',
    plannedStartDate: '',
    plannedEndDate: '',
    leadAuditorId: '',
    auditedUnitId: '',
    auditorSignature: ''
  })

  useEffect(() => {
    if (accessLoading || !isAuthorized) {
      return
    }

    const organizationId = profile?.organization_id
    if (!organizationId) {
      return
    }

    loadUsers(organizationId)
  }, [accessLoading, isAuthorized, profile?.organization_id])

  const loadUsers = async (organizationId: string) => {
    try {
      const auditService = new AuditService()
      const userService = new UserService()

      // Load users who can be auditors
      const [usersData, unitsData] = await Promise.all([
        userService.getOrganizationUsers(organizationId),
        auditService.getAuditUnits(organizationId).catch(() => [])
      ])

      setUsers(usersData.filter(u => ['org_admin', 'auditor', 'system_operator', 'approver'].includes(u.role)))
      setAuditUnits(unitsData)
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const auditService = new AuditService()
      const userService = new UserService()

      const currentProfile = profile ?? (await userService.getUserProfile())

      if (!currentProfile?.organization_id) {
        throw new Error('Organization not found')
      }

      // Create audit plan
      const plan = await auditService.createAuditPlan({
        title: formData.title,
        description: formData.description,
        audit_type: formData.auditType,
        standard: formData.standard,
        planned_start_date: formData.plannedStartDate,
        planned_end_date: formData.plannedEndDate,
        lead_auditor_id: formData.leadAuditorId || undefined,
        audited_unit_id: formData.auditedUnitId || undefined,
        auditor_signature: formData.auditorSignature || undefined,
        auditor_signed_at: formData.auditorSignature ? new Date().toISOString() : undefined,
        status: 'planning',
        organization_id: currentProfile.organization_id
      })

      // Add team members
      if (formData.leadAuditorId) {
        await auditService.addTeamMember(plan.id, formData.leadAuditorId, 'lead')
      }

      for (const auditorId of selectedAuditors) {
        if (auditorId !== formData.leadAuditorId) {
          await auditService.addTeamMember(plan.id, auditorId, 'auditor')
        }
      }

      router.push(`/${locale}/audit`)
    } catch (err) {
      console.error('Error creating audit plan:', err)
      setError(t('errors.createFailed'))
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleAuditor = (userId: string) => {
    setSelectedAuditors(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  if (accessLoading || (isAuthorized && loading && users.length === 0)) {
    return (
      <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse max-w-3xl mx-auto">
          <div className="h-8 bg-surface-elevated rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-16 bg-surface-elevated rounded" />
            ))}
          </div>
        </div>
      </div>
      </DashboardLayout>
    )
  }

  if (!isAuthorized) {
    return (
      <DashboardLayout locale={locale}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">{t('accessDenied.title')}</h1>
          <p className="text-text-secondary mb-6">{t('accessDenied.description')}</p>
          {accessError === 'permission_fetch_failed' && (
            <p className="text-sm text-red-600">{t('accessDenied.permissionFetchFailed')}</p>
          )}
        </div>
      </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout locale={locale}>
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">{t('plans.new')}</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface shadow-sm rounded-lg p-6 space-y-6">
          {/* 基本情報 */}
          <div className="border-b pb-6">
            <h2 className="text-lg font-semibold mb-4">{t('form.basicInfo')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('form.title')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  data-testid="audit-plan-title"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 2025年度 内部監査（第1回）"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('form.description')}
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  data-testid="audit-plan-description"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="監査の目的や範囲を記載"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('form.auditType')}
                  </label>
                  <select
                    value={formData.auditType}
                    onChange={(e) => handleChange('auditType', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <option value="internal">内部監査</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('form.standard')}
                  </label>
                  <select
                    value={formData.standard}
                    onChange={(e) => handleChange('standard', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <option value="ISO27001">ISO/IEC 27001:2022</option>
                    <option value="ISO27001:2013">ISO/IEC 27001:2013</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b pb-6">
            <h2 className="text-lg font-semibold mb-4">監査対象・署名</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  監査対象ユニット <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.auditedUnitId}
                  onChange={(e) => handleChange('auditedUnitId', e.target.value)}
                  data-testid="audit-plan-audited-unit"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">選択してください</option>
                  {auditUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.unit_type === 'site' ? '拠点' : '業務プロセス'})
                    </option>
                  ))}
                </select>
                {auditUnits.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    監査対象ユニットが未登録です。CSVシード取込後に選択できます。
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  監査員サイン（承認）
                </label>
                <input
                  type="text"
                  value={formData.auditorSignature}
                  onChange={(e) => handleChange('auditorSignature', e.target.value)}
                  data-testid="audit-plan-auditor-signature"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 監査担当 山田 太郎"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* 日程 */}
          <div className="border-b pb-6">
            <h2 className="text-lg font-semibold mb-4">{t('form.schedule')}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('form.plannedStartDate')}
                </label>
                <input
                  type="date"
                  value={formData.plannedStartDate}
                  onChange={(e) => handleChange('plannedStartDate', e.target.value)}
                  data-testid="audit-plan-planned-start-date"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('form.plannedEndDate')}
                </label>
                <input
                  type="date"
                  value={formData.plannedEndDate}
                  onChange={(e) => handleChange('plannedEndDate', e.target.value)}
                  min={formData.plannedStartDate}
                  data-testid="audit-plan-planned-end-date"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* 監査チーム */}
          <div>
            <h2 className="text-lg font-semibold mb-4">{t('form.auditTeam')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('form.leadAuditor')}
                </label>
                <select
                  value={formData.leadAuditorId}
                  onChange={(e) => handleChange('leadAuditorId', e.target.value)}
                  data-testid="audit-plan-lead-auditor"
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">選択してください</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                      {user.role === 'auditor' && ' (監査員)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('form.auditors')}
                </label>
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center px-3 py-2 hover:bg-surface-elevated cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAuditors.includes(user.id) || user.id === formData.leadAuditorId}
                        onChange={() => toggleAuditor(user.id)}
                        disabled={user.id === formData.leadAuditorId || loading}
                        data-testid={`audit-plan-auditor-${user.id}`}
                        className="mr-3"
                      />
                      <span className="text-sm">
                        {user.full_name || user.email}
                        {user.role === 'auditor' && ' (監査員)'}
                        {user.id === formData.leadAuditorId && ' - 主任監査員'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  監査に参加するメンバーを選択してください
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link
              href={`/${locale}/audit`}
              className="px-4 py-2 border border-border rounded-md hover:bg-surface-elevated"
            >
              {t('form.cancel')}
            </Link>
            <button
              type="submit"
              disabled={loading}
              data-testid="audit-plan-create-button"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('form.creating') : t('form.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
    </DashboardLayout>
  )
}
