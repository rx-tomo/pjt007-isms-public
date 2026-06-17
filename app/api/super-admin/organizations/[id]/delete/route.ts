import { NextRequest } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations } from '@/lib/db/drizzle/schema/organizations'
import { auditLogs } from '@/lib/db/drizzle/schema/audit-logs'
import { eq } from 'drizzle-orm'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: organizationId } = await context.params

  const guardResult = await requireServiceRole(request, {
    allowedRoles: ['super_admin'],
    actionName: 'super_admin.organizations.soft_delete'
  })

  if (!guardResult.guard) {
    return guardResult.error ?? new Response('Unauthorized', { status: 401 })
  }

  const guard = guardResult.guard

  let payload: { reason?: string }
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const reason = payload.reason?.trim() || undefined

  const db = getDb()

  try {
    // Check organization exists
    const orgRows = await db
      .select({ id: organizations.id, name: organizations.name, deletedAt: organizations.deletedAt })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    const org = orgRows[0]
    if (!org) {
      return guard.json({ error: 'Organization not found' }, { status: 404 })
    }

    if (org.deletedAt) {
      return guard.json(
        { error: 'Organization is already deleted', code: 'ALREADY_DELETED' },
        { status: 409 }
      )
    }

    // Soft delete
    const now = new Date().toISOString()
    await db.update(organizations)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(organizations.id, organizationId))

    // Record audit log
    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: guard.userId,
        action: 'organization.soft_delete',
        resourceType: 'organization',
        resourceId: organizationId,
        changes: JSON.stringify({ reason: reason ?? null, deleted_at: now }),
      })
    } catch (auditErr) {
      console.warn('[SuperAdmin Organizations Delete] audit log failed', auditErr)
    }

    return guard.json({
      status: 'deleted',
      organizationId: org.id,
      deletedAt: now
    })
  } catch (err) {
    console.error('[SuperAdmin Organizations Delete] failed', err)
    return guard.json({ error: 'Failed to delete organization' }, { status: 500 })
  }
}
