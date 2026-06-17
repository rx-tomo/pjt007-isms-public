import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole, isMultiOrgRole } from '@/lib/server/auth/secureClient'
import { getDb } from '@/lib/db/drizzle/client'
import { informationAssets, informationAssetImportJobs, informationAssetImportRows } from '@/lib/db/drizzle/schema/risks'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and } from 'drizzle-orm'

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

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function parseCsv(content: string): ParsedCsvRow[] {
  const rawLines = content.split(/\r?\n/)
  const lines = rawLines
    .map((line, index) => ({ lineNumber: index + 1, value: line.trim() }))
    .filter(({ value }) => value.length > 0)

  if (lines.length === 0) {
    throw new Error('CSV is empty')
  }

  const headerEntry = lines.shift()
  if (!headerEntry) {
    throw new Error('CSV header is missing')
  }

  const headers = parseCsvLine(headerEntry.value).map(normalizeHeader)
  const nameIndex = headers.indexOf('name')
  if (nameIndex === -1) {
    throw new Error('CSV header must include "name" column')
  }

  const assetTypeIndex = headers.indexOf('asset_type')
  const classificationIndex = headers.indexOf('classification')
  const criticalityIndex = headers.indexOf('criticality')
  const statusIndex = headers.indexOf('status')
  const ownerEmailIndex = headers.indexOf('owner_email')
  const ownerNameIndex = headers.indexOf('owner_name')
  const locationIndex = headers.indexOf('location')
  const descriptionIndex = headers.indexOf('description')

  const rows: ParsedCsvRow[] = []
  for (const entry of lines) {
    const values = parseCsvLine(entry.value)
    const name = values[nameIndex]?.trim()
    if (!name) {
      continue
    }

    rows.push({
      line_number: entry.lineNumber,
      name,
      asset_type: assetTypeIndex >= 0 ? values[assetTypeIndex]?.trim() ?? undefined : undefined,
      classification: classificationIndex >= 0 ? values[classificationIndex]?.trim() ?? undefined : undefined,
      criticality: criticalityIndex >= 0 ? values[criticalityIndex]?.trim() ?? undefined : undefined,
      status: statusIndex >= 0 ? values[statusIndex]?.trim() ?? undefined : undefined,
      owner_email: ownerEmailIndex >= 0 ? values[ownerEmailIndex]?.trim() ?? undefined : undefined,
      owner_name: ownerNameIndex >= 0 ? values[ownerNameIndex]?.trim() ?? undefined : undefined,
      location: locationIndex >= 0 ? values[locationIndex]?.trim() ?? undefined : undefined,
      description: descriptionIndex >= 0 ? values[descriptionIndex]?.trim() ?? undefined : undefined
    })
  }

  if (rows.length === 0) {
    throw new Error('No valid rows were found in CSV')
  }

  if (rows.length > 1000) {
    throw new Error('CSV row limit exceeded (max 1000 rows)')
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
    const userId = formData.get('userId')
    const normalizedOrgId = typeof organizationId === 'string' ? organizationId.trim() : ''
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : ''
    const modeInput = formData.get('mode')
    const normalizedMode =
      typeof modeInput === 'string' && modeInput.trim().length > 0
        ? modeInput.trim().toLowerCase()
        : 'insert'

    const { guard, error } = await requireServiceRole(request, {
      allowedRoles: ['org_admin', 'system_operator'],
      organizationId: normalizedOrgId || undefined,
      actionName: 'information_assets.import',
      logContext: normalizedOrgId ? { organizationId: normalizedOrgId, mode: normalizedMode } : undefined
    })

    if (error) {
      return error
    }

    if (!guard) {
      return new Response('Service role guard unavailable', { status: 500 })
    }
    const { profile, userId: sessionUserId, json, logEvent } = guard
    jsonResponse = json

    if (!(file instanceof Blob)) {
      return json({ error: 'CSV file is required' }, { status: 400 })
    }

    if (!normalizedOrgId) {
      return json({ error: 'organizationId is required' }, { status: 400 })
    }

    if (!normalizedUserId) {
      return json({ error: 'userId is required' }, { status: 400 })
    }

    if (normalizedUserId !== sessionUserId && !isMultiOrgRole(profile.role)) {
      await logEvent('denied', {
        reason: 'user_mismatch',
        requestedUserId: normalizedUserId,
        sessionUserId
      })
      return json({ error: 'Forbidden' }, { status: 403 })
    }

    const text = await file.text()
    const allowedModes = new Set(['insert', 'upsert', 'replace'])
    if (!allowedModes.has(normalizedMode)) {
      return json({ error: 'Unsupported import mode' }, { status: 400 })
    }

    const rows = parseCsv(text)
    const db = getDb()

    // Create import job
    const jobId = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(informationAssetImportJobs).values({
      id: jobId,
      organizationId: normalizedOrgId,
      createdBy: normalizedUserId,
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

    // Resolve owner emails to user IDs
    const ownerEmails = new Set<string>()
    for (const row of rows) {
      if (row.owner_email) ownerEmails.add(row.owner_email.toLowerCase())
    }

    const ownerMap = new Map<string, string>()
    if (ownerEmails.size > 0) {
      const profiles = await db
        .select({ id: userProfiles.id, email: userProfiles.email })
        .from(userProfiles)
        .where(eq(userProfiles.organizationId, normalizedOrgId))

      for (const p of profiles) {
        if (p.email && ownerEmails.has(p.email.toLowerCase())) {
          ownerMap.set(p.email.toLowerCase(), p.id)
        }
      }
    }

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
      const ownerId = row.owner_email ? ownerMap.get(row.owner_email.toLowerCase()) ?? null : null

      try {
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
            await db
              .update(informationAssets)
              .set({
                assetType,
                classification,
                criticality,
                status,
                ownerId,
                location: row.location ?? null,
                description: row.description ?? null,
                updatedAt: now,
              })
              .where(eq(informationAssets.id, existing.id))

            await db.insert(informationAssetImportRows).values({
              id: crypto.randomUUID(),
              jobId,
              lineNumber: row.line_number,
              rawData: JSON.stringify(row),
              status: 'imported',
              assetId: existing.id,
              createdAt: now,
              updatedAt: now,
            })

            successCount += 1
            continue
          }
        }

        // Insert new asset
        const assetId = crypto.randomUUID()
        await db.insert(informationAssets).values({
          id: assetId,
          organizationId: normalizedOrgId,
          name: row.name,
          assetType,
          classification,
          criticality,
          status,
          ownerId,
          location: row.location ?? null,
          description: row.description ?? null,
          createdAt: now,
          updatedAt: now,
        })

        await db.insert(informationAssetImportRows).values({
          id: crypto.randomUUID(),
          jobId,
          lineNumber: row.line_number,
          rawData: JSON.stringify(row),
          status: 'imported',
          assetId,
          createdAt: now,
          updatedAt: now,
        })

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
