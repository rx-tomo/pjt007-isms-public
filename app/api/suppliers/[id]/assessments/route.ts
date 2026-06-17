import { SupplierService } from '@/lib/services/supplier'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const supplierService = new SupplierService()

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params

    // Verify parent supplier belongs to caller's org
    const supplier = await supplierService.getById(id)
    if (supplier.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const assessments = await supplierService.listAssessments(id)
    return NextResponse.json({ data: assessments })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params

    // Verify parent supplier belongs to caller's org
    const supplier = await supplierService.getById(id)
    if (supplier.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const assessment = await supplierService.createAssessment({
      ...body,
      supplier_id: id,
    })
    return NextResponse.json({ data: assessment }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
