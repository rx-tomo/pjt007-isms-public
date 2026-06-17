import { getDb } from '@/lib/db/drizzle/client'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import {
  bcpDrills,
  bcpPlans,
  bcpRecoveryObjectives,
  bcpScenarios,
} from '@/lib/db/drizzle/schema'
import { and, desc, eq } from 'drizzle-orm'

export type BcpPlanStatus = 'draft' | 'active' | 'under_review' | 'archived'
export type BcpDrillStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type BcpScenarioType =
  | 'natural_disaster'
  | 'cyber_attack'
  | 'system_failure'
  | 'pandemic'
  | 'supply_chain'
  | 'power_outage'
  | 'other'
export type BcpImpactLevel = 'low' | 'medium' | 'high' | 'critical'
export type BcpLikelihood = 'rare' | 'unlikely' | 'possible' | 'likely' | 'almost_certain'
export type BcpPriority = 'low' | 'medium' | 'high' | 'critical'

export interface BcpPlanRecord {
  id: string
  organization_id: string
  title: string
  scope: string | null
  status: BcpPlanStatus
  version: string | null
  last_reviewed_at: string | null
  next_review_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BcpScenarioRecord {
  id: string
  plan_id: string
  organization_id: string
  title: string
  scenario_type: BcpScenarioType
  impact_level: BcpImpactLevel
  likelihood: BcpLikelihood
  response_procedure: string | null
  created_at: string
  updated_at: string
}

export interface BcpDrillRecord {
  id: string
  plan_id: string
  organization_id: string
  title: string
  scheduled_date: string
  conducted_date: string | null
  status: BcpDrillStatus
  participants: string | null
  result: string | null
  findings: string | null
  created_at: string
  updated_at: string
}

export interface BcpRecoveryObjectiveRecord {
  id: string
  plan_id: string
  organization_id: string
  target_system: string
  rto_hours: string
  rpo_hours: string
  priority: BcpPriority
  notes: string | null
  created_at: string
  updated_at: string
}

export class BcpService {
  private mapPlanRow(row: typeof bcpPlans.$inferSelect): BcpPlanRecord {
    return {
      id: row.id,
      organization_id: row.organizationId,
      title: row.title,
      scope: row.scope ?? null,
      status: row.status as BcpPlanStatus,
      version: row.version ?? null,
      last_reviewed_at: row.lastReviewedAt ?? null,
      next_review_date: row.nextReviewDate ?? null,
      created_by: row.createdBy ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapScenarioRow(row: typeof bcpScenarios.$inferSelect): BcpScenarioRecord {
    return {
      id: row.id,
      plan_id: row.planId,
      organization_id: row.organizationId,
      title: row.title,
      scenario_type: row.scenarioType as BcpScenarioType,
      impact_level: row.impactLevel as BcpImpactLevel,
      likelihood: row.likelihood as BcpLikelihood,
      response_procedure: row.responseProcedure ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapDrillRow(row: typeof bcpDrills.$inferSelect): BcpDrillRecord {
    return {
      id: row.id,
      plan_id: row.planId,
      organization_id: row.organizationId,
      title: row.title,
      scheduled_date: row.scheduledDate,
      conducted_date: row.conductedDate ?? null,
      status: row.status as BcpDrillStatus,
      participants: row.participants ?? null,
      result: row.result ?? null,
      findings: row.findings ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapRecoveryObjectiveRow(
    row: typeof bcpRecoveryObjectives.$inferSelect
  ): BcpRecoveryObjectiveRecord {
    return {
      id: row.id,
      plan_id: row.planId,
      organization_id: row.organizationId,
      target_system: row.targetSystem,
      rto_hours: row.rtoHours,
      rpo_hours: row.rpoHours,
      priority: row.priority as BcpPriority,
      notes: row.notes ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  // =========================================
  // Plans CRUD
  // =========================================
  async listPlans(organizationId: string): Promise<BcpPlanRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(bcpPlans)
      .where(and(eq(bcpPlans.organizationId, organizationId)))
      .orderBy(desc(bcpPlans.updatedAt))

    return rows.map(row => this.mapPlanRow(row))
  }

  async getPlanById(id: string): Promise<BcpPlanRecord> {
    const db = getDb()
    const rows = await db
      .select()
      .from(bcpPlans)
      .where(eq(bcpPlans.id, id))
      .limit(1)

    if (!rows[0]) {
      throw new NotFoundError(`BCP plan not found: ${id}`)
    }

    return this.mapPlanRow(rows[0])
  }

  async createPlan(input: {
    organization_id: string
    title: string
    scope?: string | null
    status?: BcpPlanStatus
    version?: string | null
    created_by?: string | null
  }): Promise<BcpPlanRecord> {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await db
      .insert(bcpPlans)
      .values({
        id,
        organizationId: input.organization_id,
        title: input.title,
        scope: input.scope ?? null,
        status: input.status ?? 'draft',
        version: input.version ?? null,
        createdBy: input.created_by ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create BCP plan')
    }

    return this.mapPlanRow(rows[0])
  }

  async updatePlan(
    id: string,
    input: {
      title?: string
      scope?: string | null
      status?: BcpPlanStatus
      version?: string | null
      last_reviewed_at?: string | null
      next_review_date?: string | null
    }
  ): Promise<BcpPlanRecord> {
    const db = getDb()
    const now = new Date().toISOString()

    const updates = {
      title: input.title,
      scope: input.scope,
      status: input.status,
      version: input.version,
      lastReviewedAt: input.last_reviewed_at,
      nextReviewDate: input.next_review_date,
      updatedAt: now,
    }

    const rows = await db
      .update(bcpPlans)
      .set(updates)
      .where(eq(bcpPlans.id, id))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`BCP plan not found: ${id}`)
    }

    return this.mapPlanRow(rows[0])
  }

  async deletePlan(id: string): Promise<void> {
    const db = getDb()

    const rows = await db
      .delete(bcpPlans)
      .where(eq(bcpPlans.id, id))
      .returning({ id: bcpPlans.id })

    if (!rows[0]) {
      throw new NotFoundError(`BCP plan not found: ${id}`)
    }
  }

  // =========================================
  // Scenarios CRUD
  // =========================================
  async listScenarios(planId: string): Promise<BcpScenarioRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(bcpScenarios)
      .where(and(eq(bcpScenarios.planId, planId)))
      .orderBy(desc(bcpScenarios.createdAt))

    return rows.map(row => this.mapScenarioRow(row))
  }

  async createScenario(input: {
    plan_id: string
    organization_id: string
    title: string
    scenario_type: BcpScenarioType
    impact_level: BcpImpactLevel
    likelihood: BcpLikelihood
    response_procedure?: string | null
  }): Promise<BcpScenarioRecord> {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await db
      .insert(bcpScenarios)
      .values({
        id,
        planId: input.plan_id,
        organizationId: input.organization_id,
        title: input.title,
        scenarioType: input.scenario_type,
        impactLevel: input.impact_level,
        likelihood: input.likelihood,
        responseProcedure: input.response_procedure ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create BCP scenario')
    }

    return this.mapScenarioRow(rows[0])
  }

  async updateScenario(
    id: string,
    input: {
      title?: string
      scenario_type?: BcpScenarioType
      impact_level?: BcpImpactLevel
      likelihood?: BcpLikelihood
      response_procedure?: string | null
    }
  ): Promise<BcpScenarioRecord> {
    const db = getDb()
    const now = new Date().toISOString()

    const rows = await db
      .update(bcpScenarios)
      .set({
        title: input.title,
        scenarioType: input.scenario_type,
        impactLevel: input.impact_level,
        likelihood: input.likelihood,
        responseProcedure: input.response_procedure,
        updatedAt: now,
      })
      .where(eq(bcpScenarios.id, id))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`BCP scenario not found: ${id}`)
    }

    return this.mapScenarioRow(rows[0])
  }

  async deleteScenario(id: string): Promise<void> {
    const db = getDb()

    const rows = await db
      .delete(bcpScenarios)
      .where(eq(bcpScenarios.id, id))
      .returning({ id: bcpScenarios.id })

    if (!rows[0]) {
      throw new NotFoundError(`BCP scenario not found: ${id}`)
    }
  }

  // =========================================
  // Drills CRUD
  // =========================================
  async listDrills(planId: string): Promise<BcpDrillRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(bcpDrills)
      .where(and(eq(bcpDrills.planId, planId)))
      .orderBy(desc(bcpDrills.createdAt))

    return rows.map(row => this.mapDrillRow(row))
  }

  async createDrill(input: {
    plan_id: string
    organization_id: string
    title: string
    scheduled_date: string
    status?: BcpDrillStatus
    participants?: string | null
    result?: string | null
    findings?: string | null
  }): Promise<BcpDrillRecord> {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await db
      .insert(bcpDrills)
      .values({
        id,
        planId: input.plan_id,
        organizationId: input.organization_id,
        title: input.title,
        scheduledDate: input.scheduled_date,
        status: input.status ?? 'planned',
        participants: input.participants ?? null,
        result: input.result ?? null,
        findings: input.findings ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create BCP drill')
    }

    return this.mapDrillRow(rows[0])
  }

  async updateDrill(
    id: string,
    input: {
      title?: string
      scheduled_date?: string
      conducted_date?: string | null
      status?: BcpDrillStatus
      participants?: string | null
      result?: string | null
      findings?: string | null
    }
  ): Promise<BcpDrillRecord> {
    const db = getDb()
    const now = new Date().toISOString()

    const rows = await db
      .update(bcpDrills)
      .set({
        title: input.title,
        scheduledDate: input.scheduled_date,
        conductedDate: input.conducted_date,
        status: input.status,
        participants: input.participants,
        result: input.result,
        findings: input.findings,
        updatedAt: now,
      })
      .where(eq(bcpDrills.id, id))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`BCP drill not found: ${id}`)
    }

    return this.mapDrillRow(rows[0])
  }

  async deleteDrill(id: string): Promise<void> {
    const db = getDb()

    const rows = await db
      .delete(bcpDrills)
      .where(eq(bcpDrills.id, id))
      .returning({ id: bcpDrills.id })

    if (!rows[0]) {
      throw new NotFoundError(`BCP drill not found: ${id}`)
    }
  }

  // =========================================
  // Recovery Objectives CRUD
  // =========================================
  async listRecoveryObjectives(planId: string): Promise<BcpRecoveryObjectiveRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(bcpRecoveryObjectives)
      .where(and(eq(bcpRecoveryObjectives.planId, planId)))
      .orderBy(desc(bcpRecoveryObjectives.createdAt))

    return rows.map(row => this.mapRecoveryObjectiveRow(row))
  }

  async createRecoveryObjective(input: {
    plan_id: string
    organization_id: string
    target_system: string
    rto_hours: string
    rpo_hours: string
    priority?: BcpPriority
    notes?: string | null
  }): Promise<BcpRecoveryObjectiveRecord> {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await db
      .insert(bcpRecoveryObjectives)
      .values({
        id,
        planId: input.plan_id,
        organizationId: input.organization_id,
        targetSystem: input.target_system,
        rtoHours: input.rto_hours,
        rpoHours: input.rpo_hours,
        priority: input.priority ?? 'medium',
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create BCP recovery objective')
    }

    return this.mapRecoveryObjectiveRow(rows[0])
  }

  async updateRecoveryObjective(
    id: string,
    input: {
      target_system?: string
      rto_hours?: string
      rpo_hours?: string
      priority?: BcpPriority
      notes?: string | null
    }
  ): Promise<BcpRecoveryObjectiveRecord> {
    const db = getDb()
    const now = new Date().toISOString()

    const rows = await db
      .update(bcpRecoveryObjectives)
      .set({
        targetSystem: input.target_system,
        rtoHours: input.rto_hours,
        rpoHours: input.rpo_hours,
        priority: input.priority,
        notes: input.notes,
        updatedAt: now,
      })
      .where(eq(bcpRecoveryObjectives.id, id))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`BCP recovery objective not found: ${id}`)
    }

    return this.mapRecoveryObjectiveRow(rows[0])
  }

  async deleteRecoveryObjective(id: string): Promise<void> {
    const db = getDb()

    const rows = await db
      .delete(bcpRecoveryObjectives)
      .where(eq(bcpRecoveryObjectives.id, id))
      .returning({ id: bcpRecoveryObjectives.id })

    if (!rows[0]) {
      throw new NotFoundError(`BCP recovery objective not found: ${id}`)
    }
  }

  async exportPlan(id: string): Promise<{
    plan: BcpPlanRecord
    scenarios: BcpScenarioRecord[]
    drills: BcpDrillRecord[]
    recoveryObjectives: BcpRecoveryObjectiveRecord[]
  }> {
    const plan = await this.getPlanById(id)

    const [scenarios, drills, recoveryObjectives] = await Promise.all([
      this.listScenarios(id),
      this.listDrills(id),
      this.listRecoveryObjectives(id),
    ])

    return {
      plan,
      scenarios,
      drills,
      recoveryObjectives,
    }
  }
}
