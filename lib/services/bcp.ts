import { getDb, type DrizzleDb } from '@/lib/db/drizzle/client'
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

export interface PlanUpdateInput {
  title?: string
  scope?: string | null
  status?: BcpPlanStatus
  version?: string | null
  last_reviewed_at?: string | null
  next_review_date?: string | null
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

export interface BcpChildBinding {
  organizationId: string
  planId: string
  childId: string
}

export type BcpParentBinding = Omit<BcpChildBinding, 'childId'>

export class BcpService {
  constructor(private readonly dbOverride?: DrizzleDb) {}

  private get db(): DrizzleDb {
    return this.dbOverride ?? getDb()
  }

  private async requestApi<T>(
    path: string,
    options: { method: 'POST' | 'PUT' | 'DELETE'; body?: unknown }
  ): Promise<T> {
    const response = await fetch(path, {
      method: options.method,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(payload.error ?? `BCP API request failed: ${response.status}`)
    }
    return response.json() as Promise<T>
  }

  private childPath(
    binding: BcpChildBinding,
    collection: 'scenarios' | 'drills' | 'recovery-objectives'
  ): string {
    return `/api/bcp/${encodeURIComponent(binding.planId)}/${collection}/${encodeURIComponent(binding.childId)}`
  }

  private collectionPath(
    binding: BcpParentBinding,
    collection: 'scenarios' | 'drills' | 'recovery-objectives'
  ): string {
    return `/api/bcp/${encodeURIComponent(binding.planId)}/${collection}`
  }

  private async assertParentBinding(binding: BcpParentBinding): Promise<void> {
    const rows = await this.db
      .select({ id: bcpPlans.id })
      .from(bcpPlans)
      .where(and(
        eq(bcpPlans.organizationId, binding.organizationId),
        eq(bcpPlans.id, binding.planId)
      ))
      .limit(1)

    if (!rows[0]) {
      throw new NotFoundError('BCP plan not found')
    }
  }

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
    const rows = await this.db
      .select()
      .from(bcpPlans)
      .where(and(eq(bcpPlans.organizationId, organizationId)))
      .orderBy(desc(bcpPlans.updatedAt))

    return rows.map(row => this.mapPlanRow(row))
  }

  async getPlanById(id: string): Promise<BcpPlanRecord> {
    const rows = await this.db
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
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await this.db
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

  // 子リソースと同じく、組織条件を検査ではなくWHEREへ入れる。呼び出し前の
  // check-then-act は、検査と実行の間に前提が変わる経路や、別の呼び出し元が
  // 増えたときに組織境界を落とす。
  async updatePlan(
    organizationId: string,
    id: string,
    input: PlanUpdateInput
  ): Promise<BcpPlanRecord> {
    if (typeof window !== 'undefined') {
      const response = await this.requestApi<{ data: BcpPlanRecord }>(
        `/api/bcp/${encodeURIComponent(id)}`,
        { method: 'PUT', body: input }
      )
      return response.data
    }

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

    const rows = await this.db
      .update(bcpPlans)
      .set(updates)
      .where(and(
        eq(bcpPlans.organizationId, organizationId),
        eq(bcpPlans.id, id)
      ))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`BCP plan not found: ${id}`)
    }

    return this.mapPlanRow(rows[0])
  }

