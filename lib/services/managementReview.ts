/**
 * Management Review Service
 *
 * Provides CRUD operations for management reviews, review items, and action items.
 * Uses Drizzle ORM directly (same pattern as IncidentService).
 */
import { getDb } from '@/lib/db/drizzle/client'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import {
  managementReviews,
  managementReviewItems,
  managementReviewActions,
} from '@/lib/db/drizzle/schema'
import { eq, and, desc, asc } from 'drizzle-orm'
import type {
  ManagementReviewStatus,
  ReviewItemType,
  ReviewActionStatus,
} from '@/lib/db/drizzle/schema'

// =========================================
// Service-level types
// =========================================

export type { ManagementReviewStatus, ReviewItemType, ReviewActionStatus }

export interface ManagementReviewRecord {
  id: string
  organization_id: string
  title: string
  review_date: string
  status: ManagementReviewStatus
  agenda: string | null
  participants: string | null
  location: string | null
  minutes: string | null
  conclusions: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ManagementReviewItemRecord {
  id: string
  review_id: string
  item_type: ReviewItemType
  title: string
  description: string | null
  related_area: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ManagementReviewActionRecord {
  id: string
  review_id: string
  review_item_id: string | null
  title: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  status: ReviewActionStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ManagementReviewWithRelations extends ManagementReviewRecord {
  items: ManagementReviewItemRecord[]
  actions: ManagementReviewActionRecord[]
}

// =========================================
// Row mappers
// =========================================

function mapReviewRow(row: typeof managementReviews.$inferSelect): ManagementReviewRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    title: row.title,
    review_date: row.reviewDate,
    status: row.status as ManagementReviewStatus,
    agenda: row.agenda ?? null,
    participants: row.participants ?? null,
    location: row.location ?? null,
    minutes: row.minutes ?? null,
    conclusions: row.conclusions ?? null,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapItemRow(row: typeof managementReviewItems.$inferSelect): ManagementReviewItemRecord {
  return {
    id: row.id,
    review_id: row.reviewId,
    item_type: row.itemType as ReviewItemType,
    title: row.title,
    description: row.description ?? null,
    related_area: row.relatedArea ?? null,
    sort_order: row.sortOrder,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapActionRow(row: typeof managementReviewActions.$inferSelect): ManagementReviewActionRecord {
  return {
    id: row.id,
    review_id: row.reviewId,
    review_item_id: row.reviewItemId ?? null,
    title: row.title,
    description: row.description ?? null,
    assignee_id: row.assigneeId ?? null,
    due_date: row.dueDate ?? null,
    status: row.status as ReviewActionStatus,
    completed_at: row.completedAt ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

// =========================================
// Service
// =========================================

export class ManagementReviewService {
  // ---- Reviews ----

  async list(organizationId: string): Promise<ManagementReviewRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(managementReviews)
      .where(eq(managementReviews.organizationId, organizationId))
      .orderBy(desc(managementReviews.reviewDate))

    return rows.map(mapReviewRow)
  }

  async getById(id: string): Promise<ManagementReviewWithRelations | null> {
    const db = getDb()
    const reviewRows = await db
      .select()
      .from(managementReviews)
      .where(eq(managementReviews.id, id))
      .limit(1)

    if (!reviewRows[0]) return null

    const review = mapReviewRow(reviewRows[0])

    const itemRows = await db
      .select()
      .from(managementReviewItems)
      .where(eq(managementReviewItems.reviewId, id))
      .orderBy(asc(managementReviewItems.sortOrder))

    const actionRows = await db
      .select()
      .from(managementReviewActions)
      .where(eq(managementReviewActions.reviewId, id))
      .orderBy(asc(managementReviewActions.createdAt))

    return {
      ...review,
      items: itemRows.map(mapItemRow),
      actions: actionRows.map(mapActionRow),
    }
  }

  async create(input: {
    organization_id: string
    title: string
    review_date: string
    status?: ManagementReviewStatus
    agenda?: string | null
    participants?: string | null
    location?: string | null
    minutes?: string | null
    conclusions?: string | null
    created_by?: string | null
  }): Promise<ManagementReviewRecord> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(managementReviews)
      .values({
        id,
        organizationId: input.organization_id,
        title: input.title,
        reviewDate: input.review_date,
        status: input.status ?? 'planned',
        agenda: input.agenda ?? null,
        participants: input.participants ?? null,
        location: input.location ?? null,
        minutes: input.minutes ?? null,
        conclusions: input.conclusions ?? null,
        createdBy: input.created_by ?? null,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create management review')
    }

    return mapReviewRow(rows[0])
  }

  async update(
    id: string,
    input: {
      title?: string
      review_date?: string
      status?: ManagementReviewStatus
      agenda?: string | null
      participants?: string | null
      location?: string | null
      minutes?: string | null
      conclusions?: string | null
    }
  ): Promise<ManagementReviewRecord> {
    const db = getDb()
    const now = new Date().toISOString()

    const setFields: Record<string, unknown> = { updatedAt: now }
    if (input.title !== undefined) setFields.title = input.title
    if (input.review_date !== undefined) setFields.reviewDate = input.review_date
    if (input.status !== undefined) setFields.status = input.status
    if (input.agenda !== undefined) setFields.agenda = input.agenda
    if (input.participants !== undefined) setFields.participants = input.participants
    if (input.location !== undefined) setFields.location = input.location
    if (input.minutes !== undefined) setFields.minutes = input.minutes
    if (input.conclusions !== undefined) setFields.conclusions = input.conclusions

    const rows = await db
      .update(managementReviews)
      .set(setFields)
      .where(eq(managementReviews.id, id))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`Management review not found: ${id}`)
    }

    return mapReviewRow(rows[0])
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.delete(managementReviews).where(eq(managementReviews.id, id))
  }

  // ---- Review Items ----

  async listItems(reviewId: string): Promise<ManagementReviewItemRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(managementReviewItems)
      .where(eq(managementReviewItems.reviewId, reviewId))
      .orderBy(asc(managementReviewItems.sortOrder))

    return rows.map(mapItemRow)
  }

  async createItem(input: {
    review_id: string
    item_type: ReviewItemType
    title: string
    description?: string | null
    related_area?: string | null
    sort_order?: number
  }): Promise<ManagementReviewItemRecord> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(managementReviewItems)
      .values({
        id,
        reviewId: input.review_id,
        itemType: input.item_type,
        title: input.title,
        description: input.description ?? null,
        relatedArea: input.related_area ?? null,
        sortOrder: input.sort_order ?? 0,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create review item')
    }

    return mapItemRow(rows[0])
  }

  async updateItem(
    id: string,
    input: {
      item_type?: ReviewItemType
      title?: string
      description?: string | null
      related_area?: string | null
      sort_order?: number
    }
  ): Promise<ManagementReviewItemRecord> {
    const db = getDb()
    const now = new Date().toISOString()

    const setFields: Record<string, unknown> = { updatedAt: now }
    if (input.item_type !== undefined) setFields.itemType = input.item_type
    if (input.title !== undefined) setFields.title = input.title
    if (input.description !== undefined) setFields.description = input.description
    if (input.related_area !== undefined) setFields.relatedArea = input.related_area
    if (input.sort_order !== undefined) setFields.sortOrder = input.sort_order

    const rows = await db
      .update(managementReviewItems)
      .set(setFields)
      .where(eq(managementReviewItems.id, id))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`Review item not found: ${id}`)
    }

    return mapItemRow(rows[0])
  }

  async deleteItem(id: string): Promise<void> {
    const db = getDb()
    await db.delete(managementReviewItems).where(eq(managementReviewItems.id, id))
  }

  // ---- Actions ----

  async listActions(reviewId: string): Promise<ManagementReviewActionRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(managementReviewActions)
      .where(eq(managementReviewActions.reviewId, reviewId))
      .orderBy(asc(managementReviewActions.createdAt))

    return rows.map(mapActionRow)
  }

