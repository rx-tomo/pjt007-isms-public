'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { DocumentWithFolder, DocumentApproval } from '@/lib/services/document'
import type { UserProfile } from '@/lib/services/user'

interface DocumentListProps {
  documents: DocumentWithFolder[]
  currentUserId?: string | null
  onRequestApproval: (document: DocumentWithFolder) => void
  onApprove: (document: DocumentWithFolder) => void
  onDelete: (documentId: string) => void
  onDownload: (document: DocumentWithFolder) => void
  onExport: (document: DocumentWithFolder, format: 'pdf' | 'word') => void
  onViewVersions?: (document: DocumentWithFolder) => void
  users?: UserProfile[]
}

export default function DocumentList({
  documents,
  currentUserId,
  onRequestApproval,
  onApprove,
  onDelete,
  onDownload,
  onExport,
  onViewVersions,
  users
}: DocumentListProps) {
  const t = useTranslations('documents')

  const userDirectory = useMemo(() => {
    if (!users) return new Map<string, UserProfile>()
    return new Map(users.map(user => [user.id, user]))
  }, [users])

  const getStatusColor = (status: DocumentWithFolder['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-surface-elevated text-text-primary'
      case 'in_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'obsolete':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-surface-elevated text-text-primary'
    }
  }

  const getApprovalStatusColor = (status: DocumentApproval['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'skipped':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-surface-elevated text-text-primary'
    }
  }

  const getApprovalStatusLabel = (status: DocumentApproval['status']) => {
    switch (status) {
      case 'pending':
        return t('approval.status.pending')
      case 'approved':
        return t('approval.status.approved')
      case 'skipped':
        return t('approval.status.skipped')
      case 'rejected':
        return t('approval.status.rejected')
      default:
        return status
    }
  }

  const formatFileSize = (bytes?: number | null) => {
    if (typeof bytes !== 'number') return null
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="bg-surface shadow overflow-hidden sm:rounded-md">
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-text-muted">{t('emptyState')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map(document => {
            const formattedSize = formatFileSize(document.file_size)
            const approvals = document.approvals || []
            const step1 = approvals.find(item => item.step === 1)
            const step2 = approvals.find(item => item.step === 2)
            const canRequestApproval = document.status === 'draft'
            const currentPendingApproval = approvals
              .filter(item => item.status === 'pending')
              .sort((a, b) => a.step - b.step)[0]
            const currentPendingApprover =
              currentPendingApproval?.approverId ??
              (document.approvalProgress?.currentStatus === 'pending'
                ? document.approvalProgress.currentApprover
                : undefined)
            const canApprove =
              !!currentUserId &&
              currentPendingApprover === currentUserId
            const owner = document.created_by ? userDirectory.get(document.created_by) : undefined
            const ownerDepartment = owner?.department ?? null

            return (
              <li key={document.id}>
                <div className="px-4 py-4 flex items-center sm:px-6">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div className="truncate">
                      <div className="flex text-sm">
                        <p className="font-medium text-indigo-600 truncate">
                          {document.title}
                        </p>
                        <p className="ml-1 flex-shrink-0 font-normal text-text-muted">
                          v{document.version_number || '1'}
                        </p>
                      </div>
                      {document.description && (
                        <div className="mt-2 text-sm text-text-muted truncate">
                          {document.description}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center text-sm text-text-muted">
                        <div className="flex items-center">
                          <svg
                            className="mr-1.5 h-5 w-5 text-text-muted"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <p>
                            {t('updatedAt', {
                              date: document.updated_at ? new Date(document.updated_at).toLocaleDateString() : '-'
                            })}
                          </p>
                        </div>
                        {document.status === 'in_review' && (
                          <>
                            <span className="mx-2">·</span>
                            <p>{t('approval.inReviewStatus')}</p>
                          </>
                        )}
                        {formattedSize && (
                          <>
                            <span className="mx-2">·</span>
                            <p>{formattedSize}</p>
                          </>
                        )}
                        {owner && (
                          <>
                            <span className="mx-2">·</span>
                            <p>{owner.full_name || owner.email}</p>
                          </>
                        )}
                        {ownerDepartment && (
                          <>
                            <span className="mx-2">·</span>
                            <p>{ownerDepartment}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex-shrink-0 sm:mt-0 sm:ml-5">
                      <div className="flex items-center space-x-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            document.status
                          )}`}
                        >
                          {t(`status.${document.status}`)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onExport(document, 'word')}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            {t('actions.exportWord')}
                          </button>
                          <button
                            onClick={() => onExport(document, 'pdf')}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            {t('actions.exportPdf')}
                          </button>
                          {onViewVersions && (
                            <button
                              onClick={() => onViewVersions(document)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              data-testid={`view-history-${document.id}`}
                            >
                              {t('actions.viewHistory')}
                            </button>
                          )}
                        </div>
                        {canRequestApproval && (
                          <button
                            onClick={() => onRequestApproval(document)}
                            className="text-sm text-indigo-600 hover:text-indigo-900 underline"
                          >
                            {t('actions.requestApproval')}
                          </button>
                        )}
                      </div>
                      {document.approvalProgress && document.approvalProgress.overallStatus !== 'not_submitted' && (
                        <div className="mt-2 flex items-center space-x-2">
                          {/* ステップインジケーター */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: document.approvalProgress.totalSteps }, (_, i) => {
                              const stepNum = i + 1
                              const progress = document.approvalProgress!
                              const isCompleted = stepNum < progress.currentStep ||
                                (stepNum === progress.currentStep && progress.currentStatus === 'approved')
                              const isCurrent = stepNum === progress.currentStep && progress.currentStatus === 'pending'
                              const isRejected = stepNum === progress.currentStep && progress.currentStatus === 'rejected'
                              return (
                                <div
                                  key={stepNum}
                                  className={`h-2 w-6 rounded-full ${
                                    isCompleted ? 'bg-green-500' :
                                    isCurrent ? 'bg-yellow-400' :
                                    isRejected ? 'bg-red-500' :
                                    'bg-surface-elevated'
                                  }`}
                                  title={t('approval.stepLabel', { step: stepNum })}
                                />
                              )
                            })}
                          </div>
                          {/* ステータスラベル */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              document.approvalProgress.overallStatus === 'approved' ? 'bg-green-100 text-green-800' :
                              document.approvalProgress.overallStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                              document.approvalProgress.overallStatus === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-surface-elevated text-text-primary'
                            }`}
                          >
                            {document.approvalProgress.overallStatus === 'approved' && t('approval.progress.approved')}
                            {document.approvalProgress.overallStatus === 'rejected' && t('approval.progress.rejected')}
                            {document.approvalProgress.overallStatus === 'in_review' && t('approval.progress.stepPending', {
                              current: document.approvalProgress.currentStep,
                              total: document.approvalProgress.totalSteps
                            })}
                          </span>
                          {canApprove && (
                            <button
                              onClick={() => onApprove(document)}
                              className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            >
                              {t('actions.approve')}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="mt-2 flex items-center space-x-2">
                        {document.file_path && (
                          <button
                            onClick={() => onDownload(document)}
                            className="text-indigo-600 hover:text-indigo-900"
                            aria-label={t('actions.downloadFile')}
                            title={t('actions.downloadFile')}
                            data-testid={`document-download-${document.id}`}
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(document.id)}
                          className="text-red-600 hover:text-red-900"
                          aria-label={t('actions.deleteDocument')}
                          title={t('actions.deleteDocument')}
                          data-testid={`document-delete-${document.id}`}
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
