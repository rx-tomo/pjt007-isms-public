/**
 * SQLite Education Repository
 *
 * Implements IEducationRepository using Drizzle ORM with SQLite.
 * Handles all education/training management data operations with organization-scoped data isolation.
 *
 * @module lib/db/repositories/sqlite/EducationRepository
 */

import { eq, and, asc, desc } from 'drizzle-orm'
import { BaseSQLiteRepository } from './BaseSQLiteRepository'
import {
  educationPlans,
  educationRecords,
  educationMaterials,
  educationPlanMaterials,
} from '@/lib/db/drizzle/schema/education'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import type {
  IEducationRepository,
  EducationPlanEntity,
  EducationPlanInsertPayload,
  EducationPlanUpdatePayload,
  EducationPlanWithRelations,
  EducationPlanFilters,
  EducationRecordEntity,
  EducationRecordInsertPayload,
  EducationRecordUpdatePayload,
  EducationRecordWithAttendee,
  EducationMaterialEntity,
  EducationMaterialInsertPayload,
  EducationStats,
} from '../interfaces/IEducationRepository'
import type { QueryOptions } from '../interfaces/IBaseRepository'
import type { DrizzleDb } from '@/lib/db/drizzle/client'

export class SQLiteEducationRepository extends BaseSQLiteRepository implements IEducationRepository {
  constructor(dbOverride?: DrizzleDb) {
    super()
    if (dbOverride) {
      this.db = dbOverride
    }
  }

  // =========================================
  // Plan CRUD
  // =========================================

  async findById(id: string): Promise<EducationPlanEntity | null> {
    const rows = await this.db
      .select()
      .from(educationPlans)
      .where(eq(educationPlans.id, id))

    if (rows.length === 0) return null
    return this.mapPlanRow(rows[0])
  }

  async findMany(filters?: Record<string, unknown>): Promise<EducationPlanEntity[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const rows = await this.db.select().from(educationPlans)
      return rows.map(r => this.mapPlanRow(r))
    }

    const conditions = Object.entries(filters)
      .map(([key, value]) => {
        const column = educationPlans[key as keyof typeof educationPlans.$inferSelect]
        if (column) {
          return eq(column as never, value as never)
        }
        return null
      })
      .filter(Boolean)

    if (conditions.length === 0) {
      const rows = await this.db.select().from(educationPlans)
      return rows.map(r => this.mapPlanRow(r))
    }