  async createAction(input: {
    review_id: string
    review_item_id?: string | null
    title: string
    description?: string | null
    assignee_id?: string | null
    due_date?: string | null
    status?: ReviewActionStatus
  }): Promise<ManagementReviewActionRecord> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(managementReviewActions)
      .values({
        id,
        reviewId: input.review_id,
        reviewItemId: input.review_item_id ?? null,
        title: input.title,
        description: input.description ?? null,
        assigneeId: input.assignee_id ?? null,
        dueDate: input.due_date ?? null,
        status: input.status ?? 'open',
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create review action')
    }

    return mapActionRow(rows[0])
  }

  async updateAction(
    id: string,
    input: {
      title?: string
      description?: string | null
      assignee_id?: string | null
      due_date?: string | null
      status?: ReviewActionStatus
      completed_at?: string | null
    }
  ): Promise<ManagementReviewActionRecord> {
    const db = getDb()
    const now = new Date().toISOString()

    const setFields: Record<string, unknown> = { updatedAt: now }
    if (input.title !== undefined) setFields.title = input.title
    if (input.description !== undefined) setFields.description = input.description
    if (input.assignee_id !== undefined) setFields.assigneeId = input.assignee_id
    if (input.due_date !== undefined) setFields.dueDate = input.due_date
    if (input.status !== undefined) setFields.status = input.status
    if (input.completed_at !== undefined) setFields.completedAt = input.completed_at

    // Auto-set completedAt when status changes to completed
    if (input.status === 'completed' && input.completed_at === undefined) {
      setFields.completedAt = now
    }

    const rows = await db
      .update(managementReviewActions)
      .set(setFields)
      .where(eq(managementReviewActions.id, id))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`Review action not found: ${id}`)
    }

    return mapActionRow(rows[0])
  }

  async deleteAction(id: string): Promise<void> {
    const db = getDb()
    await db.delete(managementReviewActions).where(eq(managementReviewActions.id, id))
  }

  // ---- Export ----

  async exportReview(id: string): Promise<ManagementReviewWithRelations | null> {
    return this.getById(id)
  }
}
