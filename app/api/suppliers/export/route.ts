import { SupplierService } from '@/lib/services/supplier'
import { NextRequest, NextResponse } from 'next/server'
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg'
import { handleRouteError } from '@/lib/errors/handleRouteError'

const supplierService = new SupplierService()

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request)
  if (caller.error) return caller.error

  try {
    // Use caller's org instead of query param
    const data = await supplierService.exportSuppliers(caller.organizationId)
    return NextResponse.json({ data })
  } catch (error) {
    return handleRouteError(error)
  }
}
