import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { NotificationService, type NotificationPreferences, type NotificationStatus } from '@/lib/services/notification'

const ALLOWED_ROLES = ['super_admin', 'system_operator', 'org_admin', 'auditor', 'approver', 'user']
const CROSS_USER_ROLES = new Set(['super_admin', 'system_operator'])

function canAccessUserNotifications(actorRole: string | null, actorUserId: string, targetUserId: string) {
  return actorUserId === targetUserId || CROSS_USER_ROLES.has((actorRole ?? '').toLowerCase())
}

export async function GET(request: NextRequest) {
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ALLOWED_ROLES,
    actionName: 'notifications.read',
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const action = request.nextUrl.searchParams.get('action')
  const userId = request.nextUrl.searchParams.get('userId') ?? guard.userId
  if (!canAccessUserNotifications(guard.profile.role, guard.userId, userId)) {
    return guard.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    switch (action) {
      case 'list': {
        const status = request.nextUrl.searchParams.get('status') as NotificationStatus | null
        const notifications = await NotificationService.getNotifications(userId, status ?? undefined)
        return guard.json(notifications)
      }

      case 'unreadCount': {
        const count = await NotificationService.getUnreadCount(userId)
        return guard.json({ count })
      }

      case 'preferences': {
        const preferences = await NotificationService.getPreferences(userId)
        return guard.json(preferences)
      }

      default:
        return guard.json({ error: `Invalid action: ${action}. Valid actions: list, unreadCount, preferences` }, { status: 400 })
    }
  } catch (err) {
    console.error(`[Notifications GET] action=${action} failed`, err)
    return guard.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ALLOWED_ROLES,
    actionName: 'notifications.write',
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const action = body.action as string | undefined

  try {
    switch (action) {
      case 'markAsRead': {
        const notificationId = body.notificationId as string | undefined
        if (!notificationId) {
          return guard.json({ error: 'notificationId is required for markAsRead' }, { status: 400 })
        }
        const success = await NotificationService.markAsRead(notificationId)
        return guard.json({ success })
      }

      case 'markAllAsRead': {
        const userId = (body.userId as string | undefined) ?? guard.userId
        if (!canAccessUserNotifications(guard.profile.role, guard.userId, userId)) {
          return guard.json({ error: 'Forbidden' }, { status: 403 })
        }
        const success = await NotificationService.markAllAsRead(userId)
        return guard.json({ success })
      }

      case 'archive': {
        const notificationId = body.notificationId as string | undefined
        if (!notificationId) {
          return guard.json({ error: 'notificationId is required for archive' }, { status: 400 })
        }
        const success = await NotificationService.archiveNotification(notificationId)
        return guard.json({ success })
      }

      case 'updatePreferences': {
        const userId = (body.userId as string | undefined) ?? guard.userId
        if (!canAccessUserNotifications(guard.profile.role, guard.userId, userId)) {
          return guard.json({ error: 'Forbidden' }, { status: 403 })
        }
        const preferences = body.preferences as Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>> | undefined
        if (!preferences || typeof preferences !== 'object') {
          return guard.json({ error: 'preferences is required for updatePreferences' }, { status: 400 })
        }
        const updated = await NotificationService.updatePreferences(userId, preferences)
        return guard.json(updated)
      }

      default:
        return guard.json({ error: `Invalid action: ${action}. Valid actions: markAsRead, markAllAsRead, archive, updatePreferences` }, { status: 400 })
    }
  } catch (err) {
    console.error(`[Notifications POST] action=${action} failed`, err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return guard.json({ error: message }, { status: 500 })
  }
}
