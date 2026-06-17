'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { ProjectRolePayload } from '@/lib/services/organization'

interface RoleSeedWizardDialogProps {
  organizationId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: { inserted: number; skipped: number }) => void
  onError?: (message: string) => void
  existingRoleCount?: number
}

type WizardStep = 'selection' | 'confirmation' | 'result'

interface RecommendedRole extends ProjectRolePayload {
  selected: boolean
}

// 仕様書の11件の推奨ロールセット
const RECOMMENDED_ROLES: ProjectRolePayload[] = [
  {
    key: 'isms_lead',
    name: 'ISMS責任者',
    name_en: 'ISMS Lead',
    description: '全体統括、ISMSの維持管理、経営層報告を担当',
    responsibilities: ['ISMSの維持管理', '経営層への報告', 'ISMS方針の策定・周知'],
    display_order: 1,
    is_required: true
  },
  {
    key: 'ciso',
    name: '最高情報セキュリティ責任者 (CISO)',
    name_en: 'Chief Information Security Officer',
    description: '組織横断のセキュリティ戦略を策定・推進',
    responsibilities: ['セキュリティ戦略の策定', '重大インシデント対応の指揮', '経営層との橋渡し'],
    display_order: 2,
    is_required: true
  },
  {
    key: 'risk_officer',
    name: 'リスク管理責任者',
    name_en: 'Risk Management Owner',
    description: 'リスクアセスメント実施責任者',
    responsibilities: ['リスクアセスメントの計画・実施', 'リスク対応計画の策定', 'リスク台帳の管理'],
    display_order: 3,
    is_required: true
  },
  {
    key: 'audit_lead',
    name: '内部監査責任者',
    name_en: 'Internal Audit Lead',
    description: '内部監査計画・報告の承認を担当',
    responsibilities: ['内部監査計画の策定', '監査報告書の承認', '是正措置のフォローアップ'],
    display_order: 4,
    is_required: true
  },
  {
    key: 'auditor',
    name: '内部監査員',
    name_en: 'Internal Auditor',
    description: '内部監査の実施担当（複数担当者を想定）',
    responsibilities: ['内部監査の実施', '監査エビデンスの収集', '監査報告書の作成'],
    display_order: 5,
    is_required: false
  },
  {
    key: 'isirt',
    name: '情報セキュリティインシデント対応チーム (ISIRT)',
    name_en: 'Security Incident Response Team',
    description: 'インシデント対応チーム（複数担当者を想定）',
    responsibilities: ['インシデント検知・対応', '影響範囲の特定', '復旧作業の実施'],
    display_order: 6,
    is_required: true
  },
  {
    key: 'access_manager',
    name: 'アクセス権管理者',
    name_en: 'Access Control Manager',
    description: 'アクセスレビュープロセスの管理を担当',
    responsibilities: ['アクセス権の付与・削除', '定期的なアクセスレビュー', 'アクセス権限台帳の管理'],
    display_order: 7,
    is_required: true
  },
  {
    key: 'system_ops',
    name: 'システム管理者 / 運用管理者',
    name_en: 'System / Operations Manager',
    description: 'インフラ運用責任者',
    responsibilities: ['システム運用・保守', 'バックアップ管理', 'パッチ適用・脆弱性対応'],
    display_order: 8,
    is_required: true
  },
  {
    key: 'hr_admin',
    name: '人事・総務の責任者',
    name_en: 'HR / General Affairs Lead',
    description: '人的セキュリティ統括',
    responsibilities: ['入退社時のセキュリティ手続き', 'セキュリティ教育の企画', '物理セキュリティ管理'],
    display_order: 9,
    is_required: false
  },
  {
    key: 'isms_secretariat_head',
    name: 'ISMS事務局長',
    name_en: 'ISMS Secretariat Lead',
    description: 'ISMS文書の統制・管理を担当',
    responsibilities: ['ISMS文書の管理', '運用状況のモニタリング', 'マネジメントレビュー資料の準備'],
    display_order: 10,
    is_required: true
  },
  {
    key: 'isms_secretariat_staff',
    name: 'ISMS事務局員',
    name_en: 'ISMS Secretariat Staff',
    description: 'ISMS日次業務の支援を担当',
    responsibilities: ['記録・エビデンスの管理', '社内問い合わせ対応', '運用報告書の作成補助'],
    display_order: 11,
    is_required: false
  }
]

