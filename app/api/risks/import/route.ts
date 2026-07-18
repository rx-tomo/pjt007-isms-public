import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
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
    mode: 'tenant',
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'risks.import'
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { logEvent, json, userId } = guard
  const db = getDb()
  const lifecycle = new RiskTenantLifecycleService(db)

  const summary: SummaryBlock = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }

  try {
    const buffer = await file.arrayBuffer()
    const rows = parseCsvToObjects(buffer, ['title'])

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
          } catch (updateErr) {
            summary.errors.push(`Line ${lineNumber}: failed to update "${title}" - ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`)
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
          } catch (insertErr) {
            summary.errors.push(`Line ${lineNumber}: failed to insert "${title}" - ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`)
            summary.skipped += 1
          }
        }
      } catch (rowErr) {
        summary.errors.push(`Line ${lineNumber}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`)
        summary.skipped += 1
      }
    }

    await logEvent('success', { summary })
    return json({ message: 'Import completed', summary })
  } catch (err) {
    console.error('[risks/import] failed', err)
    await logEvent('error', { reason: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      {
        error: 'Failed to import risks',
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    )
  }
}
