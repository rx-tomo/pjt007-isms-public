'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { UserService, type UserRole } from '@/lib/services/user'
import { OrganizationService, type ProjectRole, type ProjectAssignmentDetails } from '@/lib/services/organization'
import { PermissionService, type PermissionUpdate } from '@/lib/services/permissions'
import { DepartmentScopeService } from '@/lib/services/departmentScope'
import { buildDepartmentOptions } from '@/lib/utils/departments'
import { evaluateDepartmentScope } from '@/lib/utils/departmentScope'
import type { Database } from '@/types/database.types'
import { DEPARTMENT_UNASSIGNED_VALUE } from '@/lib/constants/departments'
import { useToast } from '@/components/ui/ToastProvider'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type OrganizationDepartment = Database['public']['Tables']['organization_departments']['Row']

export default function UsersManagementPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.users')
  const commonT = useTranslations('common')
  const router = useRouter()
  const userService = useMemo(() => new UserService(), [])
  const orgService = useMemo(() => new OrganizationService(), [])
  const permissionService = useMemo(() => new PermissionService(), [])
  const departmentScopeService = useMemo(() => new DepartmentScopeService(), [])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [organization, setOrganization] = useState<any>(null)
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([])
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignmentDetails[]>([])
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([])
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const { pushToast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user' as UserRole,
    projectRoleIds: [] as string[]
  })
  const [isInviting, setIsInviting] = useState(false)
  const [permissionModalUser, setPermissionModalUser] = useState<UserProfile | null>(null)
  const [permissionForm, setPermissionForm] = useState<PermissionUpdate>(
    () => permissionService.getDefaultPermissions()
  )
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false)
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)
  const [projectRoleSelection, setProjectRoleSelection] = useState<Set<string>>(new Set())
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')
  const [pendingInvitations, setPendingInvitations] = useState<Array<{
    id: string
    email: string
    role: UserRole
    invitedAt: string
    expiresAt: string
    invitedBy?: string | null
  }>>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null)
  const [departmentScopeSelection, setDepartmentScopeSelection] = useState<Set<string>>(new Set())

  const refreshProjectStructure = useCallback(
    async (orgId: string) => {
      try {
        const structure = await orgService.getProjectStructure(orgId)
        setProjectRoles(structure.roles)
        setProjectAssignments(structure.assignments)
      } catch (err) {
        console.error('Failed to load project structure', err)
      }
    },
    [orgService]
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const user = await userService.getCurrentUser()

      if (!user) {
        router.push(`/${locale}/auth/login`)
        return
      }

      if (!['org_admin', 'system_operator'].includes(user.role)) {
        router.push(`/${locale}/home`)
        return
      }

      const org = await orgService.getCurrentOrganization()
      if (!org) {
        router.push(`/${locale}/auth/login`)
        return
      }

      setCurrentUser(user)
      setOrganization(org)

      const [usersList, structure, departmentRows] = await Promise.all([
        userService.getOrganizationUsersScoped(org.id, user.id),
        orgService.getProjectStructure(org.id),
        orgService.getOrganizationDepartments(org.id)
      ])

      setUsers(usersList)
      setProjectRoles(structure.roles)
      setProjectAssignments(structure.assignments)
      setDepartments(departmentRows)
      try {
        setInvitesLoading(true)
        const response = await fetch('/api/invitations', { cache: 'no-store' })
        const body = await response.json()
        if (response.ok && Array.isArray(body.invitations)) {
          setPendingInvitations(
            body.invitations.map((inv: any) => ({
              id: inv.id,
              email: inv.email,
              role: inv.role,
              invitedAt: inv.created_at,
              expiresAt: inv.expires_at,
              invitedBy: inv.invited_by ?? null
            }))
          )
        } else {
          setPendingInvitations([])
        }
      } catch (inviteError) {
        console.error('Error loading invitations:', inviteError)
        setPendingInvitations([])
      } finally {
        setInvitesLoading(false)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      pushToast({ message: t('errors.loadFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsLoading(false)
    }
  }, [locale, orgService, router, t, userService, pushToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const ensurePlanCapacity = useCallback(
    async (orgId: string) => {
      try {
        await fetch('/api/billing/ensure-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId })
        })
      } catch (error) {
        console.error('Failed to sync seat usage', error)
      }
    },
    []
  )

  const handleCancelInvitation = useCallback(
    async (invitationId: string) => {
      try {
        const response = await fetch('/api/invitations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: invitationId })
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          pushToast({ message: body?.error || t('invitations.messages.cancelError'), variant: 'error', duration: 0 })
          return
        }
        setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId))
        pushToast({ message: t('invitations.messages.cancelSuccess'), variant: 'success' })
      } catch (inviteError) {
        console.error('Failed to cancel invitation', inviteError)
        pushToast({ message: t('invitations.messages.cancelError'), variant: 'error', duration: 0 })
      }
    },
    [t, pushToast]
  )

  const handleResendInvitation = useCallback(
    async (invitationId: string) => {
      setResendingInvitationId(invitationId)
      try {
        const response = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitationId })
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          pushToast({
            message: body?.error || t('invitations.messages.resendError'),
            variant: 'error',
            duration: 0
          })
          return
        }
        // Update the expiry if it was extended
        if (body.expiresAt) {
          setPendingInvitations((prev) =>
            prev.map((inv) =>
              inv.id === invitationId ? { ...inv, expiresAt: body.expiresAt } : inv
            )
          )
        }
        pushToast({ message: t('invitations.messages.resendSuccess'), variant: 'success' })
      } catch (resendError) {
        console.error('Failed to resend invitation', resendError)
        pushToast({
          message: t('invitations.messages.resendError'),
          variant: 'error',
          duration: 0
        })
      } finally {
        setResendingInvitationId(null)
      }
    },
    [t, pushToast]
  )

  const permissionOptions = useMemo(
    () => [
      {
        key: 'can_manage_documents' as const,
        title: t('permissions.documents.title'),
        description: t('permissions.documents.description')
      },
      {
        key: 'can_manage_risks' as const,
        title: t('permissions.risks.title'),
        description: t('permissions.risks.description')
      },
      {
        key: 'can_manage_tasks' as const,
        title: t('permissions.tasks.title'),
        description: t('permissions.tasks.description')
      },
      {
        key: 'can_manage_audit' as const,
        title: t('permissions.audit.title'),
        description: t('permissions.audit.description')
      },
      {
        key: 'can_manage_assets' as const,
        title: t('permissions.assets.title'),
        description: t('permissions.assets.description')
      },
      {
        key: 'can_manage_controls' as const,
        title: t('permissions.controls.title'),
        description: t('permissions.controls.description')
      }
    ],
    [t]
  )

  const resetPermissionForm = useCallback(() => {
    setPermissionForm(permissionService.getDefaultPermissions())
    setProjectRoleSelection(new Set())
    setDepartmentScopeSelection(new Set())
  }, [permissionService])

  const departmentOptions = useMemo(() => buildDepartmentOptions(departments), [departments])

  const activeSystemOperatorCount = useMemo(
    () => users.filter(user => user.role === 'system_operator' && user.is_active).length,
    [users]
  )

  const isLastSystemOperator = useCallback(
    (user: UserProfile | null) =>
      Boolean(
        user &&
        user.role === 'system_operator' &&
        user.is_active &&
        activeSystemOperatorCount <= 1
      ),
    [activeSystemOperatorCount]
  )

  const departmentNameToId = useMemo(() => {
    const map = new Map<string, string>()
    departments.forEach(dept => {
      map.set(dept.name, dept.id)
    })
    if (currentUser?.department && !map.has(currentUser.department)) {
      map.set(currentUser.department, currentUser.department)
    }
    return map
  }, [currentUser?.department, departments])

  const departmentScope = useMemo(
    () =>
      evaluateDepartmentScope({
        role: currentUser?.role ?? null,
        departmentName: currentUser?.department ?? null,
        departmentNameToId
      }),
    [currentUser?.department, currentUser?.role, departmentNameToId]
  )

  const appliedDepartmentFilter = departmentScope.enforcedFilterValue ?? departmentFilter

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (!appliedDepartmentFilter) {
        return true
      }

      const userDepartmentId = user.department
        ? departmentNameToId.get(user.department) ?? null
        : null

      if (appliedDepartmentFilter === DEPARTMENT_UNASSIGNED_VALUE) {
        return !userDepartmentId
      }

      return userDepartmentId === appliedDepartmentFilter
    })
  }, [appliedDepartmentFilter, departmentNameToId, users])

  const activeDepartmentLabel = useMemo(() => {
    if (!appliedDepartmentFilter) return ''
    if (appliedDepartmentFilter === DEPARTMENT_UNASSIGNED_VALUE) {
      return t('filters.department.unassigned')
    }
    const match = departmentOptions.find(option => option.id === appliedDepartmentFilter)
    return match?.name ?? ''
  }, [appliedDepartmentFilter, departmentOptions, t])

  const enforcedDepartmentLabel = useMemo(() => {
    if (!departmentScope.enforcedFilterValue) {
      return ''
    }
    if (departmentScope.enforcedFilterValue === DEPARTMENT_UNASSIGNED_VALUE) {
      return t('filters.department.unassigned')
    }
    const match = departmentOptions.find(option => option.id === departmentScope.enforcedFilterValue)
    return match?.name ?? departmentScope.enforcedFilterValue
  }, [departmentOptions, departmentScope.enforcedFilterValue, t])

  const isSelfEdit = permissionModalUser && currentUser && permissionModalUser.id === currentUser.id
  const isOrgAdminSelf = Boolean(isSelfEdit && currentUser?.role === 'org_admin')

  const roleCards = useMemo(() => {
    if (!permissionModalUser) return []
    const entries: UserRole[] = ['system_operator', 'org_admin', 'auditor', 'approver', 'user']
    return entries.map((key) => {
      const label = t(`roles.${key}` as const)
      const description = t(`permissions.roleDescriptions.${key}` as const)
      let disabled = false
      let disabledReason: string | null = null

      if (key === 'system_operator' && currentUser?.role !== 'super_admin') {
        disabled = true
        disabledReason = t('permissions.rolesSection.systemOperatorDisabled')
      }

      if (isOrgAdminSelf && key !== 'org_admin') {
        disabled = true
        disabledReason = t('permissions.rolesSection.selfOrgAdminLocked')
      }

      if (isLastSystemOperator(permissionModalUser) && key !== 'system_operator') {
        disabled = true
        disabledReason = t('permissions.rolesSection.systemOperatorLastGuard')
      }

      return { key, label, description, disabled, disabledReason }
    })
  }, [currentUser, isOrgAdminSelf, permissionModalUser, t, isLastSystemOperator])

  const closePermissionModal = useCallback(() => {
    setPermissionModalUser(null)
    resetPermissionForm()
    setSelectedRole('user')
  }, [resetPermissionForm])

  const openPermissionModal = useCallback(
    async (user: UserProfile) => {
      setPermissionModalUser(user)
      setSelectedRole((user.role as UserRole) || 'user')
      setIsPermissionsLoading(true)
      try {
        if (!organization) throw new Error('organization not loaded')
        const permissions = await permissionService.getUserPermissions(organization.id, user.id)
        if (permissions) {
          const { id: _id, organization_id: _org, user_id: _user, created_at: _c, updated_at: _u, ...rest } = permissions
          setPermissionForm(rest)
        } else {
          resetPermissionForm()
        }

        const scopeIds = await departmentScopeService.getUserDepartmentIds(organization.id, user.id)
        setDepartmentScopeSelection(new Set(scopeIds))

        const assignedRoles = projectAssignments
          .filter(assignment => assignment.user_id === user.id)
          .map(assignment => assignment.role_id)
        setProjectRoleSelection(new Set(assignedRoles))
      } catch (err) {
        console.error('Failed to load permissions', err)
        pushToast({ message: t('errors.permissionLoadFailed'), variant: 'error', duration: 0 })
      } finally {
        setIsPermissionsLoading(false)
      }
    },
    [departmentScopeService, organization, permissionService, projectAssignments, resetPermissionForm, t, pushToast]
  )

  const handlePermissionChange = useCallback(
    (key: keyof PermissionUpdate, value: boolean) => {
      setPermissionForm((prev) => ({
        ...prev,
        [key]: value
      }))
    },
    []
  )

  const handleProjectRoleToggle = useCallback((roleId: string) => {
    setProjectRoleSelection(prev => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
      } else {
        next.add(roleId)
      }
      return next
    })
  }, [])

  const handleDepartmentScopeToggle = useCallback((departmentId: string) => {
    setDepartmentScopeSelection(prev => {
      const next = new Set(prev)
      if (next.has(departmentId)) {
        next.delete(departmentId)
      } else {
        next.add(departmentId)
      }
      return next
    })
  }, [])

  const handleSavePermissions = useCallback(async () => {
    if (!organization || !permissionModalUser) return

    setIsSavingPermissions(true)

    try {
      if (selectedRole !== permissionModalUser.role) {
        const response = await fetch(`/api/organizations/${organization.id}/members/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: permissionModalUser.id, role: selectedRole })
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(body?.error || t('errors.permissionSaveFailed'))
        }
        setUsers((prev) =>
          prev.map((user) =>
            user.id === permissionModalUser.id
              ? { ...user, role: selectedRole }
              : user
          )
        )
        setPermissionModalUser((prev) => (prev ? { ...prev, role: selectedRole } : prev))
      }

      await permissionService.upsertUserPermissions(
        organization.id,
        permissionModalUser.id,
        permissionForm
      )

      await departmentScopeService.updateUserDepartmentScopes({
        organizationId: organization.id,
        userId: permissionModalUser.id,
        departmentIds: Array.from(departmentScopeSelection)
      })

      await orgService.syncProjectAssignments({
        organizationId: organization.id,
        userId: permissionModalUser.id,
        roleIds: Array.from(projectRoleSelection)
      })

      await refreshProjectStructure(organization.id)

      pushToast({
        message: t('success.permissionsUpdated', {
          name: permissionModalUser.full_name || permissionModalUser.email
        }),
        variant: 'success'
      })
      closePermissionModal()
    } catch (err) {
      console.error('Failed to save permissions', err)
      pushToast({ message: t('errors.permissionSaveFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsSavingPermissions(false)
    }
  }, [
    departmentScopeSelection,
    departmentScopeService,
    organization,
    permissionModalUser,
    permissionForm,
    permissionService,
    orgService,
    projectRoleSelection,
    refreshProjectStructure,
    t,
    closePermissionModal,
    selectedRole,
    pushToast
  ])

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !organization) {
      return
    }

    const isSystemOperatorInvite = inviteForm.role === 'system_operator'
    const canElevate = currentUser.role === 'system_operator'
    if (isSystemOperatorInvite && !canElevate) {
      pushToast({ message: t('invite.errors.systemOperatorOnly'), variant: 'error', duration: 0 })
      return
    }

    setIsInviting(true)

    try {
      const invitation = await userService.inviteUser(
        organization.id,
        inviteForm.email,
        inviteForm.role,
        currentUser.id,
        {
          organizationName: organization.name,
          invitedByName: currentUser.full_name || currentUser.email,
          locale
        }
      )

      if (inviteForm.projectRoleIds.length > 0) {
        await orgService.syncProjectAssignments({
          organizationId: organization.id,
          invitationId: invitation.id,
          roleIds: inviteForm.projectRoleIds
        })
      }

      await refreshProjectStructure(organization.id)

      pushToast({ message: t('success.invitedWithEmail', { email: inviteForm.email }), variant: 'success' })
      setPendingInvitations((prev) => [
        {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role as UserRole,
          invitedAt: invitation.created_at ?? '',
          expiresAt: invitation.expires_at ?? '',
          invitedBy: currentUser.full_name || currentUser.email
        },
        ...prev
      ])
      setShowInviteModal(false)
      setInviteForm({ email: '', role: 'user', projectRoleIds: [] })

      // リストを再読み込み
      await loadData()
      await ensurePlanCapacity(organization.id)
    } catch (err: any) {
      const message = err?.message as string | undefined
      let errorMessage = message || t('errors.inviteFailed')
      if (message?.includes('RESEND_API_KEY')) {
        errorMessage = t('errors.emailConfigMissing')
      } else if (message?.toLowerCase().includes('failed to send invitation email')) {
        errorMessage = t('errors.emailSendFailed')
      }
      pushToast({ message: errorMessage, variant: 'error', duration: 0 })
    } finally {
      setIsInviting(false)
    }
  }

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    if (userId === currentUser?.id) {
      pushToast({ message: t('errors.cannotDeactivateSelf'), variant: 'error', duration: 0 })
      return
    }

    try {
      if (!organization) throw new Error('missing organization')
      const response = await fetch(`/api/organizations/${organization.id}/members/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive })
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error || t('errors.statusChangeFailed'))
      }
      await loadData()
      if (organization) {
        await ensurePlanCapacity(organization.id)
      }
      pushToast({ message: isActive ? t('success.activated') : t('success.deactivated'), variant: 'success' })
    } catch (err: any) {
      pushToast({ message: err.message || t('errors.statusChangeFailed'), variant: 'error', duration: 0 })
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    const colors = {
      super_admin: 'bg-surface-elevated text-text-primary',
      system_operator: 'bg-purple-100 text-purple-800',
      org_admin: 'bg-blue-100 text-blue-800',
      user: 'bg-surface-elevated text-text-primary',
      auditor: 'bg-yellow-100 text-yellow-800',
      approver: 'bg-green-100 text-green-800'
    }
    return colors[role] || 'bg-surface-elevated text-text-primary'
  }

  const getUserProjectRoles = useCallback(
    (userId: string) => {
      const assignedIds = projectAssignments
        .filter(assignment => assignment.user_id === userId)
        .map(assignment => assignment.role_id)
      const names = projectRoles
        .filter(role => assignedIds.includes(role.id))
        .map(role => role.name)
      return names
    },
    [projectAssignments, projectRoles]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
      <div>
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {t('description', { count: users.length })}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              onClick={() => {
                setInviteForm({ email: '', role: 'user', projectRoleIds: [] })
                setShowInviteModal(true)
              }}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
            >
              {t('actions.invite')}
            </button>
          </div>
        </div>

        {['system_operator', 'org_admin'].includes(currentUser?.role) && (
          <div className="mt-6 rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-secondary">{t('invitations.title')}</p>
                  <p className="text-xs text-text-muted">{t('invitations.subtitle')}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {pendingInvitations.length} {t('invitations.badge')}
                </span>
              </div>
            </div>
            <div className="px-4 py-4 sm:px-6">
              {invitesLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : pendingInvitations.length === 0 ? (
                <p className="text-sm text-text-muted">{t('invitations.empty')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {pendingInvitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{invitation.email}</p>
                        <p className="text-xs text-text-muted">
                          {t('invitations.labels.role', { role: t(`roles.${invitation.role}` as const) })}
                        </p>
                        <p className="text-xs text-text-muted">
                          {t('invitations.labels.invitedAt', { date: new Date(invitation.invitedAt).toLocaleString(locale) })}
                        </p>
                        <p className="text-xs text-amber-600">
                          {t('invitations.labels.expiresAt', { date: new Date(invitation.expiresAt).toLocaleString(locale) })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText(invitation.email).catch(() => null)
                            }
                          }}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          {t('invitations.actions.copy')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResendInvitation(invitation.id)}
                          disabled={resendingInvitationId === invitation.id}
                          className="inline-flex items-center rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resendingInvitationId === invitation.id
                            ? t('invitations.actions.resending')
                            : t('invitations.actions.resend')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="inline-flex items-center rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          {t('invitations.actions.cancel')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <label htmlFor="users-department-filter" className="font-medium text-text-secondary">
              {t('filters.department.label')}
            </label>
            <select
              id="users-department-filter"
              value={departmentFilter}
              onChange={event => setDepartmentFilter(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-muted"
              disabled={Boolean(departmentScope.enforcedFilterValue)}
            >
              <option value="">{t('filters.department.all')}</option>
              {departmentOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {`${'　'.repeat(option.depth)}${option.name}`}
                </option>
              ))}
              <option value={DEPARTMENT_UNASSIGNED_VALUE}>{t('filters.department.unassigned')}</option>
            </select>
          </div>
          {appliedDepartmentFilter && (
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <span>{t('filters.department.active', { department: activeDepartmentLabel })}</span>
              {!departmentScope.enforcedFilterValue && (
                <button
                  type="button"
                  onClick={() => setDepartmentFilter('')}
                  className="rounded-full px-2 py-0.5 text-indigo-500 transition hover:bg-indigo-100"
                >
                  {t('filters.department.clear')}
                </button>
              )}
            </div>
          )}
        </div>

        {departmentScope.enforcedFilterValue && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <p>
              {commonT('departmentScope.locked', {
                department: enforcedDepartmentLabel || t('filters.department.unassigned')
              })}
            </p>
            {departmentScope.reason === 'missing_department' && (
              <p className="mt-1">{commonT('departmentScope.lockedMissing')}</p>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface-elevated">
                    <tr>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('table.name')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('table.email')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('table.role')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('table.department')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('table.projectRoles')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('table.status')}
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary">
                        {t('table.joinedAt')}
                      </th>
                      <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">{t('table.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-text-primary">
                          {user.full_name || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-text-secondary">
                          {user.email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                            {t(`roles.${user.role}`)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-text-secondary">
                          {user.department || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-text-secondary">
                          {(() => {
                            const roleNames = getUserProjectRoles(user.id)
                            if (roleNames.length === 0) {
                              return <span className="text-text-muted">{t('projectRoles.none')}</span>
                            }
                            return (
                              <div className="flex flex-wrap gap-2">
                                {roleNames.map(name => (
                                  <span
                                    key={`${user.id}-${name}`}
                                    className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? t('status.active') : t('status.inactive')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-text-secondary">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US') : '—'}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end gap-4">
            <button
              onClick={() => openPermissionModal(user)}
              className="text-indigo-600 hover:text-indigo-900"
            >
              {t('actions.permissions')}
            </button>
            {user.id !== currentUser?.id && (
              <button
                onClick={() => handleToggleUserStatus(user.id, !user.is_active)}
                disabled={isLastSystemOperator(user)}
                className={`${
                  user.is_active
                    ? 'text-red-600 hover:text-red-900'
                    : 'text-green-600 hover:text-green-900'
                } ${isLastSystemOperator(user) ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {user.is_active ? t('actions.deactivate') : t('actions.activate')}
              </button>
            )}
          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-sm text-text-muted">
                          {t('filters.department.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 招待モーダル */}
        {showInviteModal && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <div className="inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <form onSubmit={handleInviteUser}>
                  <div className="bg-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">
                      {t('invite.title')}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="invite-email" className="block text-sm font-medium text-text-secondary">
                          {t('invite.email')}
                        </label>
                        <input
                          type="email"
                          id="invite-email"
                          required
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-border rounded-md"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        />
                      </div>

                      <div>
                        <label htmlFor="invite-role" className="block text-sm font-medium text-text-secondary">
                          {t('invite.role')}
                        </label>
                        <select
                          id="invite-role"
                          className="mt-1 block w-full py-2 px-3 border border-border bg-surface rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={inviteForm.role}
                          onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                        >
                          <option value="user">{t('roles.user')}</option>
                          <option value="org_admin">{t('roles.org_admin')}</option>
                          <option value="auditor">{t('roles.auditor')}</option>
                          <option value="approver">{t('roles.approver')}</option>
                          {currentUser?.role === 'system_operator' && (
                            <option value="system_operator">{t('roles.system_operator')}</option>
                          )}
                        </select>
                        {currentUser?.role === 'system_operator' ? (
                          <p className="mt-1 text-xs text-text-muted">{t('invite.systemOperatorHint')}</p>
                        ) : (
                          <p className="mt-1 text-xs text-text-muted">{t('invite.systemOperatorDisabledHint')}</p>
                        )}
                      </div>
                      <div>
                        <p className="mt-4 text-sm font-medium text-text-primary">{t('invite.projectRoles')}</p>
                        <p className="mt-1 text-sm text-text-muted">{t('invite.projectRolesDescription')}</p>
                        <div className="mt-3 space-y-2">
                          {projectRoles.length === 0 ? (
                            <p className="text-sm text-text-muted">{t('projectRoles.empty')}</p>
                          ) : (
                            projectRoles.map(role => (
                              <label
                                key={role.id}
                                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2"
                              >
                                <span>
                                  <span className="block text-sm font-medium text-text-primary">{role.name}</span>
                                  {role.description && (
                                    <span className="block text-xs text-text-muted">{role.description}</span>
                                  )}
                                </span>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-indigo-600 border-border rounded focus:ring-indigo-500"
                                  checked={inviteForm.projectRoleIds.includes(role.id)}
                                  onChange={() => {
                                    setInviteForm(prev => {
                                      const next = new Set(prev.projectRoleIds)
                                      if (next.has(role.id)) {
                                        next.delete(role.id)
                                      } else {
                                        next.add(role.id)
                                      }
                                      return { ...prev, projectRoleIds: Array.from(next) }
                                    })
                                  }}
                                />
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={isInviting}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {isInviting ? t('invite.sending') : t('invite.send')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInviteModal(false)
                        setInviteForm({ email: '', role: 'user', projectRoleIds: [] })
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-border shadow-sm px-4 py-2 bg-surface text-base font-medium text-text-primary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      {t('invite.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {permissionModalUser && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <div className="inline-block align-bottom bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-surface px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-text-primary">
                    {t('permissions.modalTitle', {
                      name: permissionModalUser.full_name || permissionModalUser.email
                    })}
                  </h3>
                  <p className="mt-2 text-sm text-text-muted">{t('permissions.modalDescription')}</p>

                  <div className="mt-6">
                    {isPermissionsLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-medium text-text-primary">{t('permissions.rolesSection.title')}</h4>
                          <p className="mt-1 text-sm text-text-muted">{t('permissions.rolesSection.description')}</p>
                          {isOrgAdminSelf && (
                            <p className="mt-2 text-xs text-amber-700">
                              {t('permissions.rolesSection.selfOrgAdminLocked')}
                            </p>
                          )}
                          <div className="mt-4 space-y-3">
                            {roleCards.map((card) => (
                              <div key={card.key}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRole(card.key)}
                                  disabled={card.disabled}
                                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                                    selectedRole === card.key
                                      ? 'border-indigo-500 bg-indigo-50'
                                      : 'border-border bg-surface hover:border-indigo-200'
                                  } ${card.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-text-primary">{card.label}</p>
                                      <p className="mt-1 text-xs text-text-secondary">{card.description}</p>
                                    </div>
                                    {selectedRole === card.key && (
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                </button>
                                {card.disabled && card.disabledReason && (
                                  <p className="mt-1 text-xs text-text-muted">{card.disabledReason}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="rounded-xl border border-border bg-surface-elevated p-4">
                            <h4 className="text-sm font-semibold text-text-primary">{t('permissions.modulesTitle')}</h4>
                            <p className="mt-1 text-xs text-text-muted">{t('permissions.modulesDescription')}</p>
                            <div className="mt-4 space-y-3">
                              {permissionOptions.map((option) => (
                                <label
                                  key={option.key}
                                  className="flex items-start justify-between gap-4"
                                >
                                  <span>
                                    <span className="block text-sm font-medium text-text-primary">
                                      {option.title}
                                    </span>
                                    <span className="block text-sm text-text-muted">
                                      {option.description}
                                    </span>
                                  </span>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 border-border rounded focus:ring-indigo-500"
                                    checked={Boolean(permissionForm[option.key])}
                                    onChange={(event) =>
                                      handlePermissionChange(option.key, event.target.checked)
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-border bg-surface p-4">
                            <h4 className="text-sm font-semibold text-text-primary">{t('permissions.departmentScope.title')}</h4>
                            <p className="mt-1 text-sm text-text-muted">{t('permissions.departmentScope.description')}</p>
                            <div className="mt-3 space-y-2">
                              {departmentOptions.length === 0 ? (
                                <p className="text-sm text-text-muted">{t('permissions.departmentScope.empty')}</p>
                              ) : (
                                departmentOptions.map(option => (
                                  <label
                                    key={option.id}
                                    className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-elevated px-3 py-2"
                                  >
                                    <span>
                                      <span className="block text-sm font-medium text-text-primary">{option.name}</span>
                                      <span className="block text-xs text-text-muted">{option.path.join(' / ')}</span>
                                    </span>
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-indigo-600 border-border rounded focus:ring-indigo-500"
                                      checked={departmentScopeSelection.has(option.id)}
                                      onChange={() => handleDepartmentScopeToggle(option.id)}
                                    />
                                  </label>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-border bg-surface p-4">
                            <h4 className="text-sm font-semibold text-text-primary">{t('projectRoles.title')}</h4>
                            <p className="mt-1 text-sm text-text-muted">{t('projectRoles.description')}</p>
                            <div className="mt-3 space-y-3">
                              {projectRoles.length === 0 ? (
                                <p className="text-sm text-text-muted">{t('projectRoles.empty')}</p>
                              ) : (
                                projectRoles.map(role => (
                                  <label
                                    key={role.id}
                                    className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2"
                                  >
                                    <span>
                                      <span className="block text-sm font-medium text-text-primary">{role.name}</span>
                                      {role.description && (
                                        <span className="block text-xs text-text-muted">{role.description}</span>
                                      )}
                                    </span>
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-indigo-600 border-border rounded focus:ring-indigo-500"
                                      checked={projectRoleSelection.has(role.id)}
                                      onChange={() => handleProjectRoleToggle(role.id)}
                                    />
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    disabled={isSavingPermissions || isPermissionsLoading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isSavingPermissions ? t('permissions.saving') : t('permissions.save')}
                  </button>
                  <button
                    type="button"
                    onClick={closePermissionModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-border shadow-sm px-4 py-2 bg-surface text-base font-medium text-text-primary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {t('permissions.cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
