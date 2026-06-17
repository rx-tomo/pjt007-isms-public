'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import WindowToast from '@/components/ui/WindowToast'
import { UserService } from '@/lib/services/user'

interface InvitationRow {
  id: string
  email: string
  role: string
  organizationId: string
  organizationName: string | null
  invitedByName: string | null
  invitedByEmail: string | null
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

interface InvitationsResponse {
  invitations: InvitationRow[]
  nextCursor: string | null
  total: number | null
  error?: string
}

interface PageProps {
  params: Promise<{ locale: string }>
}

function formatDate(value?: string | null, locale: string = 'ja-JP') {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getStatus(invitation: InvitationRow) {
  if (invitation.acceptedAt) return 'accepted'
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return 'expired'
  return 'pending'
}

export default function SuperAdminInvitationsPage(props: PageProps) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('superAdmin.invitations')
  const tRoles = useTranslations('common.roles')
  const router = useRouter()
  const userService = useMemo(() => new UserService(), [])

  const [authState, setAuthState] = useState<'unknown' | 'allowed' | 'denied'>('unknown')
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [actionTarget, setActionTarget] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchInvitations = useCallback(
    async (options: { reset?: boolean } = {}) => {
      const { reset = false } = options
      reset ? setLoading(true) : setLoadingMore(true)
      try {
        const params = new URLSearchParams({ limit: '100' })
        if (!reset && nextCursor) {
          params.set('cursor', nextCursor)
        }
        const response = await fetch(`/api/super-admin/invitations?${params.toString()}`, { cache: 'no-store' })
        const body = (await response.json()) as InvitationsResponse
        if (!response.ok) {
          setToast({ type: 'error', message: body.error ?? t('messages.loadError') })
          return
        }
        setNextCursor(body.nextCursor)
        setTotalCount(body.total ?? null)
        setInvitations((prev) => (reset ? body.invitations : [...prev, ...body.invitations]))
        if (reset) {
          setSelected(new Set())
        }
      } catch (error) {
        console.error('[SuperAdminInvitations] load failed', error)
        setToast({ type: 'error', message: t('messages.loadError') })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [nextCursor, t]
  )

  const handleAuthGuard = useCallback(async () => {
    try {
      const user = await userService.getCurrentUser()
      if (!user || user.role !== 'super_admin') {
        setAuthState('denied')
        router.replace(`/${locale}/home`)
        return
      }
      setAuthState('allowed')
      setNextCursor(null)
      await fetchInvitations({ reset: true })
    } catch (error) {
      console.error('[SuperAdminInvitations] user guard failed', error)
      setAuthState('denied')
      router.replace(`/${locale}/home`)
    }
  }, [fetchInvitations, locale, router, userService])

  useEffect(() => {
    handleAuthGuard()
  }, [handleAuthGuard])

  const handleSelectionToggle = (invitationId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(invitationId)) {
        next.delete(invitationId)
      } else {
        next.add(invitationId)
      }
      return next
    })
  }

