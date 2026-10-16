// Current-user business profile, using the existing session and tenant authorization.
// Keep the Better Auth endpoint allowlist closed in the public demo.
export { GET } from '@/app/api/auth/profile/route'

export const dynamic = 'force-dynamic'
