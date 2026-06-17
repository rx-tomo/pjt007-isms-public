import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { parseCsvToObjects } from '@/lib/utils/importers/csv'
import { getDb } from '@/lib/db/drizzle/client'
import { auditUnits } from '@/lib/db/drizzle/schema/audit'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

type SummaryBlock = {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

const VALID_UNIT_TYPES = new Set(['site', 'process'])

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file')
  const organizationId = (formData.get('organizationId') as string | null)?.trim()

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'audit_units.import'
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { logEvent, json } = guard
  const db = getDb()

  const summary: SummaryBlock = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }

  try {
    const buffer = await file.arrayBuffer()
    const rows = parseCsvToObjects(buffer, ['name'])

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      summary.processed += 1
      const lineNumber = i + 2 // header is line 1

      const name = (row['name'] ?? '').trim()
      if (!name) {
        summary.errors.push(`Line ${lineNumber}: name is required`)
        summary.skipped += 1
        continue
      }

      const unitType = (row['unit_type'] ?? '').trim().toLowerCase()
      if (!VALID_UNIT_TYPES.has(unitType)) {
        summary.errors.push(`Line ${lineNumber}: invalid unit_type "${row['unit_type'] ?? ''}" (must be site or process)`)
        summary.skipped += 1
        continue
      }

      const description = (row['description'] ?? '').trim() || null

      // Check for existing entry (UNIQUE constraint: organization_id + name)
      const [existing] = await db
        .select({ id: auditUnits.id })
        .from(auditUnits)
        .where(and(eq(auditUnits.organizationId, organizationId), eq(auditUnits.name, name)))
        .limit(1)

      const now = new Date().toISOString()

      if (existing) {
        // Update existing record
        try {
          await db
            .update(auditUnits)
            .set({
              unitType,
              description,
              updatedAt: now,
            })
            .where(eq(auditUnits.id, existing.id))

          summary.updated += 1
        } catch (updateErr) {
          summary.errors.push(`Line ${lineNumber}: failed to update "${name}" - ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`)
          summary.skipped += 1
        }
      } else {
        // Insert new record
        try {
          await db.insert(auditUnits).values({
            id: crypto.randomUUID(),
            organizationId,
            name,
            unitType,
            description,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })

          summary.created += 1
        } catch (insertErr) {
          summary.errors.push(`Line ${lineNumber}: failed to insert "${name}" - ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`)
          summary.skipped += 1
        }
      }
    }

    await logEvent('success', { summary })
    return json({ message: 'import completed', summary })
  } catch (err) {
    console.error('[audit-units/import] failed', err)
    await logEvent('error', { reason: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      {
        error: 'Failed to import audit units',
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    )
  }
}
