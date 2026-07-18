import { and, eq, inArray } from 'drizzle-orm'
import type { Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import type { getDb } from '@/lib/db/drizzle/client'
import * as schema from '@/lib/db/drizzle/schema'
import { organizationDepartments, userMemberships } from '@/lib/db/drizzle/schema'

type MemberDb = ReturnType<typeof getDb>
type MemberReadDb = Pick<MemberDb, 'select'>

export class MemberTenantInvariantError extends Error {
  constructor(
    public readonly status: 400 | 404,
    message: string
  ) {
    super(message)
    this.name = 'MemberTenantInvariantError'
  }
}

export function isMemberTenantInvariantError(error: unknown): error is MemberTenantInvariantError {
  return error instanceof MemberTenantInvariantError
}

export function badMemberMutationRequest(message: string): never {
  throw new MemberTenantInvariantError(400, message)
}

export async function withImmediateMemberTransaction<T>(
  db: MemberDb,
  operation: (tx: MemberDb) => Promise<T>
): Promise<T> {
  const client = (db as unknown as { $client: Client }).$client
  const transaction = await client.transaction('write')
  const txDb = drizzle(transaction as unknown as Client, { schema })
  try {
    const result = await operation(txDb)
    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback()
    throw error
  } finally {
    transaction.close()
  }
}

export async function assertActiveOrganizationMember(
  db: MemberReadDb,
  organizationId: string,
  userId: string
): Promise<void> {
  const rows = await db
    .select({ id: userMemberships.id })
    .from(userMemberships)
    .where(and(
      eq(userMemberships.organizationId, organizationId),
      eq(userMemberships.userId, userId),
      eq(userMemberships.status, 'active')
    ))
    .limit(1)

  if (!rows[0]) {
    throw new MemberTenantInvariantError(404, 'Member not found')
  }
}

export function normalizeDepartmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    badMemberMutationRequest('departmentIds must be an array')
  }

  const normalized: string[] = []
  const seen = new Set<string>()
  for (const valueItem of value) {
    if (typeof valueItem !== 'string' || valueItem.trim() === '') {
      badMemberMutationRequest('departmentIds must contain non-empty strings')
    }
    const id = valueItem.trim()
    if (!seen.has(id)) {
      seen.add(id)
      normalized.push(id)
    }
  }
  return normalized
}

export async function assertDepartmentsBelongToOrganization(
  db: MemberReadDb,
  organizationId: string,
  departmentIds: string[]
): Promise<void> {
  if (departmentIds.length === 0) return

  const rows = await db
    .select({ id: organizationDepartments.id })
    .from(organizationDepartments)
    .where(and(
      eq(organizationDepartments.organizationId, organizationId),
      inArray(organizationDepartments.id, departmentIds)
    ))

  if (new Set(rows.map(row => row.id)).size !== departmentIds.length) {
    throw new MemberTenantInvariantError(404, 'Department not found')
  }
}
