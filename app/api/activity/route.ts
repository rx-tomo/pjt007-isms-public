import { NextRequest, NextResponse } from 'next/server'
import { ActivityService } from '@/lib/services/activity'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const service = new ActivityService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }
  if (organizationId !== caller.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '20')
  const limit = Number.isFinite(limitParam) ? limitParam : 20
  const actions = request.nextUrl.searchParams.getAll('action')

  try {
    const data = await service.getRecentActivity({
      organizationId,
      limit,
      actions: actions.length > 0 ? actions : undefined,
    })
    return NextResponse.json({ data })
  } catch (error) {
    return handleRouteError(error)
  }
}
