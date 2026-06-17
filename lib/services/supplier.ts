import { getDb } from '@/lib/db/drizzle/client'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import { suppliers, supplierAssessments, supplierContracts, supplierIncidents } from '@/lib/db/drizzle/schema'
import { and, desc, eq } from 'drizzle-orm'

export type SupplierType = 'cloud_service' | 'outsourcing' | 'consulting' | 'hardware' | 'software' | 'other'
export type SupplierStatus = 'active' | 'inactive' | 'under_review' | 'terminated'
export type SupplierRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type AssessmentResult = 'pass' | 'fail' | 'conditional' | 'pending'
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated'

export interface SupplierRecord {
  id: string
  organization_id: string
  name: string
  type: SupplierType
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  description: string | null
  status: SupplierStatus
  risk_level: SupplierRiskLevel
  created_at: string
  updated_at: string
}

export interface SupplierAssessmentRecord {
  id: string
  supplier_id: string
  assessment_date: string
  assessor: string | null
  overall_score: string | null
  result: AssessmentResult
  findings: string | null
  next_assessment_date: string | null
  created_at: string
}

export interface SupplierContractRecord {
  id: string
  supplier_id: string
  contract_number: string | null
  title: string
  start_date: string
  end_date: string | null
  sla_details: string | null
  security_requirements: string | null
  status: ContractStatus
  created_at: string
  updated_at: string
}

export interface SupplierIncidentRecord {
  id: string
  supplier_id: string
  organization_id: string
  title: string
  description: string | null
  occurred_at: string
  severity: string
  status: string
  resolution: string | null
  created_at: string
  updated_at: string
}

/** Map Drizzle supplier row to service interface */
function mapSupplierRow(row: typeof suppliers.$inferSelect): SupplierRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    name: row.name,
    type: row.type as SupplierType,
    contact_name: row.contactName ?? null,
    contact_email: row.contactEmail ?? null,
    contact_phone: row.contactPhone ?? null,
    website: row.website ?? null,
    description: row.description ?? null,
    status: row.status as SupplierStatus,
    risk_level: row.riskLevel as SupplierRiskLevel,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapAssessmentRow(row: typeof supplierAssessments.$inferSelect): SupplierAssessmentRecord {
  return {
    id: row.id,
    supplier_id: row.supplierId,
    assessment_date: row.assessmentDate,
    assessor: row.assessor ?? null,
    overall_score: row.overallScore ?? null,
    result: row.result as AssessmentResult,
    findings: row.findings ?? null,
    next_assessment_date: row.nextAssessmentDate ?? null,
    created_at: row.createdAt,
  }
}

