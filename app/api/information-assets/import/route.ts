import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { informationAssets, informationAssetImportJobs, informationAssetImportRows } from '@/lib/db/drizzle/schema/risks'
import { eq, and } from 'drizzle-orm'
import { InformationAssetService } from '@/lib/services/informationAsset'
import { resolveActiveTenantMemberByEmail } from '@/lib/server/auth/targetMember'
import { parseCsvToObjects } from '@/lib/utils/importers/csv'

export const runtime = 'nodejs'

interface ParsedCsvRow {
  line_number: number
  name: string
  asset_type?: string
  classification?: string
  criticality?: string
  status?: string
  owner_email?: string
  owner_name?: string
  location?: string
  description?: string
}

const INFORMATION_ASSET_CSV_MAX_BYTES = 5 * 1024 * 1024
const INFORMATION_ASSET_CSV_LIMITS = {
  strictColumnCount: true,
  strictQuoteSyntax: true,
  maxRows: 1_000,
  maxColumns: 32,
  maxTotalCells: 32_032,
  maxCellLength: 16_384,
} as const

function parseCsv(content: ArrayBuffer): ParsedCsvRow[] {
  const parsed = parseCsvToObjects(content, ['name'], INFORMATION_ASSET_CSV_LIMITS)
  const rows = parsed
    .map((row, index) => ({
      line_number: index + 2,
      name: row['name']?.trim() ?? '',
      asset_type: row['asset_type']?.trim() || undefined,
      classification: row['classification']?.trim() || undefined,
      criticality: row['criticality']?.trim() || undefined,
      status: row['status']?.trim() || undefined,
      owner_email: row['owner_email']?.trim() || undefined,
      owner_name: row['owner_name']?.trim() || undefined,
      location: row['location']?.trim() || undefined,
      description: row['description']?.trim() || undefined,
    }))
    .filter(row => row.name.length > 0)
  if (rows.length === 0) {
    throw new Error('No valid rows were found in CSV')
  }
  return rows
}

const VALID_ASSET_TYPES = new Set(['hardware', 'software', 'data', 'service', 'facility', 'personnel', 'other'])
const VALID_CLASSIFICATIONS = new Set(['restricted', 'internal', 'public'])
const VALID_CRITICALITIES = new Set(['low', 'medium', 'high'])
const VALID_STATUSES = new Set(['in_use', 'retired', 'planned'])

