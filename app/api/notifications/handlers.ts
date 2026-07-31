import { NextRequest, type NextResponse } from 'next/server'
import {
  NotificationService,
  targetsCurrentNotificationUser,
  type NotificationPreferences,
  type NotificationStatus,
} from '@/lib/services/notification'

export interface NotificationRouteGuard {
  profile: {
    organization_id: string | null
    role?: string
  }
  userId: string
  json: (body: unknown, init?: ResponseInit) => NextResponse
}

export type NotificationRouteService = Pick<
  typeof NotificationService,
  | 'getNotificationsForRecipient'
  | 'getUnreadCountForRecipient'
  | 'getPreferences'
  | 'markAsReadForRecipient'
  | 'markAllAsReadForRecipient'
  | 'archiveForRecipient'
  | 'updatePreferences'
>

export async function handleNotificationsGet(
  request: NextRequest,
  guard: NotificationRouteGuard,
  service: NotificationRouteService = NotificationService
) {
  const action = request.nextUrl.searchParams.get('action')
  const requestedUserId = request.nextUrl.searchParams.get('userId') ?? undefined
  if (!targetsCurrentNotificationUser(guard.userId, requestedUserId)) {
    return guard.json({ error: 'Forbidden' }, { status: 403 })
  }
  const recipient = {
    organizationId: guard.profile.organization_id!,
    userId: guard.userId,
  }

  try {
    switch (action) {
      case 'list': {
        const status = request.nextUrl.searchParams.get('status') as NotificationStatus | null
        const notifications = await service.getNotificationsForRecipient(
          recipient,
          status ?? undefined
        )
        return guard.json(notifications)
      }

      case 'unreadCount': {
        const count = await service.getUnreadCountForRecipient(recipient)
        return guard.json({ count })
      }

      case 'preferences': {
        const preferences = await service.getPreferences(guard.userId)
        return guard.json(preferences)
      }

      default:
        return guard.json({ error: `Invalid action: ${action}. Valid actions: list, unreadCount, preferences` }, { status: 400 })
    }
  } catch {
    console.error(`[Notifications GET] action=${action} failed`)
    return guard.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function handleNotificationsPost(
  request: NextRequest,
  guard: NotificationRouteGuard,
  service: NotificationRouteService = NotificationService
) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const action = body.action as string | undefined
  const requestedUserId = typeof body.userId === 'string' ? body.userId : undefined
  if (!targetsCurrentNotificationUser(guard.userId, requestedUserId)) {
    return guard.json({ error: 'Forbidden' }, { status: 403 })
  }
  const recipient = {
    organizationId: guard.profile.organization_id!,
    userId: guard.userId,
  }

  try {
    switch (action) {
      case 'markAsRead': {
        const notificationId = body.notificationId as string | undefined
        if (!notificationId) {
          return guard.json({ error: 'notificationId is required for markAsRead' }, { status: 400 })
        }
        const result = await service.markAsReadForRecipient(recipient, notificationId)
        if (!result.ok) {
          return guard.json({ error: 'Not found' }, { status: 404 })
        }
        return guard.json({ success: true })
      }

      case 'markAllAsRead': {
        await service.markAllAsReadForRecipient(recipient)
        return guard.json({ success: true })
      }

      case 'archive': {
        const notificationId = body.notificationId as string | undefined
        if (!notificationId) {
          return guard.json({ error: 'notificationId is required for archive' }, { status: 400 })
        }
        const result = await service.archiveForRecipient(recipient, notificationId)
        if (!result.ok) {
          return guard.json({ error: 'Not found' }, { status: 404 })
        }
        return guard.json({ success: true })
      }

      case 'updatePreferences': {
        const preferences = body.preferences as Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>> | undefined
        if (!preferences || typeof preferences !== 'object') {
          return guard.json({ error: 'preferences is required for updatePreferences' }, { status: 400 })
        }
        const updated = await service.updatePreferences(guard.userId, preferences)
        return guard.json(updated)
      }

      default:
        return guard.json({ error: `Invalid action: ${action}. Valid actions: markAsRead, markAllAsRead, archive, updatePreferences` }, { status: 400 })
    }
  } catch {
    console.error(`[Notifications POST] action=${action} failed`)
    return guard.json({ error: 'Internal server error' }, { status: 500 })
  }
}