export default function RoleSeedWizardDialog({
  organizationId,
  isOpen,
  onClose,
  onSuccess,
  onError,
  existingRoleCount = 0
}: RoleSeedWizardDialogProps) {
  const t = useTranslations('settings.organization.structure.wizard')
  const commonT = useTranslations('common')

  const [step, setStep] = useState<WizardStep>('selection')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null)

  const [roles, setRoles] = useState<RecommendedRole[]>(() =>
    RECOMMENDED_ROLES.map(role => ({ ...role, selected: true }))
  )

  const [searchQuery, setSearchQuery] = useState('')

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles
    const query = searchQuery.toLowerCase()
    return roles.filter(
      role =>
        role.name.toLowerCase().includes(query) ||
        role.name_en?.toLowerCase().includes(query) ||
        role.key.toLowerCase().includes(query)
    )
  }, [roles, searchQuery])

  const selectedRoles = useMemo(() => roles.filter(role => role.selected), [roles])

  const toggleRole = useCallback((key: string) => {
    setRoles(prev =>
      prev.map(role =>
        role.key === key ? { ...role, selected: !role.selected } : role
      )
    )
  }, [])

  const selectAll = useCallback(() => {
    setRoles(prev => prev.map(role => ({ ...role, selected: true })))
  }, [])

  const deselectAll = useCallback(() => {
    setRoles(prev => prev.map(role => ({ ...role, selected: false })))
  }, [])

  const handleNext = () => {
    if (selectedRoles.length === 0) {
      onError?.(t('errors.noSelection'))
      return
    }
    setStep('confirmation')
  }

  const handleBack = () => {
    setStep('selection')
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const payload = selectedRoles.map(({ selected: _selected, ...role }) => role)

      const response = await fetch(`/api/organizations/${organizationId}/structure/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: payload })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('errors.submitFailed'))
      }

      const data = await response.json()
      setResult({ inserted: data.inserted, skipped: data.skipped })
      setStep('result')
      onSuccess?.(data)
    } catch (err) {
      console.error('Failed to seed project roles:', err)
      onError?.(err instanceof Error ? err.message : t('errors.submitFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // ダイアログを閉じてリセット
    setStep('selection')
    setResult(null)
    setSearchQuery('')
    setRoles(RECOMMENDED_ROLES.map(role => ({ ...role, selected: true })))
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
      <div
        className="w-full max-w-3xl rounded-2xl bg-surface shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="wizard-title" className="text-lg font-semibold text-text-primary">
              {t('title')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-secondary"
          >
            <span className="sr-only">{commonT('close')}</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicators */}
        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center justify-center gap-4">
            {(['selection', 'confirmation', 'result'] as WizardStep[]).map((s, index) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                    step === s
                      ? 'bg-indigo-600 text-white'
                      : (['selection', 'confirmation', 'result'].indexOf(step) > index)
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-surface-elevated text-text-muted'
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-sm ${
                    step === s ? 'font-medium text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {t(`steps.${s}`)}
                </span>
                {index < 2 && (
                  <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {/* Existing roles warning */}
          {existingRoleCount >= 5 && step === 'selection' && (
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium">{t('existingWarning.title', { count: existingRoleCount })}</p>
                  <p className="mt-1">{t('existingWarning.description')}</p>
                </div>
              </div>
            </div>
          )}

          {step === 'selection' && (
            <div className="space-y-4">
              {/* Search and bulk actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('search.placeholder')}
                    className="w-full rounded-lg border border-border py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
                  >
                    {t('actions.selectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
                  >
                    {t('actions.deselectAll')}
                  </button>
                </div>
              </div>

              {/* Selection count */}
              <p className="text-sm text-text-secondary">
                {t('selection.count', { selected: selectedRoles.length, total: roles.length })}
              </p>

              {/* Role list */}
              <div className="space-y-2" role="listbox" aria-describedby="wizard-description">
                {filteredRoles.map(role => (
                  <label
                    key={role.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                      role.selected
                        ? 'border-indigo-200 bg-indigo-50/50'
                        : 'border-border hover:bg-surface-elevated'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={role.selected}
                      onChange={() => toggleRole(role.key)}
                      className="mt-1 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{role.name}</span>
                        {role.is_required && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            {t('badge.required')}
                          </span>
                        )}
                      </div>
                      {role.name_en && (
                        <p className="text-sm text-text-muted">{role.name_en}</p>
                      )}
                      {role.description && (
                        <p className="mt-1 text-sm text-text-secondary">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">{t('confirmation.description')}</p>

              <div className="rounded-lg border border-border divide-y divide-border">
                {selectedRoles.map(role => (
                  <div key={role.key} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{role.name}</span>
                        {role.is_required && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            {t('badge.required')}
                          </span>
                        )}
                      </div>
                      {role.name_en && (
                        <p className="text-sm text-text-muted">{role.name_en}</p>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">{role.key}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-surface-elevated p-4">
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{selectedRoles.length}</span>
                  {' '}{t('confirmation.rolesWillBeCreated')}
                </p>
                <p className="mt-1 text-xs text-text-muted">{t('confirmation.existingWillBeSkipped')}</p>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-text-primary">{t('result.title')}</h3>
                <p className="mt-2 text-sm text-text-secondary">{t('result.description')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-emerald-50 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.inserted}</p>
                  <p className="text-sm text-emerald-600">{t('result.inserted')}</p>
                </div>
                <div className="rounded-lg bg-surface-elevated p-4 text-center">
                  <p className="text-2xl font-bold text-text-secondary">{result.skipped}</p>
                  <p className="text-sm text-text-secondary">{t('result.skipped')}</p>
                </div>
              </div>

              <p className="text-center text-sm text-text-muted">{t('result.editHint')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div>
            {step === 'selection' && (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
              >
                {commonT('cancel')}
              </button>
            )}
            {step === 'confirmation' && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
              >
                {commonT('back')}
              </button>
            )}
          </div>

          <div>
            {step === 'selection' && (
              <button
                type="button"
                onClick={handleNext}
                disabled={selectedRoles.length === 0}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {commonT('next')}
              </button>
            )}
            {step === 'confirmation' && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSubmitting ? t('actions.submitting') : t('actions.submit')}
              </button>
            )}
            {step === 'result' && (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                {commonT('close')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
