import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { userMemberships, userProfiles } from '@/lib/db/drizzle/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { ROLE_KEYS, type RoleKey } from '@/lib/dev-login/scenarios'
import { isDevApiAvailable } from '@/lib/dev-login/availability'

export async function GET(request: NextRequest) {
  if (!isDevApiAvailable()) {
    return NextResponse.json({ error: 'Dev users API is disabled in production.' }, { status: 403 })
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const roleRaw = request.nextUrl.searchParams.get('role')
  let roleFilter: RoleKey | null = null
  if (roleRaw) {
    if (!ROLE_KEYS.includes(roleRaw as RoleKey)) {
      return NextResponse.json({ error: 'role is invalid' }, { status: 400 })
    }
    roleFilter = roleRaw as RoleKey
  }

  const db = getDb()

  try {
    // Step 1: fetch memberships
    let memberships
    if (roleFilter) {
      memberships = await db
        .select({ userId: userMemberships.userId, role: userMemberships.role, status: userMemberships.status })
        .from(userMemberships)
        .where(
          and(
            eq(userMemberships.organizationId, organizationId),
            eq(userMemberships.status, 'active'),
            eq(userMemberships.role, roleFilter)
          )
        )
        .orderBy(asc(userMemberships.role))
    } else {
      memberships = await db
        .select({ userId: userMemberships.userId, role: userMemberships.role, status: userMemberships.status })
        .from(userMemberships)
        .where(
          and(
            eq(userMemberships.organizationId, organizationId),
            eq(userMemberships.status, 'active')
          )
        )
        .orderBy(asc(userMemberships.role))
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Step 2: fetch profiles for the membership users
    const userIds = memberships.map((m) => m.userId)

    const profiles = await db
      .select({
        id: userProfiles.id,
        email: userProfiles.email,
        fullName: userProfiles.fullName,
        department: userProfiles.department,
        position: userProfiles.position,
        isActive: userProfiles.isActive,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.id, userIds))

    const profileMap = new Map<string, {
      id: string
      email: string
      full_name: string | null
      department: string | null
      position: string | null
      is_active: boolean | null
    }>()
    for (const profile of profiles) {
      profileMap.set(profile.id, {
        id: profile.id,
        email: profile.email,
        full_name: profile.fullName,
        department: profile.department,
        position: profile.position,
        is_active: profile.isActive
      })
    }

    const users = memberships
      .map((m) => {
        const profile = profileMap.get(m.userId)
        if (!profile) return null
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          department: profile.department,
          position: profile.position,
          role: m.role,
          status: m.status,
          is_active: profile.is_active
        }
      })
      .filter(Boolean)

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[DevUsers] failed to list users', error)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
