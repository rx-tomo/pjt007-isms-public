'use client'

import { useState, useEffect, useCallback, useId, useMemo, use } from 'react';
import { useTranslations } from 'next-intl'
import { NotificationService, type Notification } from '@/lib/services/notification'
import { useNotificationStream } from '@/lib/hooks/useNotificationStream'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja, enUS } from 'date-fns/locale'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'

type NotificationView = 'all' | 'approvals'

function getNotificationView(value: string | null | undefined): NotificationView {
  return value === 'approvals' ? 'approvals' : 'all'
}

function isApprovalNotification(notification: Notification): boolean {
  if (notification.type === 'document_approval') return true
  const searchableText = `${notification.title} ${notification.message}`.toLowerCase()
  return searchableText.includes('承認') || searchableText.includes('approval')
}

export default function NotificationsPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('notifications')
  const tCommon = useTranslations('common')
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const activeView = getNotificationView(searchParams?.get('view'))
  const headingId = useId()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all')

  // ポーリングで通知を自動取得（30秒間隔）
  const { notifications: polledNotifications, refresh } = useNotificationStream(user?.id)

  // フィルタリングされた通知
  const filteredNotifications = useMemo(() => {
    const viewNotifications =
      activeView === 'approvals'
        ? polledNotifications.filter(isApprovalNotification)
        : polledNotifications

    if (filter === 'all') return viewNotifications
    if (filter === 'unread') return viewNotifications.filter(n => n.status === 'unread')
    return viewNotifications.filter(n => n.status === 'archived')
  }, [polledNotifications, filter, activeView])

  useEffect(() => {
    setNotifications(filteredNotifications)
    setLoading(false)
  }, [filteredNotifications])

  const handleMarkAsRead = async (notificationId: string) => {
    await NotificationService.markAsRead(notificationId)
    refresh()
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return
    await NotificationService.markAllAsRead(user.id)
    refresh()
  }

  const handleArchive = async (notificationId: string) => {
    await NotificationService.archiveNotification(notificationId)
    refresh()
  }

  const formatDate = (date: string) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: locale === 'ja' ? ja : enUS
    })
  }

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_reminder':
        return '📅'
      case 'document_approval':
        return '📄'
      case 'audit_schedule':
        return '🔍'
      case 'risk_alert':
        return '⚠️'
      case 'system':
        return '🔔'
      default:
        return 'ℹ️'
    }
  }

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-50'
      case 'high':
        return 'text-orange-600 bg-orange-50'
      case 'medium':
        return 'text-blue-600 bg-blue-50'
      case 'low':
        return 'text-text-muted bg-surface-elevated'
      default:
        return 'text-text-muted bg-surface-elevated'
    }
  }

  const unreadCount = notifications.filter(n => n.status === 'unread').length

  return (
    <DashboardLayout locale={locale}>
      <section
        className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8"
        aria-labelledby={headingId}
      >
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 id={headingId} className="text-2xl font-bold text-text-primary">
            {t('title')}
          </h1>
          <Link href={`/${locale}/settings/notifications`}>
            <Button variant="outline" size="sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('settings')}
            </Button>
          </Link>
        </div>

        {/* フィルターとアクション */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              data-testid="notifications-filter-all"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {t('filter.all')}
            </button>
            <button
              onClick={() => setFilter('unread')}
              data-testid="notifications-filter-unread"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {t('filter.unread')}
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-blue-600 bg-blue-100 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('archived')}
              data-testid="notifications-filter-archived"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'archived'
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {t('filter.archived')}
            </button>
          </div>

          {unreadCount > 0 && filter !== 'archived' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
            >
              {t('markAllAsRead')}
            </Button>
          )}
        </div>

        {activeView === 'approvals' && (
          <div
            data-testid="notifications-approval-view"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
          >
            <span>{t('views.approvals.active')}</span>
            <Link
              href={`/${locale}/notifications`}
              data-testid="notifications-clear-approval-view"
              className="rounded-md border border-blue-200 bg-surface px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
            >
              {t('views.approvals.clear')}
            </Link>
          </div>
        )}
      </div>

      {/* 通知リスト */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title={
            filter === 'all'
              ? t('noNotifications')
              : filter === 'unread'
              ? t('noUnreadNotifications')
              : t('noArchivedNotifications')
          }
        />
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              data-testid={`notification-item-${notification.id}`}
              className={`bg-surface rounded-lg shadow-sm border ${
                notification.status === 'unread'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-border'
              } overflow-hidden transition-all hover:shadow-md`}
            >
              <div className="p-6">
                <div className="flex items-start">
                  <span className="text-3xl mr-4 flex-shrink-0">
                    {getTypeIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-text-primary mb-1">
                          {notification.title}
                        </h3>
                        <p className="text-text-secondary">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {notification.status === 'unread' && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            aria-label={t('markAsRead')}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                        )}
                        {notification.status !== 'archived' && (
                          <button
                            onClick={() => handleArchive(notification.id)}
                            className="p-2 text-text-secondary hover:bg-surface-elevated rounded-lg transition-colors"
                            aria-label={t('archive')}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getPriorityColor(
                          notification.priority
                        )}`}
                      >
                        {t(`priority.${notification.priority}`)}
                      </span>
                      <span className="text-sm text-text-muted">
                        {formatDate(notification.created_at)}
                      </span>
                      {notification.link && (
                        <Link
                          href={`/${locale}${notification.link}`}
                          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {t('viewDetails')}
                          <svg
                            className="ml-1 w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </section>
    </DashboardLayout>
  )
}
