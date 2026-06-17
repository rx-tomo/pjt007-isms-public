import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles, userMemberships } from '@/lib/db/drizzle/schema'
import { informationAssets } from '@/lib/db/drizzle/schema/risks'
import { InformationAssetService } from '@/lib/services/informationAsset'
import type { Database } from '@/types/database.types'

const assetManagerRoles = new Set(['system_operator', 'org_admin'])

type AssetInsertPayload = Omit<
  Database['public']['Tables']['information_assets']['Insert'],
  'id' | 'created_at' | 'updated_at'
>
type AssetUpdatePayload = Database['public']['Tables']['information_assets']['Update']

async function getOrganizationAccess(db: ReturnType<typeof getDb>, userId: string, organizationId: string) {
  const [[profile], [membership]] = await Promise.all([
    db
      .select({
        organizationId: userProfiles.organizationId,
        role: userProfiles.role,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),
    db
      .select({
        id: userMemberships.id,
        role: userMemberships.role,
      })
      .from(userMemberships)
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.organizationId, organizationId),
        eq(userMemberships.status, 'active')
      ))
      .limit(1),
  ])

  const profileAccess = profile?.organizationId === organizationId
  const membershipAccess = Boolean(membership)
  const role = membership?.role ?? (profileAccess ? profile?.role : null)

  return {
    hasAccess: profileAccess || membershipAccess,
    canManage: Boolean(role && assetManagerRoles.has(role)),
  }
}

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
  if (typeof value.owner_id === 'string') updates.owner_id = value.owner_id || null
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
  const access = await getOrganizationAccess(db, user.id, organizationId)
  if (!access.hasAccess) {
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
    const access = await getOrganizationAccess(db, user.id, payload.organization_id)
    if (!access.hasAccess || !access.canManage) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }

    const service = new InformationAssetService()
    const data = await service.createAsset(payload)
    return applyCookies(NextResponse.json(data, { status: 201 }))
  } catch (error) {
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

    const access = await getOrganizationAccess(db, user.id, organizationId)
    if (!access.hasAccess || !access.canManage) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }

    const service = new InformationAssetService()
    const data = await service.updateAsset(id, updates)
    return applyCookies(NextResponse.json(data))
  } catch (error) {
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

    const access = await getOrganizationAccess(db, user.id, organizationId)
    if (!access.hasAccess || !access.canManage) {
      return applyCookies(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    }

    const service = new InformationAssetService()
    await service.deleteAsset(id)
    return applyCookies(NextResponse.json({ ok: true }))
  } catch (error) {
    console.error('Information assets API DELETE failed', error)
    return applyCookies(NextResponse.json({ error: 'Failed to delete information asset' }, { status: 500 }))
  }
}