  async deletePlan(organizationId: string, id: string): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.requestApi<{ success: true }>(
        `/api/bcp/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      return
    }

    const rows = await this.db
      .delete(bcpPlans)
      .where(and(
        eq(bcpPlans.organizationId, organizationId),
        eq(bcpPlans.id, id)
      ))
      .returning({ id: bcpPlans.id })

    if (!rows[0]) {
      throw new NotFoundError(`BCP plan not found: ${id}`)
    }
  }

  // =========================================
  // Scenarios CRUD
  // =========================================
  async listScenarios(planId: string): Promise<BcpScenarioRecord[]> {
    const rows = await this.db
      .select()
      .from(bcpScenarios)
      .where(and(eq(bcpScenarios.planId, planId)))
      .orderBy(desc(bcpScenarios.createdAt))

    return rows.map(row => this.mapScenarioRow(row))
  }

  async createScenario(binding: BcpParentBinding, input: {
    title: string
    scenario_type: BcpScenarioType
    impact_level: BcpImpactLevel
    likelihood: BcpLikelihood
    response_procedure?: string | null
  }): Promise<BcpScenarioRecord> {
    if (typeof window !== 'undefined') {
      const response = await this.requestApi<{ data: BcpScenarioRecord }>(
        this.collectionPath(binding, 'scenarios'),
        { method: 'POST', body: input }
      )
      return response.data
    }

    await this.assertParentBinding(binding)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await this.db
      .insert(bcpScenarios)
      .values({
        id,
        planId: binding.planId,
        organizationId: binding.organizationId,
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
    binding: BcpChildBinding,
    input: {
      title?: string
      scenario_type?: BcpScenarioType
      impact_level?: BcpImpactLevel
      likelihood?: BcpLikelihood
      response_procedure?: string | null
    }
  ): Promise<BcpScenarioRecord> {
    if (typeof window !== 'undefined') {
      const response = await this.requestApi<{ data: BcpScenarioRecord }>(
        this.childPath(binding, 'scenarios'),
        { method: 'PUT', body: input }
      )
      return response.data
    }

    const now = new Date().toISOString()

    const rows = await this.db
      .update(bcpScenarios)
      .set({
        title: input.title,
        scenarioType: input.scenario_type,
        impactLevel: input.impact_level,
        likelihood: input.likelihood,
        responseProcedure: input.response_procedure,
        updatedAt: now,
      })
      .where(and(
        eq(bcpScenarios.organizationId, binding.organizationId),
        eq(bcpScenarios.planId, binding.planId),
        eq(bcpScenarios.id, binding.childId)
      ))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError('BCP scenario not found')
    }

    return this.mapScenarioRow(rows[0])
  }

  async deleteScenario(binding: BcpChildBinding): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.requestApi<{ success: true }>(
        this.childPath(binding, 'scenarios'),
        { method: 'DELETE' }
      )
      return
    }

    const rows = await this.db
      .delete(bcpScenarios)
      .where(and(
        eq(bcpScenarios.organizationId, binding.organizationId),
        eq(bcpScenarios.planId, binding.planId),
        eq(bcpScenarios.id, binding.childId)
      ))
      .returning({ id: bcpScenarios.id })

    if (!rows[0]) {
      throw new NotFoundError('BCP scenario not found')
    }
  }

  // =========================================
  // Drills CRUD
  // =========================================
  async listDrills(planId: string): Promise<BcpDrillRecord[]> {
    const rows = await this.db
      .select()
      .from(bcpDrills)
      .where(and(eq(bcpDrills.planId, planId)))
      .orderBy(desc(bcpDrills.createdAt))

    return rows.map(row => this.mapDrillRow(row))
  }

  async createDrill(binding: BcpParentBinding, input: {
    title: string
    scheduled_date: string
    status?: BcpDrillStatus
    participants?: string | null
    result?: string | null
    findings?: string | null
  }): Promise<BcpDrillRecord> {
    if (typeof window !== 'undefined') {
      const response = await this.requestApi<{ data: BcpDrillRecord }>(
        this.collectionPath(binding, 'drills'),
        { method: 'POST', body: input }
      )
      return response.data
    }

    await this.assertParentBinding(binding)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await this.db
      .insert(bcpDrills)
      .values({
        id,
        planId: binding.planId,
        organizationId: binding.organizationId,
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
    binding: BcpChildBinding,
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
    if (typeof window !== 'undefined') {
      const response = await this.requestApi<{ data: BcpDrillRecord }>(
        this.childPath(binding, 'drills'),
        { method: 'PUT', body: input }
      )
      return response.data
    }

    const now = new Date().toISOString()

    const rows = await this.db
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
      .where(and(
        eq(bcpDrills.organizationId, binding.organizationId),
        eq(bcpDrills.planId, binding.planId),
        eq(bcpDrills.id, binding.childId)
      ))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError('BCP drill not found')
    }

    return this.mapDrillRow(rows[0])
  }

  async deleteDrill(binding: BcpChildBinding): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.requestApi<{ success: true }>(
        this.childPath(binding, 'drills'),
        { method: 'DELETE' }
      )
      return
    }

    const rows = await this.db
      .delete(bcpDrills)
      .where(and(
        eq(bcpDrills.organizationId, binding.organizationId),
        eq(bcpDrills.planId, binding.planId),
        eq(bcpDrills.id, binding.childId)
      ))
      .returning({ id: bcpDrills.id })

    if (!rows[0]) {
      throw new NotFoundError('BCP drill not found')
    }
  }

  // =========================================
  // Recovery Objectives CRUD
  // =========================================
  async listRecoveryObjectives(planId: string): Promise<BcpRecoveryObjectiveRecord[]> {
    const rows = await this.db
      .select()
      .from(bcpRecoveryObjectives)
      .where(and(eq(bcpRecoveryObjectives.planId, planId)))
      .orderBy(desc(bcpRecoveryObjectives.createdAt))

    return rows.map(row => this.mapRecoveryObjectiveRow(row))
  }

  async createRecoveryObjective(binding: BcpParentBinding, input: {
    target_system: string
    rto_hours: string
    rpo_hours: string
    priority?: BcpPriority
    notes?: string | null
  }): Promise<BcpRecoveryObjectiveRecord> {
    if (typeof window !== 'undefined') {
      const response = await this.requestApi<{ data: BcpRecoveryObjectiveRecord }>(
        this.collectionPath(binding, 'recovery-objectives'),
        { method: 'POST', body: input }
      )
      return response.data
    }

    await this.assertParentBinding(binding)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = await this.db
      .insert(bcpRecoveryObjectives)
      .values({
        id,
        planId: binding.planId,
        organizationId: binding.organizationId,
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
    binding: BcpChildBinding,
    input: {
      target_system?: string
      rto_hours?: string
      rpo_hours?: string
      priority?: BcpPriority
      notes?: string | null
    }
  ): Promise<BcpRecoveryObjectiveRecord> {
    if (typeof window !== 'undefined') {
      const response = await this.requestApi<{ data: BcpRecoveryObjectiveRecord }>(
        this.childPath(binding, 'recovery-objectives'),
        { method: 'PUT', body: input }
      )
      return response.data
    }

    const now = new Date().toISOString()

    const rows = await this.db
      .update(bcpRecoveryObjectives)
      .set({
        targetSystem: input.target_system,
        rtoHours: input.rto_hours,
        rpoHours: input.rpo_hours,
        priority: input.priority,
        notes: input.notes,
        updatedAt: now,
      })
      .where(and(
        eq(bcpRecoveryObjectives.organizationId, binding.organizationId),
        eq(bcpRecoveryObjectives.planId, binding.planId),
        eq(bcpRecoveryObjectives.id, binding.childId)
      ))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError('BCP recovery objective not found')
    }

    return this.mapRecoveryObjectiveRow(rows[0])
  }

  async deleteRecoveryObjective(binding: BcpChildBinding): Promise<void> {
    if (typeof window !== 'undefined') {
      await this.requestApi<{ success: true }>(
        this.childPath(binding, 'recovery-objectives'),
        { method: 'DELETE' }
      )
      return
    }

    const rows = await this.db
      .delete(bcpRecoveryObjectives)
      .where(and(
        eq(bcpRecoveryObjectives.organizationId, binding.organizationId),
        eq(bcpRecoveryObjectives.planId, binding.planId),
        eq(bcpRecoveryObjectives.id, binding.childId)
      ))
      .returning({ id: bcpRecoveryObjectives.id })

    if (!rows[0]) {
      throw new NotFoundError('BCP recovery objective not found')
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

export type ScenarioCreateInput = Parameters<BcpService['createScenario']>[1]
export type DrillCreateInput = Parameters<BcpService['createDrill']>[1]
export type RecoveryObjectiveCreateInput = Parameters<BcpService['createRecoveryObjective']>[1]
export type ScenarioUpdateInput = Parameters<BcpService['updateScenario']>[1]
export type DrillUpdateInput = Parameters<BcpService['updateDrill']>[1]
export type RecoveryObjectiveUpdateInput = Parameters<BcpService['updateRecoveryObjective']>[1]

const INVALID_OPTIONAL_TEXT = Symbol('invalid-optional-text')

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return null
  return value as Record<string, unknown>
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(record).every(key => allowedKeys.has(key))
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > maxLength) return null
  return text
}

function optionalText(
  value: unknown,
  maxLength: number
): string | null | undefined | typeof INVALID_OPTIONAL_TEXT {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return INVALID_OPTIONAL_TEXT
  const text = value.trim()
  if (text.length > maxLength) return INVALID_OPTIONAL_TEXT
  return text || null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1900 || year > 2200) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function scheduledDate(value: unknown): string | null {
  const text = requiredText(value, 40)
  if (!text || !validCalendarDate(text)) return null
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text)
  const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)
  if ((!dateOnly && !dateTime) || !Number.isFinite(Date.parse(text))) return null
  return text
}

function hourValue(value: unknown): string | null {
  const text = requiredText(value, 12)
  if (!text || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return null
  const hours = Number(text)
  if (!Number.isFinite(hours) || hours < 0 || hours > 87_600) return null
  return text
}

export function parseScenarioCreateBody(body: unknown): ScenarioCreateInput | null {
  const record = plainRecord(body)
  if (!record || !hasOnlyKeys(record, [
    'title',
    'scenario_type',
    'impact_level',
    'likelihood',
    'response_procedure',
  ])) {
    return null
  }
  const title = requiredText(record.title, 200)
  const responseProcedure = optionalText(record.response_procedure, 10_000)
  if (
    !title
    || !oneOf(record.scenario_type, [
      'natural_disaster',
      'cyber_attack',
      'system_failure',
      'pandemic',
      'supply_chain',
      'power_outage',
      'other',
    ])
    || !oneOf(record.impact_level, ['low', 'medium', 'high', 'critical'])
    || !oneOf(record.likelihood, [
      'rare',
      'unlikely',
      'possible',
      'likely',
      'almost_certain',
    ])
    || responseProcedure === INVALID_OPTIONAL_TEXT
  ) return null

  return {
    title,
    scenario_type: record.scenario_type,
    impact_level: record.impact_level,
    likelihood: record.likelihood,
    response_procedure: responseProcedure,
  }
}

export function parseDrillCreateBody(body: unknown): DrillCreateInput | null {
  const record = plainRecord(body)
  if (!record || !hasOnlyKeys(record, [
    'title',
    'scheduled_date',
    'status',
    'participants',
    'result',
    'findings',
  ])) {
    return null
  }
  const title = requiredText(record.title, 200)
  const scheduled = scheduledDate(record.scheduled_date)
  const participants = optionalText(record.participants, 10_000)
  const result = optionalText(record.result, 10_000)
  const findings = optionalText(record.findings, 10_000)
  if (
    !title
    || !scheduled
    || (record.status !== undefined
      && !oneOf(record.status, ['planned', 'in_progress', 'completed', 'cancelled']))
    || participants === INVALID_OPTIONAL_TEXT
    || result === INVALID_OPTIONAL_TEXT
    || findings === INVALID_OPTIONAL_TEXT
  ) return null

  return {
    title,
    scheduled_date: scheduled,
    status: record.status,
    participants,
    result,
    findings,
  }
}

export function parseRecoveryObjectiveCreateBody(body: unknown): RecoveryObjectiveCreateInput | null {
  const record = plainRecord(body)
  if (!record || !hasOnlyKeys(record, [
    'target_system',
    'rto_hours',
    'rpo_hours',
    'priority',
    'notes',
  ])) {
    return null
  }
  const targetSystem = requiredText(record.target_system, 200)
  const rtoHours = hourValue(record.rto_hours)
  const rpoHours = hourValue(record.rpo_hours)
  const notes = optionalText(record.notes, 10_000)
  if (
    !targetSystem
    || !rtoHours
    || !rpoHours
    || (record.priority !== undefined
      && !oneOf(record.priority, ['low', 'medium', 'high', 'critical']))
    || notes === INVALID_OPTIONAL_TEXT
  ) return null

  return {
    target_system: targetSystem,
    rto_hours: rtoHours,
    rpo_hours: rpoHours,
    priority: record.priority,
    notes,
  }
}

export function parsePlanCreateBody(
  body: unknown
): { title: string; scope?: string | null; status?: BcpPlanStatus; version?: string | null } | null {
  const record = plainRecord(body)
  const allowed = ['title', 'scope', 'status', 'version'] as const
  if (!record || !hasOnlyKeys(record, allowed)) return null

  const title = requiredText(record.title, 200)
  if (!title) return null

  const created: { title: string; scope?: string | null; status?: BcpPlanStatus; version?: string | null } = { title }
  if (hasOwn(record, 'status')) {
    if (!oneOf(record.status, ['draft', 'active', 'under_review', 'archived'])) return null
    created.status = record.status
  }
  if (hasOwn(record, 'scope')) {
    const scope = optionalText(record.scope, 10_000)
    if (scope === INVALID_OPTIONAL_TEXT || scope === undefined) return null
    created.scope = scope
  }
  if (hasOwn(record, 'version')) {
    const version = optionalText(record.version, 40)
    if (version === INVALID_OPTIONAL_TEXT || version === undefined) return null
    created.version = version
  }
  return created
}

export function parsePlanUpdateBody(body: unknown): PlanUpdateInput | null {
  const record = plainRecord(body)
  const allowed = [
    'title',
    'scope',
    'status',
    'version',
    'last_reviewed_at',
    'next_review_date',
  ] as const
  if (!record || !hasOnlyKeys(record, allowed) || Object.keys(record).length === 0) return null

  const input: PlanUpdateInput = {}
  if (hasOwn(record, 'title')) {
    const title = requiredText(record.title, 200)
    if (!title) return null
    input.title = title
  }
  if (hasOwn(record, 'status')) {
    if (!oneOf(record.status, ['draft', 'active', 'under_review', 'archived'])) return null
    input.status = record.status
  }
  if (hasOwn(record, 'scope')) {
    const scope = optionalText(record.scope, 10_000)
    if (scope === INVALID_OPTIONAL_TEXT || scope === undefined) return null
    input.scope = scope
  }
  if (hasOwn(record, 'version')) {
    const version = optionalText(record.version, 40)
    if (version === INVALID_OPTIONAL_TEXT || version === undefined) return null
    input.version = version
  }
  for (const key of ['last_reviewed_at', 'next_review_date'] as const) {
    if (!hasOwn(record, key)) continue
    if (record[key] === null) {
      input[key] = null
      continue
    }
    const date = scheduledDate(record[key])
    if (!date) return null
    input[key] = date
  }
  return input
}

export function parseScenarioUpdateBody(body: unknown): ScenarioUpdateInput | null {
  const record = plainRecord(body)
  const allowed = [
    'title',
    'scenario_type',
    'impact_level',
    'likelihood',
    'response_procedure',
  ] as const
  if (!record || !hasOnlyKeys(record, allowed) || Object.keys(record).length === 0) return null

  const input: ScenarioUpdateInput = {}
  if (hasOwn(record, 'title')) {
    const title = requiredText(record.title, 200)
    if (!title) return null
    input.title = title
  }
  if (hasOwn(record, 'scenario_type')) {
    if (!oneOf(record.scenario_type, [
      'natural_disaster',
      'cyber_attack',
      'system_failure',
      'pandemic',
      'supply_chain',
      'power_outage',
      'other',
    ])) return null
    input.scenario_type = record.scenario_type
  }
  if (hasOwn(record, 'impact_level')) {
    if (!oneOf(record.impact_level, ['low', 'medium', 'high', 'critical'])) return null
    input.impact_level = record.impact_level
  }
  if (hasOwn(record, 'likelihood')) {
    if (!oneOf(record.likelihood, [
      'rare',
      'unlikely',
      'possible',
      'likely',
      'almost_certain',
    ])) return null
    input.likelihood = record.likelihood
  }
  if (hasOwn(record, 'response_procedure')) {
    const responseProcedure = optionalText(record.response_procedure, 10_000)
    if (responseProcedure === INVALID_OPTIONAL_TEXT || responseProcedure === undefined) return null
    input.response_procedure = responseProcedure
  }
  return input
}

export function parseDrillUpdateBody(body: unknown): DrillUpdateInput | null {
  const record = plainRecord(body)
  const allowed = [
    'title',
    'scheduled_date',
    'conducted_date',
    'status',
    'participants',
    'result',
    'findings',
  ] as const
  if (!record || !hasOnlyKeys(record, allowed) || Object.keys(record).length === 0) return null

  const input: DrillUpdateInput = {}
  if (hasOwn(record, 'title')) {
    const title = requiredText(record.title, 200)
    if (!title) return null
    input.title = title
  }
  if (hasOwn(record, 'scheduled_date')) {
    const scheduled = scheduledDate(record.scheduled_date)
    if (!scheduled) return null
    input.scheduled_date = scheduled
  }
  if (hasOwn(record, 'conducted_date')) {
    if (record.conducted_date === null) {
      input.conducted_date = null
    } else {
      const conducted = scheduledDate(record.conducted_date)
      if (!conducted) return null
      input.conducted_date = conducted
    }
  }
  if (hasOwn(record, 'status')) {
    if (!oneOf(record.status, ['planned', 'in_progress', 'completed', 'cancelled'])) return null
    input.status = record.status
  }
  for (const key of ['participants', 'result', 'findings'] as const) {
    if (!hasOwn(record, key)) continue
    const value = optionalText(record[key], 10_000)
    if (value === INVALID_OPTIONAL_TEXT || value === undefined) return null
    input[key] = value
  }
  return input
}

export function parseRecoveryObjectiveUpdateBody(
  body: unknown
): RecoveryObjectiveUpdateInput | null {
  const record = plainRecord(body)
  const allowed = ['target_system', 'rto_hours', 'rpo_hours', 'priority', 'notes'] as const
  if (!record || !hasOnlyKeys(record, allowed) || Object.keys(record).length === 0) return null

  const input: RecoveryObjectiveUpdateInput = {}
  if (hasOwn(record, 'target_system')) {
    const targetSystem = requiredText(record.target_system, 200)
    if (!targetSystem) return null
    input.target_system = targetSystem
  }
  for (const key of ['rto_hours', 'rpo_hours'] as const) {
    if (!hasOwn(record, key)) continue
    const hours = hourValue(record[key])
    if (!hours) return null
    input[key] = hours
  }
  if (hasOwn(record, 'priority')) {
    if (!oneOf(record.priority, ['low', 'medium', 'high', 'critical'])) return null
    input.priority = record.priority
  }
  if (hasOwn(record, 'notes')) {
    const notes = optionalText(record.notes, 10_000)
    if (notes === INVALID_OPTIONAL_TEXT || notes === undefined) return null
    input.notes = notes
  }
  return input
}
