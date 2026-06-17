'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useTranslations } from 'next-intl'
import { OrganizationService } from '@/lib/services/organization'
import { UserService } from '@/lib/services/user'
import { useToast } from '@/components/ui/ToastProvider'
import ErrorBoundary from '@/components/ErrorBoundary'

interface MemberInfo {
  id: string
  full_name: string | null
  email: string
  is_ciso: boolean
}

interface RoleFlagMember {
  id: string
  full_name: string | null
  email: string
  is_security_manager: boolean
  is_audit_committee: boolean
  is_isms_promoter: boolean
}

type RoleFlagKey = 'is_security_manager' | 'is_audit_committee' | 'is_isms_promoter'

interface SnapshotInfo {
  id: string
  snapshot_name: string
  created_by: string | null
  created_at: string
}

interface DiffResult {
  added: Record<string, unknown>[]
  removed: Record<string, unknown>[]
  changed: { key: string; before: unknown; after: unknown }[]
}

export default function StructureManagementPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('settings.structure')
  const { pushToast } = useToast()

  const orgService = useMemo(() => new OrganizationService(), [])
  const userService = useMemo(() => new UserService(), [])

  const [isLoading, setIsLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [currentCisoId, setCurrentCisoId] = useState<string | null>(null)
  const [selectedCisoId, setSelectedCisoId] = useState<string>('')
  const [isCisoSaving, setIsCisoSaving] = useState(false)

  // Bulk role assignment state
  const [roleFlagMembers, setRoleFlagMembers] = useState<RoleFlagMember[]>([])
  const [selectedRole, setSelectedRole] = useState<RoleFlagKey>('is_security_manager')
  const [checkedMemberIds, setCheckedMemberIds] = useState<Set<string>>(new Set())
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [snapshotName, setSnapshotName] = useState('')
  const [isSnapshotSaving, setIsSnapshotSaving] = useState(false)

  const [compareIds, setCompareIds] = useState<[string | null, string | null]>([null, null])
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [isComparing, setIsComparing] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [org, user] = await Promise.all([
        orgService.getCurrentOrganization(),
        userService.getCurrentUser()
      ])

      if (!org || !user) {
        setError(t('loadError'))
        setIsLoading(false)
        return
      }

      // Permission check: only org_admin / system_operator
      if (!['org_admin', 'system_operator'].includes(user.role)) {
        setError('Permission denied')
        setIsLoading(false)
        return
      }

      setOrganizationId(org.id)

      const [membersList, ciso, snapshotsList, roleFlagMembersList] = await Promise.all([
        orgService.getOrganizationMembers(org.id),
        orgService.getCurrentCiso(org.id),
        orgService.getStructureSnapshots(org.id),
        orgService.getMembersWithRoleFlags(org.id)
      ])

      setMembers(membersList)
      setCurrentCisoId(ciso?.id ?? null)
      setSelectedCisoId(ciso?.id ?? '')
      setSnapshots(snapshotsList)
      setRoleFlagMembers(roleFlagMembersList)
    } catch (err) {
      console.error('Failed to load structure data:', err)
      setError(t('loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [orgService, userService, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sync checked members when role selection changes or role flag members load
  useEffect(() => {
    const newChecked = new Set<string>()
    for (const m of roleFlagMembers) {
      if (m[selectedRole]) {
        newChecked.add(m.id)
      }
    }
    setCheckedMemberIds(newChecked)
  }, [selectedRole, roleFlagMembers])

  const handleCisoChange = async () => {
    if (!organizationId) return

    setIsCisoSaving(true)
    try {
      if (selectedCisoId === '') {
        await orgService.clearCiso(organizationId)
        setCurrentCisoId(null)
        pushToast({ message: t('cisoCleared'), variant: 'success' })
      } else {
        await orgService.setCiso(organizationId, selectedCisoId)
        setCurrentCisoId(selectedCisoId)
        pushToast({ message: t('cisoUpdated'), variant: 'success' })
      }
    } catch (err) {
      console.error('Failed to update CISO:', err)
      pushToast({ message: t('saveError'), variant: 'error' })
    } finally {
      setIsCisoSaving(false)
    }
  }

  const handleToggleMember = (memberId: string) => {
    setCheckedMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setCheckedMemberIds(new Set(roleFlagMembers.map(m => m.id)))
  }

  const handleDeselectAll = () => {
    setCheckedMemberIds(new Set())
  }

  const handleBulkAssign = async () => {
    if (!organizationId) return

    setIsBulkSaving(true)
    try {
      await orgService.bulkUpdateRoleFlags(
        organizationId,
        selectedRole,
        Array.from(checkedMemberIds)
      )
      pushToast({ message: t('assignSuccess'), variant: 'success' })

      // Reload role flag members
      const updated = await orgService.getMembersWithRoleFlags(organizationId)
      setRoleFlagMembers(updated)
    } catch (err) {
      console.error('Failed to bulk assign role flags:', err)
      pushToast({ message: t('assignError'), variant: 'error' })
    } finally {
      setIsBulkSaving(false)
    }
  }

  const handleSaveSnapshot = async () => {
    if (!organizationId || !snapshotName.trim()) return

    setIsSnapshotSaving(true)
    try {
      await orgService.createStructureSnapshot(organizationId, snapshotName.trim())
      pushToast({ message: t('saveSuccess'), variant: 'success' })
      setSnapshotName('')

      // Reload snapshots
      const updatedSnapshots = await orgService.getStructureSnapshots(organizationId)
      setSnapshots(updatedSnapshots)
    } catch (err) {
      console.error('Failed to save snapshot:', err)
      pushToast({ message: t('saveError'), variant: 'error' })
    } finally {
      setIsSnapshotSaving(false)
    }
  }

  const toggleCompareSelection = (snapshotId: string) => {
    setCompareIds(prev => {
      if (prev[0] === snapshotId) return [null, prev[1]]
      if (prev[1] === snapshotId) return [prev[0], null]
      if (prev[0] === null) return [snapshotId, prev[1]]
      if (prev[1] === null) return [prev[0], snapshotId]
      // Both already selected, replace the second
      return [prev[0], snapshotId]
    })
    setDiffResult(null)
  }

  const handleCompare = async () => {
    const [id1, id2] = compareIds
    if (!id1 || !id2) return

    setIsComparing(true)
    try {
      const result = await orgService.compareSnapshots(id1, id2, organizationId!)
      setDiffResult(result)
    } catch (err) {
      console.error('Failed to compare snapshots:', err)
      pushToast({ message: t('loadError'), variant: 'error' })
    } finally {
      setIsComparing(false)
    }
  }

  // Check if bulk assignment state has changed from the saved state
  const isBulkDirty = (() => {
    const currentFlagSet = new Set<string>()
    for (const m of roleFlagMembers) {
      if (m[selectedRole]) {
        currentFlagSet.add(m.id)
      }
    }
    if (currentFlagSet.size !== checkedMemberIds.size) return true
    for (const id of checkedMemberIds) {
      if (!currentFlagSet.has(id)) return true
    }
    return false
  })()

  const roleOptions: { value: RoleFlagKey; labelKey: string }[] = [
    { value: 'is_security_manager', labelKey: 'securityManager' },
    { value: 'is_audit_committee', labelKey: 'auditCommittee' },
    { value: 'is_isms_promoter', labelKey: 'ismsPromoter' },
  ]

  const currentCisoMember = members.find(m => m.id === currentCisoId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="max-w-4xl space-y-8">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-text-primary sm:text-3xl sm:truncate">
            {t('title')}
          </h2>
        </div>

        {/* CISO Selection */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow">
          <h3 className="text-lg font-semibold text-text-primary mb-4">{t('ciso')}</h3>

          {currentCisoMember ? (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-text-muted">{t('currentCiso')}:</span>
              <span className="text-sm font-semibold text-text-primary">
                {currentCisoMember.full_name ?? currentCisoMember.email}
              </span>
            </div>
          ) : (
            <div className="mb-4">
              <span className="text-sm text-text-muted">{t('noCiso')}</span>
            </div>
          )}

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="ciso-select" className="block text-sm font-medium text-text-secondary mb-1">
                {t('selectCiso')}
              </label>
              <select
                id="ciso-select"
                className="block w-full rounded-md border border-border bg-surface py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                value={selectedCisoId}
                onChange={e => setSelectedCisoId(e.target.value)}
              >
                <option value="">-- {t('noCiso')} --</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.full_name ?? member.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleCisoChange}
              disabled={isCisoSaving || selectedCisoId === (currentCisoId ?? '')}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCisoSaving ? '...' : t('cisoUpdated').split(' ')[0]}
            </button>
          </div>
        </section>

        {/* Bulk Role Assignment */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow" data-testid="bulk-role-assignment">
          <h3 className="text-lg font-semibold text-text-primary mb-4">{t('bulkAssignment')}</h3>

          <div className="mb-4">
            <label htmlFor="role-select" className="block text-sm font-medium text-text-secondary mb-1">
              {t('selectRole')}
            </label>
            <select
              id="role-select"
              className="block w-full max-w-xs rounded-md border border-border bg-surface py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as RoleFlagKey)}
            >
              {roleOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {roleFlagMembers.length === 0 ? (
            <p className="text-sm text-text-muted">{t('noMembers')}</p>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {roleFlagMembers.map(member => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-indigo-200 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={checkedMemberIds.has(member.id)}
                      onChange={() => handleToggleMember(member.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary block truncate">
                        {member.full_name ?? member.email}
                      </span>
                      {member.full_name && (
                        <span className="text-xs text-text-muted block truncate">
                          {member.email}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    {t('selectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary shadow-sm hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    {t('deselectAll')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleBulkAssign}
                  disabled={isBulkSaving || !isBulkDirty}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkSaving ? '...' : t('assignSelected', { count: checkedMemberIds.size })}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Snapshot Save */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow">
          <h3 className="text-lg font-semibold text-text-primary mb-4">{t('snapshot')}</h3>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="snapshot-name" className="block text-sm font-medium text-text-secondary mb-1">
                {t('snapshotName')}
              </label>
              <input
                id="snapshot-name"
                type="text"
                className="block w-full rounded-md border border-border py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
                placeholder={t('snapshotNamePlaceholder')}
              />
            </div>
            <button
              type="button"
              onClick={handleSaveSnapshot}
              disabled={isSnapshotSaving || !snapshotName.trim()}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSnapshotSaving ? '...' : t('saveSnapshot')}
            </button>
          </div>
        </section>

        {/* Snapshot History */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow">
          <h3 className="text-lg font-semibold text-text-primary mb-4">{t('snapshotHistory')}</h3>

          {snapshots.length === 0 ? (
            <p className="text-sm text-text-muted">{t('noSnapshots')}</p>
          ) : (
            <>
              <div className="mb-4 text-xs text-text-muted">{t('selectForCompare')}</div>
              <div className="space-y-3">
                {snapshots.map(snap => {
                  const isSelected = compareIds.includes(snap.id)
                  return (
                    <div
                      key={snap.id}
                      className={`flex items-center justify-between rounded-lg border p-4 transition cursor-pointer ${
                        isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-border hover:border-indigo-200'
                      }`}
                      onClick={() => toggleCompareSelection(snap.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleCompareSelection(snap.id) }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-primary">{snap.snapshot_name}</p>
                        <p className="text-xs text-text-muted">
                          {t('createdAt')}: {new Date(snap.created_at).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompareSelection(snap.id)}
                          onClick={e => e.stopPropagation()}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {compareIds[0] && compareIds[1] && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCompare}
                    disabled={isComparing}
                    className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isComparing ? '...' : t('compare')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Diff Result */}
        {diffResult && (
          <section className="rounded-2xl border border-border bg-surface p-6 shadow">
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t('comparisonResult')}</h3>

            {diffResult.added.length === 0 && diffResult.removed.length === 0 && diffResult.changed.length === 0 ? (
              <p className="text-sm text-text-muted">{t('noChanges')}</p>
            ) : (
              <div className="space-y-4">
                {/* Added */}
                {diffResult.added.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-700 mb-2">{t('added')} ({diffResult.added.length})</h4>
                    <div className="space-y-1">
                      {diffResult.added.map((item, idx) => (
                        <div key={idx} className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                          <span className="font-medium">{(item as Record<string, unknown>).type as string}</span>
                          {': '}
                          {(item as Record<string, unknown>).name as string ?? (item as Record<string, unknown>).id as string}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed */}
                {diffResult.removed.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 mb-2">{t('removed')} ({diffResult.removed.length})</h4>
                    <div className="space-y-1">
                      {diffResult.removed.map((item, idx) => (
                        <div key={idx} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                          <span className="font-medium">{(item as Record<string, unknown>).type as string}</span>
                          {': '}
                          {(item as Record<string, unknown>).name as string ?? (item as Record<string, unknown>).id as string}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changed */}
                {diffResult.changed.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-700 mb-2">{t('changed')} ({diffResult.changed.length})</h4>
                    <div className="space-y-1">
                      {diffResult.changed.map((item, idx) => (
                        <div key={idx} className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                          <span className="font-medium">{item.key}</span>
                          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-text-muted">Before: </span>
                              {typeof item.before === 'object'
                                ? JSON.stringify(item.before)
                                : String(item.before ?? '-')}
                            </div>
                            <div>
                              <span className="text-text-muted">After: </span>
                              {typeof item.after === 'object'
                                ? JSON.stringify(item.after)
                                : String(item.after ?? '-')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </ErrorBoundary>
  )
}
