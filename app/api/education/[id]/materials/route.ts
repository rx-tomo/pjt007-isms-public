import { NextRequest, NextResponse } from 'next/server'
import { EducationService } from '@/lib/services/education'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const service = new EducationService()

/**
 * POST /api/education/[id]/materials - Create a material and attach it to a plan
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const plan = await service.getPlanById(params.id)
    if (!plan || plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const material = await service.createMaterial({
      organization_id: caller.organizationId,
      title: body.title,
      material_type: body.material_type ?? 'document',
      url: body.url ?? null,
      file_reference: body.file_reference ?? null,
      description: body.description ?? null,
    })

    const existingMaterialIds = (plan.materials ?? [])
      .map((item) => item.id)
      .filter(Boolean)

    await service.setPlanMaterials(params.id, [...existingMaterialIds, material.id])

    return NextResponse.json({ data: material }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

/**
 * PATCH /api/education/[id]/materials - Replace attached material ids for a plan
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const plan = await service.getPlanById(params.id)
    if (!plan || plan.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const materialIdCandidates: unknown[] = Array.isArray(body.material_ids)
      ? body.material_ids
      : []
    const materialIds: string[] = Array.from(new Set(materialIdCandidates
      .filter((materialId): materialId is string => typeof materialId === 'string' && Boolean(materialId))))

    const orgMaterials = await service.getMaterials(caller.organizationId)
    const orgMaterialIds = new Set(orgMaterials.map(material => material.id))
    const invalidIds = materialIds.filter(materialId => !orgMaterialIds.has(materialId))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'material_ids contain materials outside your organization' }, { status: 400 })
    }

    await service.setPlanMaterials(params.id, materialIds)
    const updatedPlan = await service.getPlanById(params.id)

    return NextResponse.json({ data: updatedPlan?.materials ?? [] })
  } catch (error) {
    return handleRouteError(error)
  }
}
