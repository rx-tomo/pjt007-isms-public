import { getDb } from '@/lib/db/drizzle/client'
import {
  organizationNotificationChannels,
  organizationNotificationChannelLogs,
  type OrganizationNotificationChannel,
  type OrganizationNotificationChannelInsert,
  type OrganizationNotificationChannelLog,
  type OrganizationNotificationChannelLogInsert,
} from '@/lib/db/drizzle/schema/notifications'
import { eq, and, asc, desc } from 'drizzle-orm'

export type NotificationChannelType = OrganizationNotificationChannel['channelType']
export type NotificationChannel = OrganizationNotificationChannel
export type NotificationChannelInsert = OrganizationNotificationChannelInsert
export type NotificationChannelLog = OrganizationNotificationChannelLog
export type NotificationChannelLogInsert = Omit<OrganizationNotificationChannelLogInsert, 'id'> & { details?: Record<string, unknown> | string | null }

async function fetchChannelsApi<T>(
  organizationId: string,
  action: string,
  options?: { method?: string; body?: Record<string, unknown>; query?: Record<string, string> }
): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error('fetchChannelsApi must only be called from the browser')
  }

  const url = new URL(`/api/organizations/${organizationId}/notification-channels`, window.location.origin)
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

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? `API error ${response.status}`)
  }

  return response.json()
}

export async function listChannels(
  organizationId: string,
  /** @deprecated client param ignored */
  _client?: unknown
): Promise<NotificationChannel[]> {
  if (typeof window !== 'undefined') {
    return fetchChannelsApi(organizationId, 'list')
  }

  const db = getDb()
  try {
    return await db
      .select()
      .from(organizationNotificationChannels)
      .where(eq(organizationNotificationChannels.organizationId, organizationId))
      .orderBy(asc(organizationNotificationChannels.createdAt))
  } catch (error) {
    console.error('[NotificationChannels] Failed to list channels', error)
    return []
  }
}

export async function upsertChannel(
  params: Partial<NotificationChannel> & {
    organizationId: string
    notificationType: string
    channelType: string
    webhookUrl: string
  },
  /** @deprecated client param ignored */
  _client?: unknown
): Promise<NotificationChannel | null> {
  if (typeof window !== 'undefined') {
    return fetchChannelsApi(params.organizationId, 'upsert', { method: 'POST', body: { channel: params } })
  }

  const db = getDb()
  const payload: OrganizationNotificationChannelInsert = {
    id: params.id ?? crypto.randomUUID(),
    organizationId: params.organizationId,
    notificationType: params.notificationType,
    channelType: params.channelType,
    webhookUrl: params.webhookUrl,
    isEnabled: params.isEnabled ?? true,
    lastStatus: params.lastStatus ?? null,
    lastAttemptedAt: params.lastAttemptedAt ?? null,
    failureCount: params.failureCount ?? 0,
    lastError: params.lastError ?? null,
    customPayloadTemplate: params.customPayloadTemplate ?? null,
    customHeaders: params.customHeaders ?? null,
  }

  try {
    if (params.id) {
      await db.update(organizationNotificationChannels)
        .set(payload)
        .where(eq(organizationNotificationChannels.id, params.id))

      const rows = await db.select()
        .from(organizationNotificationChannels)
        .where(eq(organizationNotificationChannels.id, params.id))
        .limit(1)
      return rows[0] ?? null
    }

    await db.insert(organizationNotificationChannels).values(payload)
    const rows = await db.select()
      .from(organizationNotificationChannels)
      .where(eq(organizationNotificationChannels.id, payload.id!))
      .limit(1)
    return rows[0] ?? null
  } catch (error) {
    console.error('[NotificationChannels] Failed to upsert channel', error)
    return null
  }
}

export async function deleteChannel(
  channelId: string,
  organizationId: string,
  /** @deprecated client param ignored */
  _client?: unknown
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const result = await fetchChannelsApi<{ success: boolean }>(organizationId, 'delete', {
      method: 'POST',
      body: { channelId },
    })
    return result.success
  }

  const db = getDb()
  try {
    await db.delete(organizationNotificationChannels)
      .where(
        and(
          eq(organizationNotificationChannels.id, channelId),
          eq(organizationNotificationChannels.organizationId, organizationId)
        )
      )
    return true
  } catch (error) {
    console.error('[NotificationChannels] Failed to delete channel', error)
    return false
  }
}

export async function listChannelLogs(
  channelId: string,
  limit = 5,
  /** @deprecated pass organizationId from browser callers */
  _client?: unknown
): Promise<NotificationChannelLog[]> {
  if (typeof window !== 'undefined') {
    if (typeof _client !== 'string') {
      return []
    }
    return fetchChannelsApi(_client, 'logs', {
      query: {
        channelId,
        limit: String(limit),
      },
    })
  }

  const db = getDb()
  try {
    return await db
      .select()
      .from(organizationNotificationChannelLogs)
      .where(eq(organizationNotificationChannelLogs.channelId, channelId))
      .orderBy(desc(organizationNotificationChannelLogs.createdAt))
      .limit(limit)
  } catch (error) {
    console.error('[NotificationChannels] Failed to load channel logs', error)
    return []
  }
}

export async function logDeliveryAttempt(
  payload: NotificationChannelLogInsert,
  /** @deprecated client param ignored */
  _client?: unknown
): Promise<NotificationChannelLog | null> {
  const db = getDb()
  try {
    const id = crypto.randomUUID()
    await db.insert(organizationNotificationChannelLogs).values({
      id,
      channelId: payload.channelId,
      notificationId: payload.notificationId ?? null,
      status: payload.status,
      attempt: payload.attempt,
      responseStatus: payload.responseStatus ?? null,
      responseBody: payload.responseBody ?? null,
      errorMessage: payload.errorMessage ?? null,
      details: payload.details ? (typeof payload.details === 'string' ? payload.details : JSON.stringify(payload.details)) : null,
    })

    const rows = await db.select()
      .from(organizationNotificationChannelLogs)
      .where(eq(organizationNotificationChannelLogs.id, id))
      .limit(1)
    return rows[0] ?? null
  } catch (error) {
    console.error('[NotificationChannels] Failed to log delivery attempt', error)
    return null
  }
}

export async function updateChannelStatus(
  channelId: string,
  updates: {
    last_status?: string | null
    last_attempted_at?: string | null
    failure_count?: number
    last_error?: string | null
  },
  /** @deprecated client param ignored */
  _client?: unknown
): Promise<NotificationChannel | null> {
  const db = getDb()
  try {
    await db.update(organizationNotificationChannels)
      .set({
        lastStatus: updates.last_status,
        lastAttemptedAt: updates.last_attempted_at,
        failureCount: updates.failure_count,
        lastError: updates.last_error,
      })
      .where(eq(organizationNotificationChannels.id, channelId))

    const rows = await db.select()
      .from(organizationNotificationChannels)
      .where(eq(organizationNotificationChannels.id, channelId))
      .limit(1)
    return rows[0] ?? null
  } catch (error) {
    console.error('[NotificationChannels] Failed to update channel status', error)
    return null
  }
}
