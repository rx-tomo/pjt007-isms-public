import { NextResponse } from 'next/server'
import { getAuthFeatures } from '@/lib/server/auth/features'

export async function GET() {
  const features = getAuthFeatures()
  return NextResponse.json({
    ...features,
    mfaEnabled: features.mfaRequiredRoles.length > 0,
    ssoEnabled: features.ssoProviders.length > 0,
  })
}
