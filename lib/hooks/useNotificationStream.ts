'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  NotificationService,
  type Notification,
  type NotificationPollingOptions
} from '../services/notification'

const DEFAULT_INTERVAL_MS = 30_000

/**
 * ポーリングで通知を監視するReact hook。
 * 30秒ごとに通知一覧を取得し、最新の通知リストを返す。
 */
export function useNotificationStream(
  userId: string | undefined,
  options?: NotificationPollingOptions
) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      return
    }

    const cleanup = NotificationService.startPolling(
      userId,
      (fetched) => setNotifications(fetched),
      {
        intervalMs: optionsRef.current?.intervalMs ?? DEFAULT_INTERVAL_MS,
        ...optionsRef.current
      }
    )

    return cleanup
  }, [userId])

  const refresh = useCallback(() => {
    if (!userId) return
    NotificationService.getNotifications(userId).then(setNotifications).catch(console.error)
  }, [userId])

  return { notifications, refresh }
}
