import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { informationAssets } from '@/lib/db/drizzle/schema/risks'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { and, eq, desc, inArray } from 'drizzle-orm'

const CSV_HEADERS = [
  'id',
  'name',
  'asset_type',
  'classification',
  'criticality',
  'status',
  'owner_email',
  'location',
  'description',
  'updated_at'
]

const escapeValue = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return ''
  }
  const normalized = String(value)
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}

const buildCsv = (rows: Record<string, string>[]) => {
  const lines = [CSV_HEADERS.join(',')]
  rows.forEach(row => {
    lines.push(
      CSV_HEADERS
        .map(key => escapeValue(row[key]))
        .join(',')
    )
  })
  return `\uFEFF${lines.join('\n')}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')
  const templateOnly = searchParams.get('template') === '1' || searchParams.get('template') === 'true'
  const idsParam = searchParams.get('ids')
  const targetIds =
    idsParam && !templateOnly
      ? idsParam
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'information_assets.export',
    logContext: { templateOnly }
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { logEvent } = guard
  const db = getDb()

  try {
    let rows: Record<string, string>[] = []

    if (templateOnly) {
      rows = [
        {
          id: '',
          name: '',
          asset_type: 'data',
          classification: 'internal',
          criticality: 'medium',
          status: 'in_use',
          owner_email: '',
          location: '',
          description: '',
          updated_at: ''
        }
      ]
    } else {
      const whereConditions = [eq(informationAssets.organizationId, organizationId)]
      if (targetIds.length > 0) {
        whereConditions.push(inArray(informationAssets.id, targetIds))
      }

      const query = db
        .select({
          id: informationAssets.id,
          name: informationAssets.name,
          assetType: informationAssets.assetType,
          classification: informationAssets.classification,
          criticality: informationAssets.criticality,
          status: informationAssets.status,
          ownerId: informationAssets.ownerId,
          location: informationAssets.location,
          description: informationAssets.description,
          updatedAt: informationAssets.updatedAt,
        })
        .from(informationAssets)
        .where(and(...whereConditions))
        .orderBy(desc(informationAssets.updatedAt))
        .$dynamic()

      const data = await query

      const ownerIds = Array.from(
        new Set(
          data
            .map(row => row.ownerId)
            .filter((value): value is string => Boolean(value))
        )
      )

      let ownerEmails: Record<string, string> = {}
      if (ownerIds.length > 0) {
        const ownerRows = await db
          .select({ id: userProfiles.id, email: userProfiles.email })
          .from(userProfiles)
          .where(inArray(userProfiles.id, ownerIds))

        ownerEmails = Object.fromEntries(
          ownerRows.map(owner => [owner.id, owner.email ?? ''])
        )
      }

      rows = data.map(row => ({
        id: row.id,
        name: row.name,
        asset_type: row.assetType ?? '',
        classification: row.classification ?? '',
        criticality: row.criticality ?? '',
        status: row.status ?? '',
        owner_email: row.ownerId ? ownerEmails[row.ownerId] ?? '' : '',
        location: row.location ?? '',
        description: row.description ?? '',
        updated_at: row.updatedAt ?? ''
      }))
    }

    const filename = templateOnly
      ? `information-assets_template.csv`
      : `information-assets_${organizationId}_${new Date().toISOString().split('T')[0]}.csv`

    await logEvent('success', { rows: rows.length, template: templateOnly })

    return new NextResponse(buildCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (err) {
    console.error('[information-assets/export] unexpected error', err)
    await logEvent('error', { reason: 'unexpected_error', message: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Failed to export assets' }, { status: 500 })
  }
}
