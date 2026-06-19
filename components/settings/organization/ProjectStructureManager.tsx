'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { OrganizationService, type ProjectRole, type ProjectAssignmentDetails, type ProjectRolePayload } from '@/lib/services/organization'
import { calculateProjectStructureSummary } from '@/lib/utils/projectStructure'
import { UserService, type UserProfile } from '@/lib/services/user'
import RoleSeedWizardDialog from './RoleSeedWizardDialog'
import type { Database } from '@/types/database.types'

interface ProjectStructureManagerProps {
  organizationId: string
  onSuccess?: (message: string) => void
  onError?: (message: string | null) => void
}

type Invitation = Database['public']['Tables']['organization_invitations']['Row']

interface RoleFormState {
  key: string
  name: string
  nameEn: string
  description: string
  responsibilities: string
  displayOrder: number
  isRequired: boolean
}

const defaultRoleForm: RoleFormState = {
  key: '',
  name: '',
  nameEn: '',
  description: '',
  responsibilities: '',
  displayOrder: 0,
  isRequired: false
}

export default function ProjectStructureManager({
  organizationId,
  onSuccess,
  onError
}: ProjectStructureManagerProps) {
  const t = useTranslations('settings.organization.structure')
  const errorsT = useTranslations('settings.organization.errors')
  const successT = useTranslations('settings.organization.success')

  const organizationService = useMemo(() => new OrganizationService(), [])
  const userService = useMemo(() => new UserService(), [])

  const [isLoading, setIsLoading] = useState(true)
  const [roles, setRoles] = useState<ProjectRole[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignmentDetails[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [roleForm, setRoleForm] = useState<RoleFormState>(defaultRoleForm)
  const [editingRole, setEditingRole] = useState<ProjectRole | null>(null)
  const [activeRoleForAssignment, setActiveRoleForAssignment] = useState<ProjectRole | null>(null)
  const [assignmentSelection, setAssignmentSelection] = useState<{ users: Set<string>; invitations: Set<string> }>(
    () => ({ users: new Set(), invitations: new Set() })
  )
  const [isSavingAssignments, setIsSavingAssignments] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const roleSummary = useMemo(
    () => calculateProjectStructureSummary(roles, assignments),
    [roles, assignments]
  )

  const summaryStatusLabel = roleSummary.isComplete
    ? t('summary.status.complete')
    : t('summary.status.incomplete')

  const summaryStatusDescription = roleSummary.requiredCount > 0
    ? t('summary.status.progress', {
        assigned: roleSummary.satisfiedRequiredRoles,
        total: roleSummary.requiredCount
      })
    : t('summary.status.noRequired')

  const summaryItems: Array<{ key: string; label: string; value: number; helper: string; subHelper?: string }> = [
    {
      key: 'required',
      label: t('summary.items.required.label'),
      value: roleSummary.requiredCount,
      helper: t('summary.items.required.helper', { count: roleSummary.requiredCount })
    },
    {
      key: 'covered',
      label: t('summary.items.covered.label'),
      value: roleSummary.satisfiedRequiredRoles,
      helper:
        roleSummary.requiredCount > 0
          ? t('summary.items.covered.helper', {
              assigned: roleSummary.satisfiedRequiredRoles,
              total: roleSummary.requiredCount
            })
          : t('summary.items.covered.noRequired')
    },
    {
      key: 'assignments',
      label: t('summary.items.assignments.label'),
      value: roleSummary.totalAssignments,
      helper: t('summary.items.assignments.helper', {
        count: roleSummary.totalAssignments
      }),
      subHelper:
        roleSummary.optionalRoleCount > 0
          ? t('summary.items.assignments.optional', {
              assigned: roleSummary.optionalRolesWithAssignments,
              total: roleSummary.optionalRoleCount
            })
          : t('summary.items.assignments.optionalNone')
    }
  ]

  const notifyError = (message: string) => {
    setLocalError(message)
    onError?.(message)
  }

  const resetRoleForm = () => {
    setRoleForm(defaultRoleForm)
    setEditingRole(null)
    setShowRoleForm(false)
  }

  const loadStructure = async () => {
    setIsLoading(true)
    setLocalError(null)
    onError?.(null)
    try {
      const [structure, orgUsers, pendingInvitations] = await Promise.all([
        organizationService.getProjectStructure(organizationId),
        userService.getOrganizationUsers(organizationId),
        userService.getPendingInvitations(organizationId)
      ])

      setRoles(structure.roles)
      setAssignments(structure.assignments)
      setUsers(orgUsers)
      setInvitations(pendingInvitations)
    } catch (err) {
      console.error('Failed to load project structure:', err)
      notifyError(errorsT('structureLoadFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStructure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const handleRoleFormChange = (field: keyof RoleFormState, value: string | number | boolean) => {
    setRoleForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCreateRole = () => {
    setEditingRole(null)
    setRoleForm(defaultRoleForm)
    setShowRoleForm(true)
    setLocalError(null)
    onError?.(null)
  }

  const handleEditRole = (role: ProjectRole) => {
    setEditingRole(role)
    setRoleForm({
      key: role.key,
      name: role.name,
      nameEn: role.name_en ?? '',
      description: role.description ?? '',
      responsibilities: (role.responsibilities ?? []).join('\n'),
      displayOrder: role.display_order ?? 0,
      isRequired: role.is_required ?? false
    })
    setShowRoleForm(true)
    setLocalError(null)
    onError?.(null)
  }

  const refreshStructure = async (messageKey: string) => {
    await loadStructure()
    onSuccess?.(successT(messageKey))
  }

  const handleSubmitRole = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!roleForm.key.trim() || !roleForm.name.trim()) {
      notifyError(errorsT('structureRoleValidation'))
      return
    }

    setIsSavingRole(true)
    try {
      const payload: ProjectRolePayload = {
        key: roleForm.key,
        name: roleForm.name,
        name_en: roleForm.nameEn || undefined,
        description: roleForm.description || undefined,
        responsibilities: roleForm.responsibilities
          ? roleForm.responsibilities
              .split('\n')
              .map(item => item.trim())
              .filter(Boolean)
          : undefined,
        display_order: roleForm.displayOrder,
        is_required: roleForm.isRequired
      }

      if (editingRole) {
        await organizationService.updateProjectRole(organizationId, editingRole.id, payload)
        await refreshStructure('structureSaved')
      } else {
        await organizationService.createProjectRole(organizationId, payload)
        await refreshStructure('structureRoleCreated')
      }
      resetRoleForm()
    } catch (err) {
      console.error('Failed to save project role:', err)
      notifyError(errorsT('structureSaveFailed'))
    } finally {
      setIsSavingRole(false)
    }
  }

  const handleDeleteRole = async (role: ProjectRole) => {
    if (!window.confirm(t('confirmDelete', { name: role.name }))) {
      return
    }

    try {
      await organizationService.deleteProjectRole(organizationId, role.id)
      await refreshStructure('structureRoleDeleted')
    } catch (err) {
      console.error('Failed to delete project role:', err)
      notifyError(errorsT('structureDeleteFailed'))
    }
  }

  const openAssignmentManager = (role: ProjectRole) => {
    const relatedAssignments = assignments.filter(item => item.role_id === role.id)
    const userIds = relatedAssignments
      .map(item => item.user_id)
      .filter((value): value is string => Boolean(value))
    const invitationIds = relatedAssignments
      .map(item => item.invitation_id)
      .filter((value): value is string => Boolean(value))

    setAssignmentSelection({ users: new Set(userIds), invitations: new Set(invitationIds) })
    setActiveRoleForAssignment(role)
    setLocalError(null)
    onError?.(null)
  }

  const toggleAssignment = (type: 'users' | 'invitations', id: string) => {
    setAssignmentSelection(prev => {
      const nextSet = new Set(prev[type])
      if (nextSet.has(id)) {
        nextSet.delete(id)
      } else {
        nextSet.add(id)
      }
      return {
        ...prev,
        [type]: nextSet
      }
    })
  }

  const handleSaveAssignments = async () => {
    if (!activeRoleForAssignment) return
    setIsSavingAssignments(true)
    try {
      await organizationService.setRoleAssignments({
        organizationId,
        roleId: activeRoleForAssignment.id,
        userIds: Array.from(assignmentSelection.users),
        invitationIds: Array.from(assignmentSelection.invitations)
      })
      await refreshStructure('structureAssignmentsSaved')
      setActiveRoleForAssignment(null)
    } catch (err) {
      console.error('Failed to save assignments:', err)
      notifyError(errorsT('structureAssignmentFailed'))
    } finally {
      setIsSavingAssignments(false)
    }
  }

  const closeAssignmentManager = () => {
    setActiveRoleForAssignment(null)
  }

  const handleWizardSuccess = async () => {
    // ウィザード完了後にロール一覧を再読み込み
    await refreshStructure('structureRolesSeeded')
    setShowWizard(false)
  }

  const handleOpenWizard = () => {
    setShowWizard(true)
    setLocalError(null)
    onError?.(null)
  }

  const renderAssignments = (roleId: string) => {
    const relatedAssignments = assignments.filter(item => item.role_id === roleId)
    if (relatedAssignments.length === 0) {
      return <p className="text-sm text-text-muted">{t('unassigned')}</p>
    }

    return (
      <ul className="space-y-1">
        {relatedAssignments.map(assignment => {
          const user = assignment.user_profile
          const invite = assignment.organization_invitation
          if (user) {
            return (
              <li key={assignment.id} className="text-sm text-text-secondary">
                <span className="font-medium">{user.full_name || user.email}</span>
                <span className="ml-2 text-xs text-text-muted">{user.role}</span>
              </li>
            )
          }
          if (invite) {
            return (
              <li key={assignment.id} className="text-sm text-text-muted flex items-center gap-2">
                <span>{invite.email}</span>
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] text-yellow-700">
                  {t('pendingInvitation')}
                </span>
              </li>
            )
          }
          return null
        })}
      </ul>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-surface shadow px-4 py-6 sm:rounded-lg sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-surface-elevated" />
          <div className="h-4 w-full rounded bg-surface-elevated" />
          <div className="h-28 w-full rounded bg-surface-elevated" />
        </div>
      </div>
    )
  }

  return (
    <section className="bg-surface shadow px-4 py-6 sm:rounded-lg sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-primary">{t('title')}</h3>
          <p className="mt-1 text-sm text-text-muted">{t('description')}</p>
        </div>
        <button
          type="button"
          onClick={handleCreateRole}
          className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          {t('actions.create')}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-indigo-700">{t('summary.title')}</h4>
            <p className="mt-1 text-xs text-indigo-600">{t('summary.description')}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              roleSummary.isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {summaryStatusLabel}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-indigo-600">
          <span>{summaryStatusDescription}</span>
          <span className="font-semibold">{roleSummary.completionRatio}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${roleSummary.completionRatio}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summaryItems.map(item => (
            <div key={item.key} className="rounded-xl bg-surface/80 p-4 shadow-sm">
              <p className="text-xs font-medium text-indigo-600">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-indigo-900">{item.value}</p>
              <p className="mt-1 text-xs text-indigo-600">{item.helper}</p>
              {item.subHelper && (
                <p className="text-[11px] text-indigo-500">{item.subHelper}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {localError && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{localError}</div>
      )}

      {roles.length === 0 && !showRoleForm ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
          <h4 className="text-base font-semibold text-text-secondary">{t('empty.title')}</h4>
          <p className="mt-2 text-sm text-text-muted">{t('empty.description')}</p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleOpenWizard}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              {t('wizard.cta.openWizard')}
            </button>
            <span className="text-sm text-text-muted">または</span>
            <button
              type="button"
              onClick={handleCreateRole}
              className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
            >
              {t('empty.action')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {roles.map(role => (
            <div key={role.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-base font-semibold text-text-primary">{role.name}</h4>
                    {role.is_required && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {t('requiredBadge')}
                      </span>
                    )}
                  </div>
                  {role.name_en && (
                    <p className="text-sm text-text-muted">{role.name_en}</p>
                  )}
                  {role.description && (
                    <p className="text-sm text-text-secondary">{role.description}</p>
                  )}
                  {role.responsibilities && role.responsibilities.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {role.responsibilities.map((item, index) => (
                        <li key={`${role.id}-resp-${index}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditRole(role)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
                  >
                    {t('actions.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(role)}
                    className="rounded-md border border-transparent bg-surface px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    {t('actions.delete')}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h5 className="text-sm font-medium text-text-secondary">{t('assignedTitle')}</h5>
                  <div className="mt-2">
                    {renderAssignments(role.id)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAssignmentManager(role)}
                  className="self-start rounded-md border border-transparent bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
                >
                  {t('actions.assign')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRoleForm && (
        <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-6">
          <form onSubmit={handleSubmitRole} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-text-primary">
                {editingRole ? t('roleForm.titleEdit') : t('roleForm.titleCreate')}
              </h4>
              <button
                type="button"
                onClick={resetRoleForm}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {t('actions.cancel')}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('roleForm.fields.key')}</label>
                <input
                  type="text"
                  value={roleForm.key}
                  onChange={e => handleRoleFormChange('key', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="isms_manager"
                  required
                />
                <p className="mt-1 text-xs text-text-muted">{t('roleForm.help.key')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('roleForm.fields.name')}</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={e => handleRoleFormChange('name', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder={t('roleForm.placeholders.name')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('roleForm.fields.nameEn')}</label>
                <input
                  type="text"
                  value={roleForm.nameEn}
                  onChange={e => handleRoleFormChange('nameEn', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Riscala AI for ISMS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">{t('roleForm.fields.displayOrder')}</label>
                <input
                  type="number"
                  value={roleForm.displayOrder}
                  onChange={e => handleRoleFormChange('displayOrder', Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">{t('roleForm.fields.description')}</label>
              <textarea
                value={roleForm.description}
                onChange={e => handleRoleFormChange('description', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">{t('roleForm.fields.responsibilities')}</label>
              <textarea
                value={roleForm.responsibilities}
                onChange={e => handleRoleFormChange('responsibilities', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={t('roleForm.placeholders.responsibilities')}
              />
              <p className="mt-1 text-xs text-text-muted">{t('roleForm.help.responsibilities')}</p>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={roleForm.isRequired}
                onChange={e => handleRoleFormChange('isRequired', e.target.checked)}
                className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              {t('roleForm.fields.isRequired')}
            </label>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetRoleForm}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSavingRole}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSavingRole ? t('actions.saving') : t('actions.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeRoleForAssignment && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold text-text-primary">{t('assignment.title', { name: activeRoleForAssignment.name })}</h4>
                <p className="mt-1 text-sm text-text-secondary">{t('assignment.description')}</p>
              </div>
              <button onClick={closeAssignmentManager} className="text-text-muted hover:text-text-secondary">
                <span className="sr-only">close</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <h5 className="text-sm font-medium text-text-secondary">{t('assignment.members')}</h5>
                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                  {users.length === 0 ? (
                    <p className="text-sm text-text-muted">{t('assignment.noMembers')}</p>
                  ) : (
                    users.map(user => (
                      <label key={user.id} className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={assignmentSelection.users.has(user.id)}
                          onChange={() => toggleAssignment('users', user.id)}
                          className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          <span className="font-medium">{user.full_name || user.email}</span>
                          <span className="ml-1 text-xs text-text-muted">{user.role}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium text-text-secondary">{t('assignment.invitations')}</h5>
                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                  {invitations.length === 0 ? (
                    <p className="text-sm text-text-muted">{t('assignment.noInvitations')}</p>
                  ) : (
                    invitations.map(invitation => (
                      <label key={invitation.id} className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={assignmentSelection.invitations.has(invitation.id)}
                          onChange={() => toggleAssignment('invitations', invitation.id)}
                          className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          <span className="font-medium">{invitation.email}</span>
                          <span className="ml-1 text-xs text-text-muted">{invitation.role}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAssignmentManager}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={isSavingAssignments}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSavingAssignments ? t('assignment.saving') : t('assignment.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 推奨ロール一括登録ウィザード */}
      <RoleSeedWizardDialog
        organizationId={organizationId}
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={handleWizardSuccess}
        onError={notifyError}
        existingRoleCount={roles.length}
      />
    </section>
  )
}
