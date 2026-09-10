import { toNextJsHandler } from 'better-auth/next-js'
import { demoAuth } from '@/lib/auth/server/demoAuth'
import { isDemoAuthPathAllowed, isDemoSurfaceAvailable } from '@/lib/demo/contract'

const handler = toNextJsHandler(demoAuth)

function unavailable() {
  return new Response(null, { status: 404 })
}

export async function GET(request: Request) {
  if (!isDemoSurfaceAvailable()) return unavailable()
  if (!isDemoAuthPathAllowed(new URL(request.url).pathname, request.method)) return unavailable()
  return handler.GET(request)
}

export async function POST(request: Request) {
  if (!isDemoSurfaceAvailable()) return unavailable()
  if (!isDemoAuthPathAllowed(new URL(request.url).pathname, request.method)) return unavailable()
  return handler.POST(request)
}
