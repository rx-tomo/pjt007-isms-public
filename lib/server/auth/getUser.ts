import { redirect } from 'next/navigation'

export interface AuthUserInfo {
  id: string
  email: string
}

/**
 * Get the current authenticated user via Better Auth (server-side).
 */
export async function getUser(): Promise<AuthUserInfo | null> {
  const { auth } = await import('@/lib/auth/better-auth')
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email,
  }
}

/**
 * Require authentication, redirect to login if not authenticated.
 */
export async function requireAuth(locale: string = 'ja') {
  const user = await getUser()
  if (!user) {
    redirect(`/${locale}/auth/login`)
  }
  return user
}
