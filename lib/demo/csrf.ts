import { publicDemoOrigin } from './contract'

export function isAllowedDemoRequest(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (request.method !== 'POST') return false

  const origin = request.headers.get('origin')
  if (!origin) return false

  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    return false
  }
  try {
    const requestUrl = new URL(request.url)
    const requestHost = (request.headers.get('host') ?? requestUrl.host).toLowerCase()
    const allowedProductionOrigin = publicDemoOrigin(environment)
    const isProduction = environment.NODE_ENV === 'production'
    const isLoopback = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1'
    const isAllowedOrigin = isProduction
      ? originUrl.origin === allowedProductionOrigin
      : isLoopback
    const forwardedHost = request.headers.get('x-forwarded-host')?.toLowerCase()
    const forwardedProto = request.headers.get('x-forwarded-proto')?.toLowerCase()
    return Boolean(
      isAllowedOrigin &&
        origin === originUrl.origin &&
        originUrl.host.toLowerCase() === requestHost &&
        (!isProduction || !forwardedHost || forwardedHost === originUrl.host.toLowerCase()) &&
        (!isProduction || !forwardedProto || forwardedProto === originUrl.protocol.slice(0, -1)) &&
        request.headers.get('sec-fetch-site') === 'same-origin',
    )
  } catch {
    return false
  }
}
