'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuditAccess } from '@/lib/hooks/useAuditAccess'
import {
  AuditService,
  type AuditPlanWithRelations,
  type AuditStatus,
  type AuditUnit,
  type TeamRole,
  type FollowUpRecord
} from '@/lib/services/audit'
import { UserService } from '@/lib/services/user'
import type { Database } from '@/types/database.types'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface PlanFormState {
  status: AuditStatus
  actualStartDate: string
  actualEndDate: string
  description: string
  auditedUnitId: string
  auditorSignature: string
}

interface TeamFormState {
  userId: string
  role: TeamRole
}

interface FollowUpFormState {
  title: string
  description: string
  assignedTo: string
  dueDate: string
}

type FollowUpStatus = FollowUpRecord['status']

const STATUS_OPTIONS: AuditStatus[] = ['planning', 'scheduled', 'in_progress', 'completed', 'cancelled']
const TEAM_ROLES: TeamRole[] = ['lead', 'auditor', 'observer']

const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  open: 'open',
  in_progress: 'inProgress',
  completed: 'completed',
  verified: 'verified',
  closed: 'closed'
}

const FOLLOW_UP_STATUS_COLORS: Record<FollowUpStatus, string> = {
  open: 'bg-surface-elevated text-text-primary',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  verified: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-purple-100 text-purple-800'
}

