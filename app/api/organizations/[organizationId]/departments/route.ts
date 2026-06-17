import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { organizationDepartments } from '@/lib/db/drizzle/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ organizationId: string }> }
) {
  const params = await props.params;
  const { organizationId } = params
  const { guard, error } = await requireServiceRole(request, {
    organizationId,
    actionName: 'organization.departments.list',
    logContext: { organizationId }
  })
  if (error || !guard) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const db = getDb()

    const rows = await db
      .select()
      .from(organizationDepartments)
      .where(eq(organizationDepartments.organizationId, organizationId))
      .orderBy(asc(organizationDepartments.name))

    const data = rows.map(row => ({
      id: row.id,
      organization_id: row.organizationId,
      name: row.name,
      name_en: row.nameEn,
      parent_department_id: row.parentDepartmentId,
      manager: row.manager,
      description: row.description,
      member_count: row.memberCount,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }))

    return guard.json(data)
  } catch (err) {
    console.error('[Departments] GET failed', err)
    return guard.json({ error: 'Failed to load departments' }, { status: 500 })
  }
}