    const rows = await this.db
      .select()
      .from(educationPlans)
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions as never[]))

    return rows.map(r => this.mapPlanRow(r))
  }

  async findByOrganizationId(
    organizationId: string,
    filters?: EducationPlanFilters,
    _options?: QueryOptions
  ): Promise<EducationPlanEntity[]> {
    this.requireOrganizationId(organizationId, 'findByOrganizationId')

    const conditions = [eq(educationPlans.organizationId, organizationId)]

    if (filters?.status) {
      conditions.push(eq(educationPlans.status, filters.status))
    }

    let rows = await this.db
      .select()
      .from(educationPlans)
      .where(and(...conditions))
      .orderBy(desc(educationPlans.updatedAt))

    if (filters?.search) {
      const search = filters.search.toLowerCase()
      rows = rows.filter(r => {
        const title = (r.title ?? '').toLowerCase()
        const description = (r.description ?? '').toLowerCase()
        return title.includes(search) || description.includes(search)
      })
    }

    this.logDataAccess('findByOrganizationId', organizationId, { count: rows.length })
    return rows.map(r => this.mapPlanRow(r))
  }

  async findByIdWithRelations(id: string): Promise<EducationPlanWithRelations | null> {
    const planRows = await this.db
      .select()
      .from(educationPlans)
      .where(eq(educationPlans.id, id))

    if (planRows.length === 0) return null

    const plan = this.mapPlanRow(planRows[0])

    // Load created_by user
    let createdByUser = null
    if (planRows[0].createdBy) {
      const userRows = await this.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, planRows[0].createdBy))

      if (userRows.length > 0) {
        createdByUser = {
          id: userRows[0].id,
          full_name: userRows[0].fullName,
          email: userRows[0].email,
        }
      }
    }

    // Load records with attendees
    const records = await this.getRecordsByPlanId(id)

    // Load materials
    const materials = await this.getPlanMaterials(id)

    return {
      ...plan,
      records,
      materials,
      created_by_user: createdByUser,
    }
  }

  async create(data: EducationPlanInsertPayload): Promise<EducationPlanEntity> {
    this.requireOrganizationId(data.organization_id, 'create education plan')

    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: data.organization_id,
      title: data.title,
      description: data.description ?? null,
      targetAudience: data.target_audience ?? null,
      startDate: data.start_date ?? null,
      endDate: data.end_date ?? null,
      status: data.status ?? 'draft',
      createdBy: data.created_by ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(educationPlans).values(row)

    this.logDataAccess('create education plan', data.organization_id, { id })
    return this.mapPlanRow(row)
  }

  async update(id: string, updates: EducationPlanUpdatePayload): Promise<EducationPlanEntity | null> {
    const now = new Date().toISOString()

    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (updates.title !== undefined) setPayload.title = updates.title
    if (updates.description !== undefined) setPayload.description = updates.description
    if (updates.target_audience !== undefined) setPayload.targetAudience = updates.target_audience
    if (updates.start_date !== undefined) setPayload.startDate = updates.start_date
    if (updates.end_date !== undefined) setPayload.endDate = updates.end_date
    if (updates.status !== undefined) setPayload.status = updates.status

    await this.db
      .update(educationPlans)
      .set(setPayload)
      .where(eq(educationPlans.id, id))

    const rows = await this.db
      .select()
      .from(educationPlans)
      .where(eq(educationPlans.id, id))

    if (rows.length === 0) return null
    return this.mapPlanRow(rows[0])
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(educationPlans)
      .where(eq(educationPlans.id, id))
  }

  // =========================================
  // Record operations
  // =========================================

  async createRecord(data: EducationRecordInsertPayload): Promise<EducationRecordEntity> {
    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      planId: data.plan_id,
      attendeeId: data.attendee_id,
      attendedAt: data.attended_at ?? null,
      completedAt: data.completed_at ?? null,
      score: data.score ?? null,
      result: data.result ?? 'pending',
      feedback: data.feedback ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(educationRecords).values(row)

    this.logDataAccess('createRecord', 'n/a', { id, planId: data.plan_id })
    return this.mapRecordRow(row)
  }

  async updateRecord(id: string, data: EducationRecordUpdatePayload): Promise<EducationRecordEntity | null> {
    const now = new Date().toISOString()

    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (data.attended_at !== undefined) setPayload.attendedAt = data.attended_at
    if (data.completed_at !== undefined) setPayload.completedAt = data.completed_at
    if (data.score !== undefined) setPayload.score = data.score
    if (data.result !== undefined) setPayload.result = data.result
    if (data.feedback !== undefined) setPayload.feedback = data.feedback

    await this.db
      .update(educationRecords)
      .set(setPayload)
      .where(eq(educationRecords.id, id))

    const rows = await this.db
      .select()
      .from(educationRecords)
      .where(eq(educationRecords.id, id))

    if (rows.length === 0) return null
    return this.mapRecordRow(rows[0])
  }

  async deleteRecord(id: string): Promise<void> {
    await this.db
      .delete(educationRecords)
      .where(eq(educationRecords.id, id))
  }

  async getRecordsByPlanId(planId: string): Promise<EducationRecordWithAttendee[]> {
    const rows = await this.db
      .select()
      .from(educationRecords)
      .where(eq(educationRecords.planId, planId))
      .orderBy(asc(educationRecords.createdAt))

    const results: EducationRecordWithAttendee[] = []

    for (const row of rows) {
      const record = this.mapRecordRow(row)

      let attendee = null
      if (row.attendeeId) {
        const userRows = await this.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.id, row.attendeeId))

        if (userRows.length > 0) {
          attendee = {
            id: userRows[0].id,
            full_name: userRows[0].fullName,
            email: userRows[0].email,
          }
        }
      }

      results.push({ ...record, attendee })
    }

    return results
  }

  // =========================================
  // Material operations
  // =========================================

  async createMaterial(data: EducationMaterialInsertPayload): Promise<EducationMaterialEntity> {
    this.requireOrganizationId(data.organization_id, 'create education material')

    const id = data.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const row = {
      id,
      organizationId: data.organization_id,
      title: data.title,
      materialType: data.material_type ?? 'document',
      url: data.url ?? null,
      fileReference: data.file_reference ?? null,
      description: data.description ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(educationMaterials).values(row)

    this.logDataAccess('createMaterial', data.organization_id, { id })
    return this.mapMaterialRow(row)
  }

  async updateMaterial(id: string, data: Partial<EducationMaterialInsertPayload>): Promise<EducationMaterialEntity | null> {
    const now = new Date().toISOString()

    const setPayload: Record<string, unknown> = { updatedAt: now }

    if (data.title !== undefined) setPayload.title = data.title
    if (data.material_type !== undefined) setPayload.materialType = data.material_type
    if (data.url !== undefined) setPayload.url = data.url
    if (data.file_reference !== undefined) setPayload.fileReference = data.file_reference
    if (data.description !== undefined) setPayload.description = data.description

    await this.db
      .update(educationMaterials)
      .set(setPayload)
      .where(eq(educationMaterials.id, id))

    const rows = await this.db
      .select()
      .from(educationMaterials)
      .where(eq(educationMaterials.id, id))

    if (rows.length === 0) return null
    return this.mapMaterialRow(rows[0])
  }

  async deleteMaterial(id: string): Promise<void> {
    await this.db
      .delete(educationMaterials)
      .where(eq(educationMaterials.id, id))
  }

  async getMaterialsByOrganizationId(organizationId: string): Promise<EducationMaterialEntity[]> {
    this.requireOrganizationId(organizationId, 'getMaterialsByOrganizationId')

    const rows = await this.db
      .select()
      .from(educationMaterials)
      .where(eq(educationMaterials.organizationId, organizationId))
      .orderBy(desc(educationMaterials.updatedAt))

    this.logDataAccess('getMaterialsByOrganizationId', organizationId, { count: rows.length })
    return rows.map(r => this.mapMaterialRow(r))
  }

  // =========================================
  // Plan-Material associations
  // =========================================

  async setPlanMaterials(planId: string, materialIds: string[]): Promise<void> {
    // Delete all existing
    await this.db
      .delete(educationPlanMaterials)
      .where(eq(educationPlanMaterials.planId, planId))

    if (materialIds.length === 0) return

    const now = new Date().toISOString()
    for (let i = 0; i < materialIds.length; i++) {
      await this.db.insert(educationPlanMaterials).values({
        id: crypto.randomUUID(),
        planId,
        materialId: materialIds[i],
        displayOrder: i,
        createdAt: now,
      })
    }

    this.logDataAccess('setPlanMaterials', 'n/a', { planId, count: materialIds.length })
  }

  async getPlanMaterials(planId: string): Promise<EducationMaterialEntity[]> {
    const rows = await this.db
      .select({
        id: educationMaterials.id,
        organizationId: educationMaterials.organizationId,
        title: educationMaterials.title,
        materialType: educationMaterials.materialType,
        url: educationMaterials.url,
        fileReference: educationMaterials.fileReference,
        description: educationMaterials.description,
        createdAt: educationMaterials.createdAt,
        updatedAt: educationMaterials.updatedAt,
      })
      .from(educationPlanMaterials)
      .innerJoin(educationMaterials, eq(educationPlanMaterials.materialId, educationMaterials.id))
      .where(eq(educationPlanMaterials.planId, planId))
      .orderBy(asc(educationPlanMaterials.displayOrder))

    return rows.map(r => this.mapMaterialRow(r))
  }

  // =========================================
  // Statistics
  // =========================================

  async getStats(organizationId: string): Promise<EducationStats | null> {
    this.requireOrganizationId(organizationId, 'getStats')

    const planRows = await this.db
      .select()
      .from(educationPlans)
      .where(eq(educationPlans.organizationId, organizationId))

    if (planRows.length === 0) return null

    const byStatus: Record<string, number> = {}
    for (const row of planRows) {
      const status = row.status ?? 'draft'
      byStatus[status] = (byStatus[status] || 0) + 1
    }

    const planIds = planRows.map(r => r.id)

    // Get all records for these plans
    let totalRecords = 0
    let completedRecords = 0
    let totalScore = 0
    let scoredRecords = 0

    for (const planId of planIds) {
      const recordRows = await this.db
        .select()
        .from(educationRecords)
        .where(eq(educationRecords.planId, planId))

      for (const rec of recordRows) {
        totalRecords++
        if (rec.result === 'passed') completedRecords++
        if (rec.score != null) {
          totalScore += rec.score
          scoredRecords++
        }
      }
    }

    this.logDataAccess('getStats', organizationId, { totalPlans: planRows.length })

    return {
      totalPlans: planRows.length,
      byStatus,
      totalRecords,
      completionRate: totalRecords > 0 ? completedRecords / totalRecords : 0,
      averageScore: scoredRecords > 0 ? totalScore / scoredRecords : 0,
    }
  }

  // =========================================
  // Private: row-to-entity mappers
  // =========================================

  private mapPlanRow(row: {
    id: string
    organizationId: string | null
    title: string
    description: string | null
    targetAudience: string | null
    startDate: string | null
    endDate: string | null
    status: string | null
    createdBy: string | null
    createdAt: string | null
    updatedAt: string | null
  }): EducationPlanEntity {
    return {
      id: row.id,
      organization_id: row.organizationId,
      title: row.title,
      description: row.description,
      target_audience: row.targetAudience,
      start_date: row.startDate,
      end_date: row.endDate,
      status: row.status,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapRecordRow(row: {
    id: string
    planId: string | null
    attendeeId: string | null
    attendedAt: string | null
    completedAt: string | null
    score: number | null
    result: string | null
    feedback: string | null
    createdAt: string | null
    updatedAt: string | null
  }): EducationRecordEntity {
    return {
      id: row.id,
      plan_id: row.planId,
      attendee_id: row.attendeeId,
      attended_at: row.attendedAt,
      completed_at: row.completedAt,
      score: row.score,
      result: row.result,
      feedback: row.feedback,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapMaterialRow(row: {
    id: string
    organizationId: string | null
    title: string
    materialType: string | null
    url: string | null
    fileReference: string | null
    description: string | null
    createdAt: string | null
    updatedAt: string | null
  }): EducationMaterialEntity {
    return {
      id: row.id,
      organization_id: row.organizationId,
      title: row.title,
      material_type: row.materialType,
      url: row.url,
      file_reference: row.fileReference,
      description: row.description,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }
}
