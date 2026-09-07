import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import {
  authorizeTenantAction,
  tenantActionDenialStatus,
} from '@/lib/server/auth/actionPolicy'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { parseLimitedFormData } from '@/lib/server/http/limitedFormData'
import { parseCsvToObjects } from '@/lib/utils/importers/csv'
import { getDb } from '@/lib/db/drizzle/client'
import { risks, riskCategories } from '@/lib/db/drizzle/schema/risks'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and } from 'drizzle-orm'
import { RiskTenantLifecycleService } from '@/lib/server/risks/riskTenantLifecycleService'
import type { RiskStatus } from '@/lib/db/repositories/interfaces/IRiskRepository'

export const runtime = 'nodejs'

type SummaryBlock = {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

const RISK_IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const RISK_IMPORT_MULTIPART_OVERHEAD_BYTES = 1024 * 1024
const RISK_IMPORT_MAX_ROWS = 5000
const RISK_IMPORT_MAX_COLUMNS = 64
const RISK_IMPORT_MAX_TOTAL_CELLS = (
  RISK_IMPORT_MAX_ROWS + 1
) * RISK_IMPORT_MAX_COLUMNS
const RISK_IMPORT_MAX_CELL_LENGTH = 50000

const VALID_STATUSES = new Set([
  'identified',
  'analyzing',
  'treating',
  'monitoring',
  'closed'
])

type RiskLevel = 1 | 2 | 3 | 4 | 5

function clampLevel(raw: string | undefined, defaultVal: RiskLevel): RiskLevel {
  if (!raw) return defaultVal
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 5) return defaultVal
  return n as RiskLevel
}

