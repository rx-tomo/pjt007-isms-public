'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { TenantSummary } from '@/lib/services/superAdmin'

type ActionType = 'delete' | 'restore'

interface TenantActionsProps {
  tenant: TenantSummary
  isDeleted?: boolean
  onDelete: (tenantId: string, reason?: string) => Promise<void>
  onRestore: (tenantId: string, reason?: string) => Promise<void>
  disabled?: boolean
}

interface ConfirmDialogProps {
  open: boolean
  actionType: ActionType
  tenantName: string
  loading: boolean
  error: string | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}

function ConfirmDialog({
  open,
  actionType,
  tenantName,
  loading,
  error,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const t = useTranslations('superAdmin.organizations.tenantActions')
  const [reason, setReason] = useState('')

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm(reason)
  }

  const isDelete = actionType === 'delete'
  const titleKey = isDelete ? 'deleteDialog.title' : 'restoreDialog.title'
  const descriptionKey = isDelete ? 'deleteDialog.description' : 'restoreDialog.description'
  const confirmKey = isDelete ? 'deleteDialog.confirm' : 'restoreDialog.confirm'
  const confirmingKey = isDelete ? 'deleteDialog.confirming' : 'restoreDialog.confirming'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6"
      data-testid={isDelete ? 'delete-confirm-dialog' : 'restore-confirm-dialog'}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">
            {t(titleKey)}
          </h2>
          <p className="text-sm text-text-secondary">
            {t(descriptionKey, { name: tenantName })}
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="action-reason" className="block text-sm font-medium text-text-secondary">
              {t('reasonLabel')}
            </label>
            <textarea
              id="action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-border focus:outline-none"
              rows={3}
            />
            <p className="mt-1 text-xs text-text-muted">{t('reasonHelp')}</p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated disabled:opacity-60"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                isDelete
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
              data-testid={isDelete ? 'confirm-delete-btn' : 'confirm-restore-btn'}
            >
              {loading ? t(confirmingKey) : t(confirmKey)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TenantActions({
  tenant,
  isDeleted = false,
  onDelete,
  onRestore,
  disabled = false
}: TenantActionsProps) {
  const t = useTranslations('superAdmin.organizations.tenantActions')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<ActionType>('delete')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenDialog = (type: ActionType) => {
    setActionType(type)
    setError(null)
    setDialogOpen(true)
  }

  const handleConfirm = async (reason: string) => {
    setLoading(true)
    setError(null)
    try {
      if (actionType === 'delete') {
        await onDelete(tenant.id, reason || undefined)
      } else {
        await onRestore(tenant.id, reason || undefined)
      }
      setDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.unknown')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (!loading) {
      setDialogOpen(false)
    }
  }

  return (
    <>
      {isDeleted ? (
        <button
          type="button"
          onClick={() => handleOpenDialog('restore')}
          disabled={disabled}
          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          data-testid="restore-tenant-btn"
        >
          {t('restore')}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handleOpenDialog('delete')}
          disabled={disabled}
          className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          data-testid="delete-tenant-btn"
        >
          {t('delete')}
        </button>
      )}

      <ConfirmDialog
        open={dialogOpen}
        actionType={actionType}
        tenantName={tenant.name}
        loading={loading}
        error={error}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}
