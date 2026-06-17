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
    const supplier = await supplierService.getById(id)

    // Verify org scope
    if (supplier.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: supplier })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params

    // Verify ownership before update
    const existing = await supplierService.getById(id)
    if (existing.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const supplier = await supplierService.update(id, body)
    return NextResponse.json({ data: supplier })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const { id } = params

    // Verify ownership before delete
    const existing = await supplierService.getById(id)
    if (existing.organization_id !== caller.organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await supplierService.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
