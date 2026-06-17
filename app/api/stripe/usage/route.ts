import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { documents, userProfiles } from '@/lib/db/drizzle/schema'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'stripe.usage.read',
    logContext: { organizationId },
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getDb()
    const [userCount, documentUsage] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(userProfiles)
        .where(and(
          eq(userProfiles.organizationId, organizationId),
          eq(userProfiles.isActive, true)
        )),
      db
        .select({
          count: sql<number>`count(*)`,
          totalSize: sql<number>`coalesce(sum(${documents.fileSize}), 0)`,
        })
        .from(documents)
        .where(eq(documents.organizationId, organizationId)),
    ])

    const totalBytes = Number(documentUsage[0]?.totalSize ?? 0)
    return NextResponse.json({
      data: {
        current_users: Number(userCount[0]?.count ?? 0),
        current_documents: Number(documentUsage[0]?.count ?? 0),
        storage_used_mb: totalBytes > 0 ? Number((totalBytes / (1024 * 1024)).toFixed(2)) : 0,
      }
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
