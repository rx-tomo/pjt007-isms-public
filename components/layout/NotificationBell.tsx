'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { NotificationService, type Notification } from '@/lib/services/notification'
import { useNotificationStream } from '@/lib/hooks/useNotificationStream'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import { ja, enUS } from 'date-fns/locale'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export function NotificationBell() {
  const t = useTranslations('notifications')
  const { user } = useAuth()
  const params = useParams()
  const locale = params.locale as string
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // ポーリングで通知を自動取得（30秒間隔）
  const { notifications: polledNotifications, refresh } = useNotificationStream(user?.id)

  useEffect(() => {
    setNotifications(polledNotifications.slice(0, 10))
    setUnreadCount(polledNotifications.filter(n => n.status === 'unread').length)
    setLoading(false)
  }, [polledNotifications])

  const handleMarkAsRead = async (notificationId: string) => {
    await NotificationService.markAsRead(notificationId)
    refresh()
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return
    await NotificationService.markAllAsRead(user.id)
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
        return 'text-text-secondary bg-surface-elevated'
      default:
        return 'text-text-secondary bg-surface-elevated'
    }
  }

  return (
    <div className="relative">
      {/* 通知ベルアイコン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors"
        aria-label={t('openNotifications')}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知ドロップダウン */}
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* 通知パネル */}
          <div className="absolute right-0 mt-2 w-96 bg-surface rounded-lg shadow-lg z-20 max-h-[600px] overflow-hidden">
            {/* ヘッダー */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  {t('title')}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t('markAllAsRead')}
                  </button>
                )}
              </div>
            </div>

            {/* 通知リスト */}
            <div className="overflow-y-auto max-h-[500px]">
              {loading ? (
                <div className="p-4 text-center text-text-muted">
                  {t('loading')}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
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
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="mt-2">{t('noNotifications')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`${
                        notification.status === 'unread'
                          ? 'bg-blue-50 hover:bg-blue-100'
                          : 'hover:bg-surface-elevated'
                      } transition-colors`}
                    >
                      <div className="px-4 py-3">
                        <div className="flex items-start">
                          <span className="text-2xl mr-3">
                            {getTypeIcon(notification.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-text-primary">
                                  {notification.title}
                                </p>
                                <p className="mt-1 text-sm text-text-secondary">
                                  {notification.message}
                                </p>
                                <div className="mt-2 flex items-center space-x-4">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(
                                      notification.priority
                                    )}`}
                                  >
                                    {t(`priority.${notification.priority}`)}
                                  </span>
                                  <span className="text-xs text-text-muted">
                                    {formatDate(notification.created_at)}
                                  </span>
                                </div>
                              </div>
                              {notification.status === 'unread' && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="ml-4 text-blue-600 hover:text-blue-700"
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
                            </div>
                            {notification.link && (
                              <Link
                                href={`/${locale}${notification.link}`}
                                className="mt-2 inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                                onClick={() => setIsOpen(false)}
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
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* フッター */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-border">
                <Link
                  href={`/${locale}/notifications`}
                  className="block text-center text-sm text-blue-600 hover:text-blue-700"
                  onClick={() => setIsOpen(false)}
                >
                  {t('viewAll')}
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