export default function AuditPlanDetailPage(
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
  const router = useRouter()
  const { isAuthorized, isLoading: accessLoading, error: accessError, profile } = useAuditAccess()
  const [plan, setPlan] = useState<AuditPlanWithRelations | null>(null)
  const [formState, setFormState] = useState<PlanFormState | null>(null)
  const [teamMembers, setTeamMembers] = useState<AuditPlanWithRelations['team_members']>([])
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([])
  const [auditUnits, setAuditUnits] = useState<AuditUnit[]>([])
  const [teamForm, setTeamForm] = useState<TeamFormState>({ userId: '', role: 'auditor' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teamSaving, setTeamSaving] = useState<string | null>(null)
  const [submittingApproval, setSubmittingApproval] = useState(false)
  const [startingAudit, setStartingAudit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Follow-up state
  const [followUpRecords, setFollowUpRecords] = useState<FollowUpRecord[]>([])
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormState>({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: ''
  })
  const [followUpCreating, setFollowUpCreating] = useState(false)
  const [followUpActionId, setFollowUpActionId] = useState<string | null>(null)
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)

  const auditService = useMemo(() => new AuditService(), [])
  const userService = useMemo(() => new UserService(), [])

  const organizationId = profile?.organization_id

  const loadFollowUpRecords = useCallback(async () => {
    if (!planId) return
    try {
      const records = await auditService.getFollowUpRecords(planId)
      setFollowUpRecords(records)
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to load follow-up records', err)
    }
  }, [auditService, planId])

  const loadPlan = useCallback(async () => {
    if (!planId) return

    setLoading(true)
    setError(null)

    try {
      const [planData, users, units] = await Promise.all([
        auditService.getAuditPlanById(planId),
        organizationId ? userService.getOrganizationUsers(organizationId) : Promise.resolve([] as UserProfile[]),
        organizationId ? auditService.getAuditUnits(organizationId) : Promise.resolve([] as AuditUnit[])
      ])

      if (!planData) {
        setError(t('errors.loadFailed'))
        return
      }

      setPlan(planData)
      setTeamMembers(planData.team_members || [])
      setFormState({
        status: planData.status,
        actualStartDate: planData.actual_start_date ? planData.actual_start_date.substring(0, 10) : '',
        actualEndDate: planData.actual_end_date ? planData.actual_end_date.substring(0, 10) : '',
        description: planData.description ?? '',
        auditedUnitId: planData.audited_unit_id ?? '',
        auditorSignature: planData.auditor_signature ?? ''
      })

      if (organizationId) {
        const eligible = users.filter(user =>
          ['org_admin', 'auditor', 'system_operator', 'approver'].includes(user.role)
        )
        setAvailableUsers(eligible)
        setAuditUnits(units)
      }

      // Load follow-up records
      await loadFollowUpRecords()
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to load plan', err)
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [auditService, loadFollowUpRecords, organizationId, planId, t, userService])

  useEffect(() => {
    if (accessLoading) return

    if (!isAuthorized) {
      setLoading(false)
      return
    }

    loadPlan()
  }, [accessLoading, isAuthorized, loadPlan])

  const handlePlanUpdate = async () => {
    if (!plan || !formState) return

    setSaving(true)
    setError(null)

    try {
      const updates = {
        status: formState.status,
        actual_start_date: formState.actualStartDate || undefined,
        actual_end_date: formState.actualEndDate || undefined,
        description: formState.description ? formState.description : undefined,
        audited_unit_id: formState.auditedUnitId || undefined,
        auditor_signature: formState.auditorSignature || undefined,
        auditor_signed_at: formState.auditorSignature
          ? (plan.auditor_signature === formState.auditorSignature ? plan.auditor_signed_at : new Date().toISOString())
          : null
      }

      const updated = await auditService.updateAuditPlan(plan.id, updates)
      setPlan(prev =>
        prev
          ? {
              ...prev,
              ...updated,
              team_members: prev.team_members,
              lead_auditor: prev.lead_auditor
            }
          : prev
      )
      setSaving(false)
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to update plan', err)
      setError(t('errors.updateFailed'))
      setSaving(false)
    }
  }

  const handleSubmitForApproval = async () => {
    if (!plan) return

    setSubmittingApproval(true)
    setError(null)

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitAuditPlanApproval',
          planId: plan.id
        })
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || '監査計画の承認申請に失敗しました')
      }
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to submit approval request', err)
      setError('監査計画の承認申請に失敗しました。')
    } finally {
      setSubmittingApproval(false)
    }
  }

  const handleStartAudit = async () => {
    if (!plan) return

    setStartingAudit(true)
    setError(null)

    try {
      const updated = await auditService.startAuditPlan(plan.id)
      setPlan(prev =>
        prev
          ? {
              ...prev,
              ...updated,
              team_members: prev.team_members,
              lead_auditor: prev.lead_auditor
            }
          : prev
      )
      setFormState(prev =>
        prev
          ? {
              ...prev,
              status: updated.status,
              actualStartDate: updated.actual_start_date ? updated.actual_start_date.substring(0, 10) : prev.actualStartDate
            }
          : prev
      )
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to start audit plan', err)
      setError('監査の開始に失敗しました。')
    } finally {
      setStartingAudit(false)
    }
  }

  const handleTeamRoleChange = async (memberId: string, nextRole: TeamRole) => {
    const member = teamMembers?.find(m => m.id === memberId)
    if (!plan || !member || member.role === nextRole) return

    setTeamSaving(memberId)
    setError(null)

    try {
      const updatedMember = await auditService.updateTeamMember(memberId, { role: nextRole })

      let nextTeam = teamMembers?.map(m => (m.id === memberId ? { ...m, ...updatedMember } : m)) ?? []

      if (nextRole === 'lead') {
        if (plan.lead_auditor_id !== member.user_id) {
          const updatedPlan = await auditService.updateAuditPlan(plan.id, {
            lead_auditor_id: member.user_id
          })
          setPlan(prev =>
            prev
              ? {
                  ...prev,
                  ...updatedPlan,
                  team_members: prev.team_members,
                  lead_auditor: updatedMember.user ?? prev.lead_auditor ?? null
                }
              : prev
          )
        }

        const otherLead = nextTeam.find(m => m.id !== memberId && m.role === 'lead')
        if (otherLead) {
          const demoted = await auditService.updateTeamMember(otherLead.id, { role: 'auditor' })
          nextTeam = nextTeam.map(m => (m.id === otherLead.id ? { ...m, ...demoted } : m))
        }

      } else if (plan.lead_auditor_id === member.user_id) {
        const updatedPlan = await auditService.updateAuditPlan(plan.id, {
          lead_auditor_id: undefined
        })
        setPlan(prev =>
          prev
            ? {
                ...prev,
                ...updatedPlan,
                team_members: prev.team_members,
                lead_auditor_id: undefined,
                lead_auditor: null
              }
            : prev
        )
      }

      setTeamMembers(nextTeam)
      setPlan(prev => (prev ? { ...prev, team_members: nextTeam } : prev))
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to update team member', err)
      setError(t('errors.updateFailed'))
    } finally {
      setTeamSaving(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    const member = teamMembers?.find(m => m.id === memberId)
    if (!plan || !member) return

    setTeamSaving(memberId)
    setError(null)

    try {
      await auditService.removeTeamMember(memberId)

      if (plan.lead_auditor_id === member.user_id) {
        const updatedPlan = await auditService.updateAuditPlan(plan.id, { lead_auditor_id: undefined })
        setPlan(prev =>
          prev
            ? {
                ...prev,
                ...updatedPlan,
                team_members: prev.team_members,
                lead_auditor_id: undefined,
                lead_auditor: null
              }
            : prev
        )
      }

      setTeamMembers(prev => prev?.filter(m => m.id !== memberId) ?? [])
      setPlan(prev =>
        prev
          ? {
              ...prev,
              team_members: prev.team_members?.filter(m => m.id !== memberId) ?? []
            }
          : prev
      )
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to remove team member', err)
      setError(t('errors.updateFailed'))
    } finally {
      setTeamSaving(null)
    }
  }

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!plan || !teamForm.userId) {
      return
    }

    if (teamMembers?.some(m => m.user_id === teamForm.userId)) {
      setError(t('detail.sections.team.duplicate'))
      return
    }

    setTeamSaving(teamForm.userId)
    setError(null)

    try {
      const newMember = await auditService.addTeamMember(plan.id, teamForm.userId, teamForm.role)
      let nextMembers = [...(teamMembers ?? []), newMember]

      if (teamForm.role === 'lead') {
        const updatedPlan = await auditService.updateAuditPlan(plan.id, { lead_auditor_id: teamForm.userId })
        const otherLead = nextMembers.filter(m => m.id !== newMember.id && m.role === 'lead')
        for (const lead of otherLead) {
          const demoted = await auditService.updateTeamMember(lead.id, { role: 'auditor' })
          nextMembers = nextMembers.map(m => (m.id === lead.id ? { ...m, ...demoted } : m))
        }
        setPlan(prev =>
          prev
            ? {
                ...prev,
                ...updatedPlan,
                team_members: prev.team_members,
                lead_auditor: newMember.user ?? prev.lead_auditor ?? null
              }
            : prev
        )
      }

      setTeamMembers(nextMembers)
      setPlan(prev => (prev ? { ...prev, team_members: nextMembers } : prev))
      setTeamForm({ userId: '', role: 'auditor' })
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to add team member', err)
      setError(t('errors.updateFailed'))
    } finally {
      setTeamSaving(null)
    }
  }

  // Follow-up handlers
  const handleCreateFollowUp = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!followUpForm.title.trim()) {
      setError(t('followUp.toast.titleRequired'))
      return
    }

    setFollowUpCreating(true)
    setError(null)

    try {
      await auditService.createFollowUpRecord({
        auditPlanId: planId,
        title: followUpForm.title.trim(),
        description: followUpForm.description.trim() || undefined,
        assignedTo: followUpForm.assignedTo || undefined,
        dueDate: followUpForm.dueDate || undefined
      })

      setFollowUpForm({ title: '', description: '', assignedTo: '', dueDate: '' })
      setShowFollowUpForm(false)
      await loadFollowUpRecords()
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to create follow-up', err)
      setError(t('followUp.toast.createFailed'))
    } finally {
      setFollowUpCreating(false)
    }
  }

  const handleFollowUpStatusChange = async (recordId: string, newStatus: string) => {
    setFollowUpActionId(recordId)
    setError(null)

    try {
      if (newStatus === 'completed') {
        await auditService.completeFollowUpRecord(recordId)
      } else if (newStatus === 'verified') {
        await auditService.verifyFollowUpRecord(recordId)
      } else {
        await auditService.updateFollowUpRecord(recordId, { status: newStatus })
      }
      await loadFollowUpRecords()
    } catch (err) {
      console.error('[AuditPlanDetail] Failed to update follow-up status', err)
      setError(t('followUp.toast.updateFailed'))
    } finally {
      setFollowUpActionId(null)
    }
  }

  const renderStatusBadge = (status: AuditStatus) => {
    const tone: Record<AuditStatus, string> = {
      planning: 'bg-surface-elevated text-text-primary',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tone[status]}`}>
        {t(`plans.status.${status}`)}
      </span>
    )
  }

  const renderFollowUpStatusBadge = (status: FollowUpStatus) => {
    const labelKey = FOLLOW_UP_STATUS_LABELS[status]
    const colorClass = FOLLOW_UP_STATUS_COLORS[status]

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
        {t(`followUp.${labelKey}`)}
      </span>
    )
  }

  const getNextStatus = (current: FollowUpStatus): FollowUpStatus | null => {
    const flow: Partial<Record<FollowUpStatus, FollowUpStatus>> = {
      open: 'in_progress',
      in_progress: 'completed',
      completed: 'verified'
    }
    return flow[current] ?? null
  }

  const getNextStatusLabel = (current: FollowUpStatus): string | null => {
    const next = getNextStatus(current)
    if (!next) return null
    if (next === 'completed') return t('followUp.markComplete')
    if (next === 'verified') return t('followUp.markVerified')
    return t(`followUp.${FOLLOW_UP_STATUS_LABELS[next]}`)
  }

  const renderSkeleton = () => (
    <div className="space-y-6">
      <div className="h-10 w-48 rounded-lg bg-surface-elevated" />
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-32 rounded-2xl bg-surface-elevated" />
        ))}
      </div>
    </div>
  )

  if (accessLoading || loading) {
    return (
      <DashboardLayout locale={locale}>
        <div className="px-4 py-12 sm:px-6 lg:px-8">
          {renderSkeleton()}
        </div>
      </DashboardLayout>
    )
  }

  if (!isAuthorized) {
    return (
      <DashboardLayout locale={locale}>
        <div className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-orange-200 bg-surface p-10 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">{t('accessDenied.title')}</h1>
            <p className="mt-2 text-sm text-text-secondary">{t('accessDenied.description')}</p>
            {accessError === 'permission_fetch_failed' && (
              <p className="mt-4 text-xs text-red-600">{t('accessDenied.permissionFetchFailed')}</p>
            )}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!plan || !formState) {
    return (
      <DashboardLayout locale={locale}>
        <div className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {t('errors.loadFailed')}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const teamMemberIds = new Set(teamMembers?.map(member => member.user_id))
  const selectableUsers = availableUsers.filter(user => !teamMemberIds.has(user.id))

  return (
    <DashboardLayout locale={locale}>
      <div className="space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs text-text-muted">
              <Link href={`/${locale}/audit`} className="text-indigo-600 hover:text-indigo-700">
                {t('title')}
              </Link>{' '}
              / {t('plans.title')}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-text-primary">{plan.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {renderStatusBadge(plan.status)}
              <span className="text-xs text-text-muted">
                {t('detail.leadAuditorLabel', {
                  name: plan.lead_auditor?.full_name || plan.lead_auditor?.email || t('detail.unassigned')
                })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={submittingApproval || plan.status === 'scheduled' || plan.status === 'in_progress' || plan.status === 'completed'}
              data-testid="audit-plan-submit-approval"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {submittingApproval ? '承認申請中...' : '承認申請'}
            </button>
            <button
              type="button"
              onClick={handleStartAudit}
              disabled={startingAudit || plan.status !== 'scheduled'}
              data-testid="audit-plan-start-button"
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {startingAudit ? '開始中...' : '監査開始'}
            </button>
            <button
              onClick={() => router.push(`/${locale}/audit/plans/${plan.id}/report`)}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h10M7 12h10M7 17h6" />
              </svg>
              {t('reports.generate')}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-6 rounded-3xl border border-border bg-surface p-6 shadow-sm">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    {t('detail.sections.overview.badge')}
                  </p>
                  <h2 className="text-lg font-semibold text-text-primary">{t('detail.sections.overview.title')}</h2>
                  <p className="text-sm text-text-muted">{t('detail.sections.overview.description')}</p>
                </div>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-muted">{t('plans.columns.type')}</label>
                  <p className="mt-1 text-sm text-text-primary">{plan.audit_type?.toUpperCase()}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted">{t('detail.schedule.plannedRange')}</label>
                  <p className="mt-1 text-sm text-text-primary">
                    {plan.planned_start_date ? plan.planned_start_date.substring(0, 10) : '-'}
                    {plan.planned_end_date ? ` → ${plan.planned_end_date.substring(0, 10)}` : ''}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted" htmlFor="description">
                  {t('form.description')}
                </label>
                <textarea
                  id="description"
                  data-testid="audit-plan-detail-description"
                  value={formState.description}
                  onChange={event =>
                    setFormState(prev => (prev ? { ...prev, description: event.target.value } : prev))
                  }
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-border px-3 py-2 text-sm shadow-inner focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted" htmlFor="auditedUnitId">
                    監査対象ユニット
                  </label>
                  <select
                    id="auditedUnitId"
                    value={formState.auditedUnitId}
                    onChange={event =>
                      setFormState(prev => (prev ? { ...prev, auditedUnitId: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-border px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">選択してください</option>
                    {auditUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.unit_type === 'site' ? '拠点' : '業務プロセス'})
                      </option>
                    ))}
                  </select>
                  {auditUnits.length === 0 && (
                    <p className="text-xs text-amber-700">
                      監査対象ユニットが未登録です。CSVシード取込後に選択できます。
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted" htmlFor="auditorSignature">
                    監査員サイン（承認）
                  </label>
                  <input
                    id="auditorSignature"
                    type="text"
                    value={formState.auditorSignature}
                    onChange={event =>
                      setFormState(prev => (prev ? { ...prev, auditorSignature: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-border px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    placeholder="例: 監査担当 山田 太郎"
                  />
                  {plan.auditor_signed_at && (
                    <p className="text-xs text-text-muted">
                      署名記録: {plan.auditor_signed_at.substring(0, 10)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted" htmlFor="status">
                    {t('detail.schedule.statusLabel')}
                  </label>
                  <select
                    id="status"
                    value={formState.status}
                    onChange={event =>
                      setFormState(prev => (prev ? { ...prev, status: event.target.value as AuditStatus } : prev))
                    }
                    className="w-full rounded-2xl border border-border px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>
                        {t(`plans.status.${status}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted" htmlFor="actualStartDate">
                    {t('detail.schedule.actualStart')}
                  </label>
                  <input
                    id="actualStartDate"
                    data-testid="audit-plan-actual-start-date"
                    type="date"
                    value={formState.actualStartDate}
                    onChange={event =>
                      setFormState(prev => (prev ? { ...prev, actualStartDate: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-border px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted" htmlFor="actualEndDate">
                    {t('detail.schedule.actualEnd')}
                  </label>
                  <input
                    id="actualEndDate"
                    data-testid="audit-plan-actual-end-date"
                    type="date"
                    value={formState.actualEndDate}
                    onChange={event =>
                      setFormState(prev => (prev ? { ...prev, actualEndDate: event.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-border px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePlanUpdate}
                  disabled={saving}
                  data-testid="audit-plan-save-button"
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {saving ? t('form.saving') : t('form.save')}
                </button>
              </div>
            </div>

            {/* Follow-up Section */}
            <div className="space-y-6 rounded-3xl border border-border bg-surface p-6 shadow-sm">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                    {t('followUp.title')}
                  </p>
                  <h2 className="text-lg font-semibold text-text-primary">{t('followUp.title')}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-600">
                    {followUpRecords.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('followUp.addNew')}
                  </button>
                </div>
              </header>

              {/* Follow-up creation form */}
              {showFollowUpForm && (
                <form
                  onSubmit={handleCreateFollowUp}
                  className="space-y-4 rounded-2xl border border-teal-100 bg-teal-50/40 p-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-teal-700" htmlFor="followup-title">
                      {t('followUp.recordTitle')}
                    </label>
                    <input
                      id="followup-title"
                      type="text"
                      value={followUpForm.title}
                      onChange={event =>
                        setFollowUpForm(prev => ({ ...prev, title: event.target.value }))
                      }
                      placeholder={t('followUp.titlePlaceholder')}
                      className="w-full rounded-2xl border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-teal-700" htmlFor="followup-description">
                      {t('followUp.description')}
                    </label>
                    <textarea
                      id="followup-description"
                      value={followUpForm.description}
                      onChange={event =>
                        setFollowUpForm(prev => ({ ...prev, description: event.target.value }))
                      }
                      rows={3}
                      placeholder={t('followUp.descriptionPlaceholder')}
                      className="w-full rounded-2xl border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-teal-700" htmlFor="followup-assignee">
                        {t('followUp.assignedTo')}
                      </label>
                      <select
                        id="followup-assignee"
                        value={followUpForm.assignedTo}
                        onChange={event =>
                          setFollowUpForm(prev => ({ ...prev, assignedTo: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      >
                        <option value="">{t('followUp.selectAssignee')}</option>
                        {availableUsers.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.full_name || user.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-teal-700" htmlFor="followup-duedate">
                        {t('followUp.dueDate')}
                      </label>
                      <input
                        id="followup-duedate"
                        type="date"
                        value={followUpForm.dueDate}
                        onChange={event =>
                          setFollowUpForm(prev => ({ ...prev, dueDate: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowFollowUpForm(false)}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-elevated"
                    >
                      {t('form.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={followUpCreating}
                      className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
                    >
                      {followUpCreating ? t('followUp.creating') : t('followUp.addNew')}
                    </button>
                  </div>
                </form>
              )}

              {/* Follow-up records list */}
              {followUpRecords.length > 0 ? (
                <div className="space-y-3">
                  {followUpRecords.map(record => {
                    const nextStatusLabel = getNextStatusLabel(record.status)
                    const nextStatus = getNextStatus(record.status)
                    const assigneeName =
                      record.assigned_user?.full_name || record.assigned_user?.email || null

                    return (
                      <div
                        key={record.id}
                        data-testid={`follow-up-card-${record.id}`}
                        className="rounded-2xl border border-border p-4 shadow-sm transition hover:border-border"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-text-primary">
                                {record.title}
                              </h3>
                              <span data-testid={`follow-up-status-${record.id}`}>
                                {renderFollowUpStatusBadge(record.status)}
                              </span>
                            </div>

                            {record.description && (
                              <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                                {record.description}
                              </p>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                              {assigneeName && (
                                <span className="flex items-center gap-1">
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  {assigneeName}
                                </span>
                              )}
                              {record.due_date && (
                                <span className="flex items-center gap-1">
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {record.due_date}
                                </span>
                              )}
                              {record.completed_at && (
                                <span
                                  data-testid={`follow-up-completed-at-${record.id}`}
                                  className="text-green-600"
                                >
                                  {t('followUp.completed')}: {record.completed_at.substring(0, 10)}
                                </span>
                              )}
                              {record.verified_at && (
                                <span
                                  data-testid={`follow-up-verified-at-${record.id}`}
                                  className="text-emerald-600"
                                >
                                  {t('followUp.verified')}: {record.verified_at.substring(0, 10)}
                                </span>
                              )}
                            </div>
                          </div>

                          {nextStatusLabel && nextStatus && (
                            <button
                              type="button"
                              data-testid={`follow-up-next-status-${record.id}`}
                              onClick={() => handleFollowUpStatusChange(record.id, nextStatus)}
                              disabled={followUpActionId === record.id}
                              className="shrink-0 rounded-full border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {followUpActionId === record.id ? t('followUp.saving') : nextStatusLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
                  {t('followUp.noRecords')}
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    {t('detail.sections.team.badge')}
                  </p>
                  <h2 className="text-lg font-semibold text-text-primary">{t('detail.sections.team.title')}</h2>
                  <p className="text-sm text-text-muted">{t('detail.sections.team.description')}</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                  {teamMembers?.length ?? 0} {t('detail.sections.team.countSuffix')}
                </span>
              </header>

              <div className="mt-4 space-y-3">
                {teamMembers && teamMembers.length > 0 ? (
                  teamMembers.map(member => (
                    <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            {member.user?.full_name || member.user?.email || '—'}
                          </p>
                          <p className="text-xs text-text-muted">{member.user?.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={teamSaving === member.id}
                          className="rounded-full border border-border px-3 py-1 text-xs text-text-muted transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t('detail.sections.team.remove')}
                        </button>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-text-muted" htmlFor={`role-${member.id}`}>
                          {t('detail.sections.team.roleLabel')}
                        </label>
                        <select
                          id={`role-${member.id}`}
                          value={member.role}
                          onChange={event => handleTeamRoleChange(member.id, event.target.value as TeamRole)}
                          disabled={teamSaving === member.id}
                          className="mt-1 w-full rounded-2xl border border-border px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {TEAM_ROLES.map(role => (
                            <option key={role} value={role}>
                              {t(`detail.sections.team.roles.${role}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                    {t('detail.sections.team.empty')}
                  </p>
                )}
              </div>

              <form onSubmit={handleAddMember} className="mt-6 space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                <p className="text-sm font-medium text-indigo-700">{t('detail.sections.team.addTitle')}</p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-indigo-700" htmlFor="team-user">
                    {t('detail.sections.team.addUserLabel')}
                  </label>
                  <select
                    id="team-user"
                    value={teamForm.userId}
                    onChange={event => setTeamForm(prev => ({ ...prev, userId: event.target.value }))}
                    className="w-full rounded-2xl border border-indigo-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">{t('detail.sections.team.selectPlaceholder')}</option>
                    {selectableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email} ({t(`detail.sections.team.roleOptions.${user.role}`)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-indigo-700" htmlFor="team-role">
                    {t('detail.sections.team.addRoleLabel')}
                  </label>
                  <select
                    id="team-role"
                    value={teamForm.role}
                    onChange={event => setTeamForm(prev => ({ ...prev, role: event.target.value as TeamRole }))}
                    className="w-full rounded-2xl border border-indigo-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {TEAM_ROLES.map(role => (
                      <option key={role} value={role}>
                        {t(`detail.sections.team.roles.${role}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!teamForm.userId || teamSaving === teamForm.userId}
                  className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {t('detail.sections.team.addAction')}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">{t('detail.sections.activity.title')}</h2>
              <p className="mt-1 text-sm text-text-muted">{t('detail.sections.activity.description')}</p>
              <dl className="mt-4 space-y-2 text-sm text-text-secondary">
                <div className="flex justify-between">
                  <dt>{t('detail.sections.activity.createdAt')}</dt>
                  <dd>{new Date(plan.created_at).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('detail.sections.activity.updatedAt')}</dt>
                  <dd>{new Date(plan.updated_at).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>
      </div>
    </DashboardLayout>
  )
}