function requestOrganizationId(request: NextRequest): string | null {
  const headerValue = request.headers.get('x-organization-id')?.trim() ?? ''
  const queryValue = request.nextUrl.searchParams.get('organizationId')?.trim() ?? ''
  if (headerValue && queryValue && headerValue !== queryValue) return null
  const value = headerValue || queryValue
  if (!value || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

function formDataError(reason: 'too_large' | 'invalid_content_length' | 'invalid_form_data') {
  if (reason === 'too_large') {
    return NextResponse.json({ error: 'Import request is too large' }, { status: 413 })
  }
  return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
}

function isRiskImportShapeAllowed(rows: Record<string, string>[]): boolean {
  if (rows.length > RISK_IMPORT_MAX_ROWS) return false
  let totalCells = 0
  for (const row of rows) {
    const entries = Object.entries(row)
    if (entries.length > RISK_IMPORT_MAX_COLUMNS) return false
    totalCells += entries.length
    if (totalCells > RISK_IMPORT_MAX_TOTAL_CELLS) return false
    if (entries.some(([, value]) => (
      typeof value !== 'string' || value.length > RISK_IMPORT_MAX_CELL_LENGTH
    ))) return false
  }
  return true
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  const respond = <T extends NextResponse>(response: T): T => applyCookies(response)
  if (!user) {
    return respond(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const organizationId = requestOrganizationId(request)
  if (!organizationId) {
    return respond(NextResponse.json(
      { error: 'X-Organization-Id or organizationId query is required' },
      { status: 400 }
    ))
  }
  const [createAuthorization, updateAuthorization] = await Promise.all([
    authorizeTenantAction(getDb(), user.id, organizationId, 'risks.create'),
    authorizeTenantAction(getDb(), user.id, organizationId, 'risks.update'),
  ])
  if (!createAuthorization.ok || !updateAuthorization.ok) {
    const status = !createAuthorization.ok
      ? tenantActionDenialStatus(createAuthorization)
      : !updateAuthorization.ok
        ? tenantActionDenialStatus(updateAuthorization)
        : 404
    return respond(NextResponse.json(
      { error: status === 403 ? 'Forbidden' : 'Not found' },
      { status }
    ))
  }

  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant',
    organizationId,
    actionName: 'risks.import'
  })

  if (error || !guard) {
    return respond(error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const limitedFormData = await parseLimitedFormData(
    request,
    RISK_IMPORT_MAX_FILE_SIZE_BYTES + RISK_IMPORT_MULTIPART_OVERHEAD_BYTES
  )
  if (!limitedFormData.ok) {
    return respond(formDataError(limitedFormData.reason))
  }
  const formData = limitedFormData.formData
  const formOrganizationId = typeof formData.get('organizationId') === 'string'
    ? String(formData.get('organizationId')).trim()
    : ''
  if (formOrganizationId !== organizationId) {
    return respond(NextResponse.json({ error: 'Organization mismatch' }, { status: 400 }))
  }
  const file = formData.get('file')
  if (!(file instanceof Blob)) {
    return respond(NextResponse.json({ error: 'file is required' }, { status: 400 }))
  }
  if (file.size > RISK_IMPORT_MAX_FILE_SIZE_BYTES) {
    return respond(NextResponse.json({ error: 'CSV file is too large' }, { status: 413 }))
  }

  const { logEvent, json, userId } = guard

  const summary: SummaryBlock = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }

  let rows: ReturnType<typeof parseCsvToObjects>
  try {
    rows = parseCsvToObjects(await file.arrayBuffer(), ['title'], {
      strictColumnCount: true,
      strictQuoteSyntax: true,
      maxColumns: RISK_IMPORT_MAX_COLUMNS,
      maxRows: RISK_IMPORT_MAX_ROWS,
      maxCellLength: RISK_IMPORT_MAX_CELL_LENGTH,
      maxTotalCells: RISK_IMPORT_MAX_TOTAL_CELLS,
    })
    if (!isRiskImportShapeAllowed(rows)) {
      return respond(NextResponse.json({ error: 'Invalid CSV file' }, { status: 400 }))
    }
  } catch {
    console.warn('[risks/import] invalid CSV')
    return respond(NextResponse.json({ error: 'Invalid CSV file' }, { status: 400 }))
  }

  const db = getDb()
  const lifecycle = new RiskTenantLifecycleService(db)

  try {
    // Pre-fetch category lookup
    const categories = await db
      .select({ id: riskCategories.id, name: riskCategories.name })
      .from(riskCategories)
      .where(eq(riskCategories.organizationId, organizationId))

    const categoryMap = new Map<string, string>()
    for (const cat of categories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id)
    }

    // Pre-fetch user profile lookup
    const profiles = await db
      .select({ id: userProfiles.id, email: userProfiles.email })
      .from(userProfiles)
      .where(eq(userProfiles.organizationId, organizationId))

    const profileMap = new Map<string, string>()
    for (const p of profiles) {
      if (p.email) {
        profileMap.set(p.email.toLowerCase(), p.id)
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      summary.processed += 1
      const lineNumber = i + 2 // header is line 1

      try {
        const title = (row['title'] ?? '').trim()
        if (!title) {
          summary.errors.push(`Line ${lineNumber}: title is required`)
          summary.skipped += 1
          continue
        }
        if (title.length > 200) {
          summary.errors.push(`Line ${lineNumber}: title exceeds 200 characters`)
          summary.skipped += 1
          continue
        }

        const description = (row['description'] ?? '').trim() || null

        // Category lookup
        const categoryRaw = (row['category'] ?? '').trim()
        const categoryId = categoryRaw
          ? categoryMap.get(categoryRaw.toLowerCase()) ?? null
          : null

        // Level fields
        const impactLevel = clampLevel(row['impact_level']?.trim(), 3)
        const likelihoodLevel = clampLevel(row['likelihood_level']?.trim(), 3)

        // Status field
        const statusRaw = (row['status'] ?? '').trim().toLowerCase()
        const status = (VALID_STATUSES.has(statusRaw) ? statusRaw : 'identified') as RiskStatus

        // Owner lookup
        const ownerEmail = (row['owner_email'] ?? '').trim()
        const ownerId = ownerEmail
          ? profileMap.get(ownerEmail.toLowerCase()) ?? null
          : null

        // Check for existing entry (organization_id + title)
        const [existing] = await db
          .select({ id: risks.id, updatedAt: risks.updatedAt })
          .from(risks)
          .where(and(eq(risks.organizationId, organizationId), eq(risks.title, title)))
          .limit(1)

        if (existing) {
          // Update existing record
          try {
            if (!existing.updatedAt) throw new Error('existing risk has no update version')
            await lifecycle.patchRisk(userId, existing.id, {
              updates: {
                description,
                category_id: categoryId,
                impact_level: impactLevel,
                likelihood_level: likelihoodLevel,
                status,
                owner_id: ownerId,
              },
              expectedUpdatedAt: existing.updatedAt,
            }, { userAgent: request.headers.get('user-agent') })

            summary.updated += 1
          } catch {
            console.error('[risks/import] row update failed', { lineNumber })
            summary.errors.push(`Line ${lineNumber}: failed to update risk`)
            summary.skipped += 1
          }
        } else {
          // Insert new record
          try {
            await lifecycle.createRisk(userId, {
              organizationId,
              title,
              description,
              categoryId,
              impactLevel,
              likelihoodLevel,
              status,
              ownerId,
              identifiedDate: null,
              assetIds: [],
            }, { userAgent: request.headers.get('user-agent') })

            summary.created += 1
          } catch {
            console.error('[risks/import] row insert failed', { lineNumber })
            summary.errors.push(`Line ${lineNumber}: failed to insert risk`)
            summary.skipped += 1
          }
        }
      } catch {
        console.error('[risks/import] row processing failed', { lineNumber })
        summary.errors.push(`Line ${lineNumber}: failed to process risk`)
        summary.skipped += 1
      }
    }

    await logEvent('success', { summary })
    return respond(json({ message: 'Import completed', summary }))
  } catch {
    console.error('[risks/import] failed')
    await logEvent('error', { reason: 'risk_import_failed' })
    return respond(NextResponse.json(
      { error: 'Failed to import risks' },
      { status: 500 }
    ))
  }
}
