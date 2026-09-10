import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/errors/handleRouteError'
import { getDb } from '@/lib/db/drizzle/client'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { SupplierService } from '@/lib/services/supplier'
import {
  isSupplierVisibleToOrganization,
  projectSupplierContracts,
} from '@/lib/server/suppliers/supplierContractProjection'

const supplierService = new SupplierService()

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { id } = await props.params
    const supplier = await supplierService.getById(id)
    const authorization = await resolveTenantAuthorizationContext(
      getDb(),
      user.id,
      supplier.organization_id
    )
    if (
      !authorization.ok
      || !isSupplierVisibleToOrganization(
        supplier,
        authorization.context.organizationId
      )
    ) {
      return applyCookies(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    const contracts = await supplierService.listContracts(id)
    return applyCookies(NextResponse.json(projectSupplierContracts(contracts)))
  } catch (error) {
    return applyCookies(handleRouteError(error))
  }
}
