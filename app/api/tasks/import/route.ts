import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { parseCsvToObjects, splitList } from '@/lib/utils/importers/csv'
import { getDb } from '@/lib/db/drizzle/client'
import { tasks, taskCategories, taskTags, taskTagRelations } from '@/lib/db/drizzle/schema/tasks'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

type SummaryBlock = {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

const VALID_STATUSES = new Set([
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled'
])

const VALID_PRIORITIES = new Set([
  'low',
  'medium',
  'high',
  'urgent'
])

function parseDateOrNull(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(trimmed + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  return trimmed
}

function parsePositiveNumberOrNull(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw.trim())
  if (isNaN(n) || n <= 0) return null
  return n
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
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'tasks.import'
  })

  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { logEvent, json, userId } = guard
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
    const rows = parseCsvToObjects(buffer, ['title'])

    // Pre-fetch task_categories lookup
    const categories = await db
      .select({ id: taskCategories.id, name: taskCategories.name })
      .from(taskCategories)
      .where(eq(taskCategories.organizationId, organizationId))

    const categoryMap = new Map<string, string>()
    for (const cat of categories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id)
    }

    // Pre-fetch user_profiles lookup
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

    // Pre-fetch task_tags lookup
    const tags = await db
      .select({ id: taskTags.id, name: taskTags.name })
      .from(taskTags)
      .where(eq(taskTags.organizationId, organizationId))

    const tagMap = new Map<string, string>()
    for (const t of tags) {
      tagMap.set(t.name.toLowerCase(), t.id)
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

        // Assignee lookup
        const assigneeEmail = (row['assignee_email'] ?? '').trim()
        const assigneeId = assigneeEmail
          ? profileMap.get(assigneeEmail.toLowerCase()) ?? null
          : null

        // Status field
        const statusRaw = (row['status'] ?? '').trim().toLowerCase()
        const status = VALID_STATUSES.has(statusRaw) ? statusRaw : 'todo'

        // Priority field
        const priorityRaw = (row['priority'] ?? '').trim().toLowerCase()
        const priority = VALID_PRIORITIES.has(priorityRaw) ? priorityRaw : 'medium'

        // Due date
        const dueDate = parseDateOrNull(row['due_date'])

        // Estimated hours
        const estimatedHours = parsePositiveNumberOrNull(row['estimated_hours'])

        // Tags (semicolon-separated)
        const tagNames = splitList(row['tags'])
        const tagIds: string[] = []
        for (const tagName of tagNames) {
          const tagId = tagMap.get(tagName.toLowerCase())
          if (tagId) {
            tagIds.push(tagId)
          }
        }

        // Check for existing entry (organization_id + title)
        const [existing] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.organizationId, organizationId), eq(tasks.title, title)))
          .limit(1)

        const now = new Date().toISOString()

        if (existing) {
          // Update existing record
          try {
            await db
              .update(tasks)
              .set({
                description,
                categoryId,
                assigneeId,
                reporterId: userId,
                status,
                priority,
                dueDate,
                estimatedHours,
                updatedAt: now,
              })
              .where(eq(tasks.id, existing.id))

            // Update tag assignments: delete existing, re-insert
            await db
              .delete(taskTagRelations)
              .where(eq(taskTagRelations.taskId, existing.id))

            if (tagIds.length > 0) {
              await db.insert(taskTagRelations).values(
                tagIds.map((tagId, idx) => ({ taskId: existing.id, tagId, displayOrder: idx }))
              )
            }

            summary.updated += 1
          } catch (updateErr) {
            summary.errors.push(`Line ${lineNumber}: failed to update "${title}" - ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`)
            summary.skipped += 1
          }
        } else {
          // Insert new record
          const newId = crypto.randomUUID()
          try {
            await db.insert(tasks).values({
              id: newId,
              organizationId,
              title,
              description,
              categoryId,
              assigneeId,
              reporterId: userId,
              status,
              priority,
              dueDate,
              estimatedHours,
              createdAt: now,
              updatedAt: now,
            })

            // Insert tag assignments
            if (tagIds.length > 0) {
              await db.insert(taskTagRelations).values(
                tagIds.map((tagId, idx) => ({ taskId: newId, tagId, displayOrder: idx }))
              )
            }

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
    console.error('[tasks/import] failed', err)
    await logEvent('error', { reason: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      {
        error: 'Failed to import tasks',
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    )
  }
}
