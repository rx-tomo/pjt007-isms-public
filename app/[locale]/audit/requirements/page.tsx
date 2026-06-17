'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuditAccess } from '@/lib/hooks/useAuditAccess'
import {
  AuditService,
  type AuditPlanWithRelations,
  type ISO27001Requirement
} from '@/lib/services/audit'

interface ToastState {
  type: 'success' | 'error'
  message: string
}

interface RequirementNode extends ISO27001Requirement {
  children?: RequirementNode[]
}

function flattenRequirements(requirements: RequirementNode[]): RequirementNode[] {
  const result: RequirementNode[] = []

  const walk = (nodes: RequirementNode[]) => {
    for (const node of nodes) {
      result.push(node)
      if (node.children?.length) {
        walk(node.children as RequirementNode[])
      }
    }
  }

  walk(requirements)
  return result
}

function updateRequirementTree(
  tree: RequirementNode[],
  targetId: string,
  updated: RequirementNode
): RequirementNode[] {
  return tree.map(node => {
    if (node.id === targetId) {
      return { ...node, ...updated }
    }

    if (node.children?.length) {
      return {
        ...node,
        children: updateRequirementTree(node.children as RequirementNode[], targetId, updated)
      }
    }

    return node
  })
}

export default function AuditRequirementsPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('audit')
  const { isAuthorized, isLoading: accessLoading, error: accessError, profile } = useAuditAccess()
  const [requirements, setRequirements] = useState<RequirementNode[]>([])
  const [auditPlans, setAuditPlans] = useState<AuditPlanWithRelations[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [savingRequirement, setSavingRequirement] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const auditService = useMemo(() => new AuditService(), [])
  const organizationId = profile?.organization_id

  const flattened = useMemo(() => flattenRequirements(requirements), [requirements])

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [reqs, plans] = await Promise.all([
        auditService.getISO27001Requirements(),
        auditService.getAuditPlans(organizationId)
      ])

      setRequirements(reqs as RequirementNode[])
      setAuditPlans(plans)
      if (plans.length > 0) {
        setSelectedPlanId(prev => prev || plans[0].id)
      }
      setSelectedRequirementIds(prev =>
        prev.length
          ? prev
          : flattenRequirements(reqs as RequirementNode[])
              .filter(item => item.is_applicable)
              .map(item => item.id)
      )
    } catch (err) {
      console.error('[AuditRequirements] Failed to load requirements', err)
      setToast({ type: 'error', message: t('requirements.toast.loadFailed') })
    } finally {
      setLoading(false)
    }
  }, [auditService, organizationId, t])

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

  const handleToggleApplicability = async (requirement: RequirementNode) => {
    if (savingRequirement) return
    setSavingRequirement(requirement.id)

    try {
      const updated = await auditService.updateRequirementApplicability(requirement.id, !requirement.is_applicable)
      const nextNode: RequirementNode = { ...requirement, ...updated }
      setRequirements(prev => updateRequirementTree(prev, requirement.id, nextNode))
      setToast({
        type: 'success',
        message: requirement.is_applicable
          ? t('requirements.toast.markNotApplicable')
          : t('requirements.toast.markApplicable')
      })
    } catch (err) {
      console.error('[AuditRequirements] Failed to update applicability', err)
      setToast({ type: 'error', message: t('requirements.toast.updateFailed') })
    } finally {
      setSavingRequirement(null)
    }
  }

  const handleRequirementSelection = (requirementId: string, checked: boolean) => {
    setSelectedRequirementIds(prev => {
      if (checked) {
        return prev.includes(requirementId) ? prev : [...prev, requirementId]
      }
      return prev.filter(id => id !== requirementId)
    })
  }

  const handleGenerateChecklist = async () => {
    if (!selectedPlanId) {
      setToast({ type: 'error', message: t('requirements.toast.planRequired') })
      return
    }
    const requirementMap = new Map(flattened.map(req => [req.id, req]))
    const requirementsToCreate = selectedRequirementIds
      .map(id => requirementMap.get(id))
      .filter((req): req is RequirementNode => Boolean(req))

    if (requirementsToCreate.length === 0) {
      setToast({ type: 'error', message: t('requirements.toast.requirementRequired') })
      return
    }

    setGenerating(true)
    try {
      await auditService.bulkCreateChecklists(selectedPlanId, requirementsToCreate)
      setToast({ type: 'success', message: t('requirements.toast.generateSuccess') })
    } catch (err) {
      console.error('[AuditRequirements] Failed to generate checklists', err)
      setToast({ type: 'error', message: t('requirements.toast.generateFailed') })
    } finally {
      setGenerating(false)
    }
  }

  const renderRequirement = (requirement: RequirementNode, depth = 0) => {
    const paddingLeft = depth * 16
    const isSelected = selectedRequirementIds.includes(requirement.id)
    const isApplicable = requirement.is_applicable

    return (
      <div key={requirement.id} className="border border-border rounded-lg p-4 mb-3 bg-surface shadow-sm">
        <div className="flex flex-col gap-3" style={{ paddingLeft }}>
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div>
              <p className="text-sm font-medium text-text-muted">{requirement.clause_number}</p>
              <h3 className="text-lg font-semibold text-text-primary">{requirement.title}</h3>
              {requirement.description && (
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{requirement.description}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={isSelected}
                  onChange={event => handleRequirementSelection(requirement.id, event.target.checked)}
                />
                {t('requirements.fields.select')}
              </label>
              <button
                type="button"
                className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium ${
                  isApplicable ? 'border-green-200 bg-green-50 text-green-700' : 'border-border bg-surface text-text-secondary'
                } ${savingRequirement === requirement.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                onClick={() => handleToggleApplicability(requirement)}
                disabled={savingRequirement === requirement.id}
              >
                {savingRequirement === requirement.id
                  ? t('requirements.actions.updating')
                  : isApplicable
                    ? t('requirements.actions.markNotApplicable')
                    : t('requirements.actions.markApplicable')}
              </button>
            </div>
          </div>
        </div>
        {requirement.children?.length ? (
          <div className="mt-3 space-y-3">
            {requirement.children.map(child => renderRequirement(child as RequirementNode, depth + 1))}
          </div>
        ) : null}
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

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('requirements.title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('requirements.description')}</p>
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
        <div className="mt-8 text-center text-text-muted">{t('requirements.loading')}</div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{t('requirements.generate.title')}</h2>
                <p className="text-sm text-text-secondary">{t('requirements.generate.description')}</p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="flex flex-col text-sm text-text-secondary">
                  <span className="mb-1 font-medium">{t('requirements.fields.plan')}</span>
                  <select
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    value={selectedPlanId}
                    onChange={event => setSelectedPlanId(event.target.value)}
                  >
                    <option value="">{t('requirements.fields.planPlaceholder')}</option>
                    {auditPlans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateChecklist}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={generating}
                >
                  {generating ? t('requirements.actions.generating') : t('requirements.actions.generate')}
                </button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">{t('requirements.listTitle')}</h2>
            <div className="space-y-3">
              {requirements.map(requirement => renderRequirement(requirement))}
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  )
}
