import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { informationAssets } from '@/lib/db/drizzle/schema/risks'
import {
  InformationAssetService,
  isInformationAssetMutationError,
} from '@/lib/services/informationAsset'
import { authorizeTenantAction } from '@/lib/server/auth/actionPolicy'
import { resolveActiveTenantMember } from '@/lib/server/auth/targetMember'
import type { Database } from '@/types/database.types'

type AssetInsertPayload = Omit<
  Database['public']['Tables']['information_assets']['Insert'],
  'id' | 'created_at' | 'updated_at'
>
type AssetUpdatePayload = Database['public']['Tables']['information_assets']['Update']

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAssetPayload(value: unknown): AssetInsertPayload | null {
  if (!isRecord(value) || typeof value.organization_id !== 'string' || typeof value.name !== 'string') {
    return null
  }

  const name = value.name.trim()
  if (!name) {
    return null
  }

  return {
    organization_id: value.organization_id,
    name,
    asset_type: typeof value.asset_type === 'string' ? value.asset_type : 'data',
    classification: typeof value.classification === 'string' ? value.classification : 'internal',
    criticality: typeof value.criticality === 'string' ? value.criticality : 'medium',
    owner_id: typeof value.owner_id === 'string' && value.owner_id ? value.owner_id : null,
    location: typeof value.location === 'string' && value.location ? value.location : null,
    status: typeof value.status === 'string' ? value.status : 'in_use',
    description: typeof value.description === 'string' && value.description ? value.description : null,
  }
}

function parseAssetUpdates(value: unknown): AssetUpdatePayload | null {
  if (!isRecord(value)) {
    return null
  }

  const updates: AssetUpdatePayload = {}

  if (typeof value.name === 'string') {
    const name = value.name.trim()
    if (!name) return null
    updates.name = name
  }
  if (typeof value.asset_type === 'string') updates.asset_type = value.asset_type
  if (typeof value.classification === 'string') updates.classification = value.classification
  if (typeof value.criticality === 'string') updates.criticality = value.criticality
  if (typeof value.owner_id === 'string' || value.owner_id === null) {
    updates.owner_id = value.owner_id || null
  }
  if (typeof value.location === 'string') updates.location = value.location || null
  if (typeof value.status === 'string') updates.status = value.status
  if (typeof value.description === 'string') updates.description = value.description || null

  return updates
}

async function findAssetOrganization(db: ReturnType<typeof getDb>, id: string) {
  const [asset] = await db
    .select({ organizationId: informationAssets.organizationId })
    .from(informationAssets)
    .where(eq(informationAssets.id, id))
    .limit(1)

  return asset?.organizationId ?? null
}

export async function GET(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'assets'
  const organizationId = searchParams.get('organizationId')

  if (!organizationId) {
    return applyCookies(NextResponse.json({ error: 'Missing organizationId' }, { status: 400 }))
  }

  const db = getDb()
  const authorization = await authorizeTenantAction(
    db,
    user.id,
    organizationId,
    'assets.read'
  )
  if (!authorization.ok) {
    return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const service = new InformationAssetService()

  try {
    if (action === 'assets') {
      const data = await service.getAssets(organizationId)
      return applyCookies(NextResponse.json(data))
    }

    if (action === 'assetsForRisk') {
      const data = await service.getAssetsForRisk(organizationId)
      return applyCookies(NextResponse.json(data))
    }

    return applyCookies(NextResponse.json({ error: 'Unsupported action' }, { status: 400 }))
  } catch (error) {
    console.error('Information assets API GET failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to load information assets' }, { status: 500 }))
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json().catch(() => null)
    const payload = parseAssetPayload(isRecord(body) && 'asset' in body ? body.asset : body)
    if (!payload) {
      return applyCookies(badRequest('Invalid information asset payload'))
    }

    const db = getDb()
    const authorization = await authorizeTenantAction(
      db,
      user.id,
      payload.organization_id,
      'assets.create'
    )
    if (!authorization.ok) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }
    if (
      payload.owner_id
      && !await resolveActiveTenantMember(db, payload.organization_id, payload.owner_id)
    ) {
      return applyCookies(NextResponse.json({ error: 'Member not found' }, { status: 404 }))
    }

    const service = new InformationAssetService()
    const data = await service.createAssetForActor({
      organizationId: payload.organization_id,
      actorUserId: user.id,
    }, payload)
    return applyCookies(NextResponse.json(data, { status: 201 }))
  } catch (error) {
    if (isInformationAssetMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Information assets API POST failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to create information asset' }, { status: 500 }))
  }
}

export async function PATCH(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json().catch(() => null)
    const id = isRecord(body) && typeof body.id === 'string' ? body.id : null
    const updates = parseAssetUpdates(isRecord(body) && 'asset' in body ? body.asset : body)
    if (!id || !updates) {
      return applyCookies(badRequest('Invalid information asset update payload'))
    }

    const db = getDb()
    const organizationId = await findAssetOrganization(db, id)
    if (!organizationId) {
      return applyCookies(NextResponse.json({ error: 'Information asset not found' }, { status: 404 }))
    }

    const authorization = await authorizeTenantAction(
      db,
      user.id,
      organizationId,
      'assets.update'
    )
    if (!authorization.ok) {
      return applyCookies(NextResponse.json({ error: 'Information asset not found' }, { status: 404 }))
    }
    if (
      updates.owner_id
      && !await resolveActiveTenantMember(db, organizationId, updates.owner_id)
    ) {
      return applyCookies(NextResponse.json({ error: 'Member not found' }, { status: 404 }))
    }

    const service = new InformationAssetService()
    const data = await service.updateAssetForActor({
      organizationId,
      actorUserId: user.id,
    }, id, updates)
    return applyCookies(NextResponse.json(data))
  } catch (error) {
    if (isInformationAssetMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Information assets API PATCH failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to update information asset' }, { status: 500 }))
  }
}

export async function DELETE(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')
    if (!id) {
      const body = await request.json().catch(() => null)
      id = isRecord(body) && typeof body.id === 'string' ? body.id : null
    }

    if (!id) {
      return applyCookies(badRequest('Missing information asset id'))
    }

    const db = getDb()
    const organizationId = await findAssetOrganization(db, id)
    if (!organizationId) {
      return applyCookies(NextResponse.json({ error: 'Information asset not found' }, { status: 404 }))
    }

    const authorization = await authorizeTenantAction(
      db,
      user.id,
      organizationId,
      'assets.delete'
    )
    if (!authorization.ok) {
      return applyCookies(NextResponse.json({ error: 'Information asset not found' }, { status: 404 }))
    }

    const service = new InformationAssetService()
    await service.deleteAssetForActor({
      organizationId,
      actorUserId: user.id,
    }, id)
    return applyCookies(NextResponse.json({ ok: true }))
  } catch (error) {
    if (isInformationAssetMutationError(error)) {
      return applyCookies(NextResponse.json({ error: error.message }, { status: error.status }))
    }
    console.error('Information assets API DELETE failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to delete information asset' }, { status: 500 }))
  }
}