export async function POST(request: NextRequest) {
  let jsonResponse: ((body: unknown, init?: ResponseInit) => NextResponse) | undefined
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const organizationId = formData.get('organizationId')
    const normalizedOrgId = typeof organizationId === 'string' ? organizationId.trim() : ''
    const modeInput = formData.get('mode')
    const normalizedMode =
      typeof modeInput === 'string' && modeInput.trim().length > 0
        ? modeInput.trim().toLowerCase()
        : 'insert'

    const { guard, error } = await requireServiceRole(request, {
      mode: 'tenant',
      allowedRoles: ['org_admin', 'system_operator'],
      organizationId: normalizedOrgId || '',
      actionName: 'information_assets.import',
      logContext: normalizedOrgId ? { organizationId: normalizedOrgId, mode: normalizedMode } : undefined
    })

    if (error) {
      return error
    }

    if (!guard) {
      return new Response('Service role guard unavailable', { status: 500 })
    }
    const { userId: sessionUserId, json, logEvent } = guard
    jsonResponse = json

    if (!(file instanceof Blob)) {
      return json({ error: 'CSV file is required' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > INFORMATION_ASSET_CSV_MAX_BYTES) {
      return json({ error: 'CSV file is invalid or too large' }, { status: 400 })
    }

    if (!normalizedOrgId) {
      return json({ error: 'organizationId is required' }, { status: 400 })
    }

    const allowedModes = new Set(['insert', 'upsert', 'replace'])
    if (!allowedModes.has(normalizedMode)) {
      return json({ error: 'Unsupported import mode' }, { status: 400 })
    }

    const rows = parseCsv(await file.arrayBuffer())
    const db = getDb()
    const informationAssetService = new InformationAssetService(db)

    // Create import job
    const jobId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(informationAssetImportJobs).values({
      id: jobId,
      organizationId: normalizedOrgId,
      createdBy: sessionUserId,
      originalFilename: 'name' in file ? (file as File).name : undefined,
      status: 'processing',
      mode: normalizedMode,
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const row of rows) {
      const assetType = row.asset_type && VALID_ASSET_TYPES.has(row.asset_type.toLowerCase())
        ? row.asset_type.toLowerCase()
        : 'data'
      const classification = row.classification && VALID_CLASSIFICATIONS.has(row.classification.toLowerCase())
        ? row.classification.toLowerCase()
        : 'internal'
      const criticality = row.criticality && VALID_CRITICALITIES.has(row.criticality.toLowerCase())
        ? row.criticality.toLowerCase()
        : 'medium'
      const status = row.status && VALID_STATUSES.has(row.status.toLowerCase())
        ? row.status.toLowerCase()
        : 'in_use'
      try {
        const ownerEmail = (row.owner_email ?? '').trim().toLowerCase()
        const owner = ownerEmail
          ? await resolveActiveTenantMemberByEmail(db, normalizedOrgId, ownerEmail)
          : null
        if (ownerEmail && !owner) {
          throw new Error('Information asset owner not found')
        }
        const ownerId = owner?.userId ?? null
        const importTracking = {
          jobId,
          lineNumber: row.line_number,
          rawData: JSON.stringify(row),
        }

        if (normalizedMode === 'upsert') {
          // Check for existing by name
          const [existing] = await db
            .select({ id: informationAssets.id })
            .from(informationAssets)
            .where(and(
              eq(informationAssets.organizationId, normalizedOrgId),
              eq(informationAssets.name, row.name)
            ))
            .limit(1)

          if (existing) {
            await informationAssetService.updateAssetForActor(
              { organizationId: normalizedOrgId, actorUserId: sessionUserId },
              existing.id,
              {
                asset_type: assetType,
                classification,
                criticality,
                status,
                owner_id: ownerId,
                location: row.location ?? null,
                description: row.description ?? null,
              },
              importTracking
            )

            successCount += 1
            continue
          }
        }

        // Insert new asset
        await informationAssetService.createAssetForActor(
          { organizationId: normalizedOrgId, actorUserId: sessionUserId },
          {
            organization_id: normalizedOrgId,
            name: row.name,
            asset_type: assetType,
            classification,
            criticality,
            status,
            owner_id: ownerId,
            location: row.location ?? null,
            description: row.description ?? null,
          },
          importTracking
        )

        successCount += 1
      } catch (rowErr) {
        errorCount += 1
        const errMsg = `Line ${row.line_number}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`
        errors.push(errMsg)

        await db.insert(informationAssetImportRows).values({
          id: crypto.randomUUID(),
          jobId,
          lineNumber: row.line_number,
          rawData: JSON.stringify(row),
          status: 'error',
          message: rowErr instanceof Error ? rowErr.message : String(rowErr),
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    // Update job completion
    await db
      .update(informationAssetImportJobs)
      .set({
        status: 'completed',
        successCount,
        errorCount,
        errorSummary: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(informationAssetImportJobs.id, jobId))

    await logEvent('success', {
      organizationId: normalizedOrgId,
      jobId,
      totalRows: rows.length,
      successCount,
      upsertCount: 0,
      errorCount,
      errors
    }, { format: 'information_assets.import' })

    return json({
      jobId,
      totalRows: rows.length,
      successCount,
      upsertCount: 0,
      errorCount,
      errors
    })
  } catch (err) {
    console.error('Information asset CSV import failed', err)
    const responder = jsonResponse ?? ((body: unknown, init?: ResponseInit) => NextResponse.json(body, init))
    return responder(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 422 }
    )
  }
}