function mapContractRow(row: typeof supplierContracts.$inferSelect): SupplierContractRecord {
  return {
    id: row.id,
    supplier_id: row.supplierId,
    contract_number: row.contractNumber ?? null,
    title: row.title,
    start_date: row.startDate,
    end_date: row.endDate ?? null,
    sla_details: row.slaDetails ?? null,
    security_requirements: row.securityRequirements ?? null,
    status: row.status as ContractStatus,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mapIncidentRow(row: typeof supplierIncidents.$inferSelect): SupplierIncidentRecord {
  return {
    id: row.id,
    supplier_id: row.supplierId,
    organization_id: row.organizationId,
    title: row.title,
    description: row.description ?? null,
    occurred_at: row.occurredAt,
    severity: row.severity,
    status: row.status,
    resolution: row.resolution ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export class SupplierService {
  private async getSupplierByIdRaw(id: string): Promise<SupplierRecord> {
    const db = getDb()
    const rows = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id)))
      .limit(1)

    if (!rows[0]) {
      throw new NotFoundError(`Supplier not found: ${id}`)
    }

    return mapSupplierRow(rows[0])
  }

  async list(organizationId: string): Promise<SupplierRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.organizationId, organizationId))
      .orderBy(suppliers.name)

    return rows.map(mapSupplierRow)
  }

  async getById(id: string): Promise<SupplierRecord> {
    return this.getSupplierByIdRaw(id)
  }

  async create(input: {
    organization_id: string
    name: string
    type: SupplierType
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    website?: string
    description?: string
    status?: SupplierStatus
    risk_level?: SupplierRiskLevel
  }): Promise<SupplierRecord> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(suppliers)
      .values({
        id,
        organizationId: input.organization_id,
        name: input.name,
        type: input.type,
        contactName: input.contact_name ?? null,
        contactEmail: input.contact_email ?? null,
        contactPhone: input.contact_phone ?? null,
        website: input.website ?? null,
        description: input.description ?? null,
        status: input.status ?? 'active',
        riskLevel: input.risk_level ?? 'medium',
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create supplier')
    }

    return mapSupplierRow(rows[0])
  }

  async update(
    id: string,
    input: Partial<{
      name: string
      type: SupplierType
      contact_name: string | null
      contact_email: string | null
      contact_phone: string | null
      website: string | null
      description: string | null
      status: SupplierStatus
      risk_level: SupplierRiskLevel
    }>
  ): Promise<SupplierRecord> {
    const db = getDb()
    const rows = await db
      .update(suppliers)
      .set({
        name: input.name,
        type: input.type,
        contactName: input.contact_name ?? undefined,
        contactEmail: input.contact_email ?? undefined,
        contactPhone: input.contact_phone ?? undefined,
        website: input.website ?? undefined,
        description: input.description ?? undefined,
        status: input.status,
        riskLevel: input.risk_level,
      })
      .where(and(eq(suppliers.id, id)))
      .returning()

    if (!rows[0]) {
      throw new NotFoundError(`Supplier not found: ${id}`)
    }

    return mapSupplierRow(rows[0])
  }

  async delete(id: string): Promise<void> {
    const db = getDb()
    const rows = await db
      .delete(suppliers)
      .where(eq(suppliers.id, id))
      .returning({ id: suppliers.id })

    if (!rows[0]) {
      throw new NotFoundError(`Supplier not found: ${id}`)
    }
  }

  async listAssessments(supplierId: string): Promise<SupplierAssessmentRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(supplierAssessments)
      .where(and(eq(supplierAssessments.supplierId, supplierId)))
      .orderBy(desc(supplierAssessments.assessmentDate))

    return rows.map(mapAssessmentRow)
  }

  async createAssessment(input: {
    supplier_id: string
    assessment_date: string
    assessor?: string | null
    overall_score?: string | null
    result: AssessmentResult
    findings?: string | null
    next_assessment_date?: string | null
  }): Promise<SupplierAssessmentRecord> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(supplierAssessments)
      .values({
        id,
        supplierId: input.supplier_id,
        assessmentDate: input.assessment_date,
        assessor: input.assessor ?? null,
        overallScore: input.overall_score ?? null,
        result: input.result,
        findings: input.findings ?? null,
        nextAssessmentDate: input.next_assessment_date ?? null,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create supplier assessment')
    }

    return mapAssessmentRow(rows[0])
  }

  async listContracts(supplierId: string): Promise<SupplierContractRecord[]> {
    const db = getDb()
    const rows = await db
      .select()
      .from(supplierContracts)
      .where(and(eq(supplierContracts.supplierId, supplierId)))
      .orderBy(desc(supplierContracts.startDate))

    return rows.map(mapContractRow)
  }

  async createContract(input: {
    supplier_id: string
    contract_number?: string | null
    title: string
    start_date: string
    end_date?: string | null
    sla_details?: string | null
    security_requirements?: string | null
    status?: ContractStatus
  }): Promise<SupplierContractRecord> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(supplierContracts)
      .values({
        id,
        supplierId: input.supplier_id,
        contractNumber: input.contract_number ?? null,
        title: input.title,
        startDate: input.start_date,
        endDate: input.end_date ?? null,
        slaDetails: input.sla_details ?? null,
        securityRequirements: input.security_requirements ?? null,
        status: input.status ?? 'draft',
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create supplier contract')
    }

    return mapContractRow(rows[0])
  }

  async listIncidents(supplierId: string): Promise<SupplierIncidentRecord[]> {
    const supplier = await this.getSupplierByIdRaw(supplierId)

    const db = getDb()
    const rows = await db
      .select()
      .from(supplierIncidents)
      .where(
        and(
          eq(supplierIncidents.supplierId, supplierId),
          eq(supplierIncidents.organizationId, supplier.organization_id)
        )
      )
      .orderBy(desc(supplierIncidents.occurredAt))

    return rows.map(mapIncidentRow)
  }

  async createIncident(input: {
    supplier_id: string
    organization_id: string
    title: string
    description?: string | null
    occurred_at: string
    severity: string
    status?: string
    resolution?: string | null
  }): Promise<SupplierIncidentRecord> {
    const db = getDb()
    const id = crypto.randomUUID()

    const rows = await db
      .insert(supplierIncidents)
      .values({
        id,
        supplierId: input.supplier_id,
        organizationId: input.organization_id,
        title: input.title,
        description: input.description ?? null,
        occurredAt: input.occurred_at,
        severity: input.severity,
        status: input.status ?? 'open',
        resolution: input.resolution ?? null,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Failed to create supplier incident')
    }

    return mapIncidentRow(rows[0])
  }

  async exportSuppliers(organizationId: string): Promise<{
    suppliers: SupplierRecord[]
    assessments: SupplierAssessmentRecord[]
    contracts: SupplierContractRecord[]
  }> {
    const supplierRecords = await this.list(organizationId)

    const assessments = (await Promise.all(supplierRecords.map((supplier) => this.listAssessments(supplier.id))))
      .flat()

    const contracts = (await Promise.all(supplierRecords.map((supplier) => this.listContracts(supplier.id))))
      .flat()

    return {
      suppliers: supplierRecords,
      assessments,
      contracts,
    }
  }
}
