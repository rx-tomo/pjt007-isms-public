import type {
  SupplierContractRecord,
  SupplierRecord,
} from '@/lib/services/supplier'

export function isSupplierVisibleToOrganization(
  supplier: Pick<SupplierRecord, 'organization_id'>,
  organizationId: string
): boolean {
  return supplier.organization_id === organizationId
}

export function projectSupplierContracts(
  contracts: SupplierContractRecord[]
): { contracts: SupplierContractRecord[] } {
  return { contracts }
}
