'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Notification, NotificationPollingOptions } from '../services/notification'

const DEFAULT_INTERVAL_MS = 30_000

async function requestNotifications<T>(
  action: string,
  options?: { method?: 'GET' | 'POST'; body?: Record<string, unknown>; query?: Record<string, string> }
): Promise<T> {
  const url = new URL('/api/notifications', window.location.origin)
  if (!options?.method || options.method === 'GET') {
    url.searchParams.set('action', action)
    Object.entries(options?.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value))
  }
  const response = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify({ action, ...options.body }) : undefined,
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Notification request failed: ${response.status}`)
  return response.json() as Promise<T>
}

async function getNotifications(userId: string): Promise<Notification[]> {
  return requestNotifications<Notification[]>('list', { query: { userId } })
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await requestNotifications('markAsRead', { method: 'POST', body: { notificationId } })
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await requestNotifications('markAllAsRead', { method: 'POST', body: { userId } })
}

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

    let stopped = false
    const update = async () => {
      try {
        const fetched = await getNotifications(userId)
        if (!stopped) setNotifications(fetched)
      } catch (error) {
        if (!stopped) console.error('[Notifications] polling failed', error)
      }
    }
    void update()
    const interval = window.setInterval(update, optionsRef.current?.intervalMs ?? DEFAULT_INTERVAL_MS)

    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }, [userId])

  const refresh = useCallback(() => {
    if (!userId) return
    getNotifications(userId).then(setNotifications).catch(console.error)
  }, [userId])

  return { notifications, refresh }
}
