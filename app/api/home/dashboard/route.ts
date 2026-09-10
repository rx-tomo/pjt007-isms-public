import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { buildHomeDashboard, HomeDashboardUnavailableError } from '@/lib/server/home/dashboard'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { user } = await getRouteAuth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await buildHomeDashboard(user.id)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof HomeDashboardUnavailableError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[HomeDashboard] failed', error)
    return NextResponse.json({ error: 'Home dashboard unavailable' }, { status: 503 })
  }
}