  const handleToggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(invitations.map((inv) => inv.id)))
  }

  const handleAccept = async (invitationId: string) => {
    setActionTarget(invitationId)
    try {
      const response = await fetch('/api/super-admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, locale })
      })
      const body = await response.json()
      if (!response.ok) {
        setToast({ type: 'error', message: body?.error ?? t('messages.acceptError') })
        return
      }
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitationId ? { ...inv, acceptedAt: new Date().toISOString() } : inv))
      )
      const suffix = body?.temporaryPassword
        ? ` ${t('messages.passwordNotice', { password: body.temporaryPassword })}`
        : ''
      setToast({ type: 'success', message: `${t('messages.acceptSuccess')}${suffix}`.trim() })
    } catch (error) {
      console.error('[SuperAdminInvitations] accept failed', error)
      setToast({ type: 'error', message: t('messages.acceptError') })
    } finally {
      setActionTarget(null)
    }
  }

  const handleDeleteSelected = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setDeleteLoading(true)
    try {
      const response = await fetch('/api/super-admin/invitations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })
      const body = await response.json()
      if (!response.ok) {
        setToast({ type: 'error', message: body?.error ?? t('messages.deleteError') })
        return
      }
      setInvitations((prev) => prev.filter((inv) => !ids.includes(inv.id)))
      setSelected(new Set())
      setToast({ type: 'success', message: t('messages.deleteSuccess', { count: ids.length }) })
    } catch (error) {
      console.error('[SuperAdminInvitations] delete failed', error)
      setToast({ type: 'error', message: t('messages.deleteError') })
    } finally {
      setDeleteLoading(false)
    }
  }

  const pendingCount = useMemo(() => invitations.filter((inv) => getStatus(inv) === 'pending').length, [invitations])
  const acceptedCount = useMemo(() => invitations.filter((inv) => inv.acceptedAt).length, [invitations])

  const content = (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <WindowToast
        message={toast?.message ?? null}
        variant={toast?.type === 'error' ? 'error' : 'success'}
        onDismiss={() => setToast(null)}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">{t('badge')}</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fetchInvitations({ reset: true })}
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            disabled={loading}
          >
            {loading ? t('actions.refreshing') : t('actions.refresh')}
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="inline-flex items-center rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selected.size === 0 || deleteLoading}
          >
            {deleteLoading ? t('actions.deleting') : t('actions.deleteSelected')}
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-text-muted">{t('summary.total')}</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{totalCount ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted">{t('summary.pending')}</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{pendingCount}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted">{t('summary.accepted')}</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{acceptedCount}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-app text-xs font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                  checked={invitations.length > 0 && selected.size === invitations.length}
                  onChange={(event) => handleToggleAll(event.target.checked)}
                />
              </th>
              <th className="px-4 py-3 text-left">{t('table.columns.email')}</th>
              <th className="px-4 py-3 text-left">{t('table.columns.organization')}</th>
              <th className="px-4 py-3 text-left">{t('table.columns.role')}</th>
              <th className="px-4 py-3 text-left">{t('table.columns.invitedBy')}</th>
              <th className="px-4 py-3 text-left">{t('table.columns.status')}</th>
              <th className="px-4 py-3 text-left">{t('table.columns.timestamps')}</th>
              <th className="px-4 py-3 text-right">{t('table.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && invitations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                  {t('messages.loading')}
                </td>
              </tr>
            ) : invitations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                  {t('messages.empty')}
                </td>
              </tr>
            ) : (
              invitations.map((invitation) => {
                const status = getStatus(invitation)
                const invitedBy = invitation.invitedByName || invitation.invitedByEmail || '—'
                return (
                  <tr key={invitation.id} className="text-text-secondary">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                        checked={selected.has(invitation.id)}
                        onChange={() => handleSelectionToggle(invitation.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{invitation.email}</div>
                      <div className="text-xs text-text-muted">{invitation.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{invitation.organizationName ?? t('table.unknownOrg')}</div>
                      <div className="text-xs text-text-muted">{invitation.organizationId}</div>
                    </td>
                    <td className="px-4 py-3">{tRoles(invitation.role as any)}</td>
                    <td className="px-4 py-3">{invitedBy}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === 'accepted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : status === 'expired'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {t(`status.${status}` as const)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-text-secondary">
                        <span className="font-medium">{t('table.labels.created')}</span> {formatDate(invitation.createdAt, locale)}
                      </div>
                      <div className="text-xs text-text-secondary">
                        <span className="font-medium">{t('table.labels.expires')}</span> {formatDate(invitation.expiresAt, locale)}
                      </div>
                      {invitation.acceptedAt && (
                        <div className="text-xs text-text-secondary">
                          <span className="font-medium">{t('table.labels.accepted')}</span> {formatDate(invitation.acceptedAt, locale)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleAccept(invitation.id)}
                        disabled={status !== 'pending' || actionTarget === invitation.id}
                        className="inline-flex items-center rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionTarget === invitation.id ? t('actions.accepting') : t('actions.accept')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        {nextCursor ? (
          <button
            type="button"
            onClick={() => fetchInvitations({ reset: false })}
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            disabled={loadingMore}
          >
            {loadingMore ? t('actions.loadingMore') : t('actions.loadMore')}
          </button>
        ) : invitations.length > 0 ? (
          <span className="text-sm text-text-muted">{t('messages.noMore')}</span>
        ) : null}
      </div>
    </div>
  )

  if (authState === 'denied') {
    return null
  }

  return <DashboardLayout locale={locale}>{content}</DashboardLayout>
}
