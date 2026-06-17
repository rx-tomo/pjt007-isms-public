import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations } from '@/lib/db/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ organizationId: string }> }
) {
  const params = await props.params;
  try {
    const { organizationId } = params
    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ['org_admin', 'system_operator'],
      organizationId,
      actionName: 'organization.ai_config.update',
      logContext: { organizationId }
    })
    if (error || !guard) {
      return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const db = getDb()

    // Read the existing ai_config
    const [org] = await db
      .select({ aiConfig: organizations.aiConfig })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      return guard.json({ error: 'Organization not found' }, { status: 404 })
    }

    const existingConfig: Record<string, unknown> = org.aiConfig
      ? JSON.parse(org.aiConfig)
      : {}

    // Merge the incoming config
    const updatedConfig = {
      ...existingConfig,
      ...body,
    }

    await db
      .update(organizations)
      .set({
        aiConfig: JSON.stringify(updatedConfig),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(organizations.id, organizationId))

    return guard.json({ success: true, aiConfig: updatedConfig })
  } catch (error) {
    console.error('[AI Config API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
