import { NextRequest, NextResponse } from 'next/server'
import { EducationService } from '@/lib/services/education'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const service = new EducationService()

async function findCallerMaterial(organizationId: string, materialId: string) {
  const materials = await service.getMaterials(organizationId)
  return materials.find(material => material.id === materialId) ?? null
}

/**
 * PUT /api/education/materials/[materialId] - Update a material in the caller's organization.
 */
export async function PUT(request: NextRequest, props: { params: Promise<{ materialId: string }> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const existing = await findCallerMaterial(caller.organizationId, params.materialId)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    if (typeof body.title === 'string' && !body.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const material = await service.updateMaterial(params.materialId, {
      title: typeof body.title === 'string' ? body.title.trim() : undefined,
      material_type: body.material_type ?? undefined,
      url: body.url ?? undefined,
      file_reference: body.file_reference ?? undefined,
      description: body.description ?? undefined,
    })

    return NextResponse.json({ data: material })
  } catch (error) {
    return handleRouteError(error)
  }
}

/**
 * DELETE /api/education/materials/[materialId] - Delete a material in the caller's organization.
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ materialId: string }> }) {
  const params = await props.params
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const existing = await findCallerMaterial(caller.organizationId, params.materialId)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await service.deleteMaterial(params.materialId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
