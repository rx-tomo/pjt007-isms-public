import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import {
  deleteChannel,
  listChannelLogs,
  listChannels,
  upsertChannel,
} from '@/lib/services/notificationChannels'

type Params = { organizationId: string }

async function requireGuard(request: NextRequest, organizationId: string, write = false) {
  return requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId,
    actionName: write ? 'organization.notification_channels.write' : 'organization.notification_channels.read',
    logContext: { organizationId },
  })
}

export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { guard, error } = await requireGuard(request, params.organizationId)
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const action = request.nextUrl.searchParams.get('action')

  try {
    switch (action) {
      case 'list': {
        const channels = await listChannels(params.organizationId)
        return guard.json(channels)
      }

      case 'logs': {
        const channelId = request.nextUrl.searchParams.get('channelId')
        const limit = Number(request.nextUrl.searchParams.get('limit') ?? 5)
        if (!channelId) {
          return guard.json({ error: 'channelId is required for logs' }, { status: 400 })
        }
        const logs = await listChannelLogs(channelId, Number.isFinite(limit) ? limit : 5)
        return guard.json(logs)
      }

      default:
        return guard.json({ error: `Invalid action: ${action}. Valid actions: list, logs` }, { status: 400 })
    }
  } catch (err) {
    console.error(`[Notification channels GET] action=${action} failed`, err)
    return guard.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params
  const { guard, error } = await requireGuard(request, params.organizationId, true)
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
      case 'upsert': {
        const channel = body.channel as Record<string, unknown> | undefined
        if (!channel || typeof channel !== 'object') {
          return guard.json({ error: 'channel object is required for upsert' }, { status: 400 })
        }
        const result = await upsertChannel({
          ...channel,
          organizationId: params.organizationId,
        } as any)
        return guard.json(result)
      }

      case 'delete': {
        const channelId = body.channelId as string | undefined
        if (!channelId || typeof channelId !== 'string') {
          return guard.json({ error: 'channelId is required for delete' }, { status: 400 })
        }
        const success = await deleteChannel(channelId, params.organizationId)
        return guard.json({ success })
      }

      default:
        return guard.json({ error: `Invalid action: ${action}. Valid actions: upsert, delete` }, { status: 400 })
    }
  } catch (err) {
    console.error(`[Notification channels POST] action=${action} failed`, err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return guard.json({ error: message }, { status: 500 })
  }
}
