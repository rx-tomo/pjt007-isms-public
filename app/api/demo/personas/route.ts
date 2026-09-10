import { NextResponse } from 'next/server'
import { isDemoSurfaceAvailable } from '@/lib/demo/contract'
import { buildPublicDemoCatalog } from '@/lib/server/demo/registry'
import { PublicDemoRuntimeUnavailableError } from '@/lib/server/demo/publicDemoRuntimeGate'

export async function GET() {
  if (!isDemoSurfaceAvailable()) return new NextResponse(null, { status: 404 })
  try {
    return NextResponse.json(await buildPublicDemoCatalog())
  } catch (error) {
    if (error instanceof PublicDemoRuntimeUnavailableError) {
      return NextResponse.json(
        { error: 'Demo fixture is temporarily unavailable.' },
        { status: 503, headers: { 'Retry-After': '30' } },
      )
    }
    throw error
  }
}
