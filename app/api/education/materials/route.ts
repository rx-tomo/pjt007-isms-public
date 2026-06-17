import { NextRequest, NextResponse } from 'next/server'
import { EducationService } from '@/lib/services/education'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

export const runtime = 'nodejs'

const service = new EducationService()

/**
 * GET /api/education/materials - List materials for the caller's organization
 */
export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const materials = await service.getMaterials(caller.organizationId)
    return NextResponse.json({ data: materials })
  } catch (error) {
    return handleRouteError(error)
  }
}

/**
 * POST /api/education/materials - Create a material for the caller's organization
 */
export async function POST(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
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

    return NextResponse.json({ data: material }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
