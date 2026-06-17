import { SupplierService } from '@/lib/services/supplier'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const supplierService = new SupplierService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const suppliers = await supplierService.list(caller.organizationId)
    return NextResponse.json({ data: suppliers })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    const body = await request.json()

    // Force organization_id to caller's org
    const supplier = await supplierService.create({
      ...body,
      organization_id: caller.organizationId,
    })
    return NextResponse.json({ data: supplier }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
