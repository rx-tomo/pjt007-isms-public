import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { resolveTenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { DocumentTenantFolderService } from '@/lib/server/documents/documentTenantFolderService'
import { isDocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const allowed = new Set(fields)
  return Object.keys(value).every(key => allowed.has(key))
}

async function authorize(userId: string, organizationId: string) {
  const result = await resolveTenantAuthorizationContext(getDb(), userId, organizationId)
  return result.ok ? result.context : null
}

function mutationError(error: unknown) {
  if (isDocumentTenantInvariantError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('Document folder mutation failed')
  return NextResponse.json({ error: 'Failed to update document folder' }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const body = await request.json().catch(() => null)
  if (
    !isRecord(body)
    || !hasOnlyFields(body, ['organizationId', 'folder'])
    || typeof body.organizationId !== 'string'
    || !isRecord(body.folder)
  ) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const authorization = await authorize(user.id, body.organizationId)
  if (!authorization) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }
  try {
    const data = await new DocumentTenantFolderService().createFolder(
      authorization,
      body.folder,
      { userId: user.id, userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ data }, { status: 201 }))
  } catch (error) {
    return applyCookies(mutationError(error))
  }
}

export async function PATCH(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const body = await request.json().catch(() => null)
  if (
    !isRecord(body)
    || !hasOnlyFields(body, ['organizationId', 'folderId', 'changes'])
    || typeof body.organizationId !== 'string'
    || typeof body.folderId !== 'string'
    || !isRecord(body.changes)
  ) {
    return applyCookies(NextResponse.json({ error: 'Invalid request body' }, { status: 400 }))
  }
  const authorization = await authorize(user.id, body.organizationId)
  if (!authorization) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }
  try {
    const data = await new DocumentTenantFolderService().updateFolder(
      authorization,
      body.folderId,
      body.changes,
      { userId: user.id, userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ data }))
  } catch (error) {
    return applyCookies(mutationError(error))
  }
}

export async function DELETE(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  const folderId = request.nextUrl.searchParams.get('folderId')?.trim()
  if (!organizationId || !folderId) {
    return applyCookies(NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 }))
  }
  const authorization = await authorize(user.id, organizationId)
  if (!authorization) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }
  try {
    await new DocumentTenantFolderService().deleteFolder(
      authorization,
      folderId,
      { userId: user.id, userAgent: request.headers.get('user-agent') }
    )
    return applyCookies(NextResponse.json({ data: { id: folderId } }))
  } catch (error) {
    return applyCookies(mutationError(error))
  }
}
