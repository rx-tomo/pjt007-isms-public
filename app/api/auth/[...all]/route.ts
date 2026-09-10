import { auth } from '@/lib/auth/better-auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { isDemoSurfaceAvailable, isNormalAuthPathAllowed } from '@/lib/demo/contract'

const handler = toNextJsHandler(auth)

function unavailable() {
  return new Response(null, { status: 404 })
}

export async function GET(request: Request) {
  if (!isNormalAuthPathAllowed(new URL(request.url).pathname, request.method, isDemoSurfaceAvailable())) {
    return unavailable()
  }
  return handler.GET(request)
}

export async function POST(request: Request) {
  if (!isNormalAuthPathAllowed(new URL(request.url).pathname, request.method, isDemoSurfaceAvailable())) {
    return unavailable()
  }
  return handler.POST(request)
}
