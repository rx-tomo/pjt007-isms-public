import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { getDb } from '@/lib/db/drizzle/client'
import { organizations, userProfiles, userMemberships, auditLogs } from '@/lib/db/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createDefaultCategories } from '@/lib/services/defaultCategories'

export async function POST(request: NextRequest) {
  // Verify the caller is an authenticated user
  const { user, applyCookies } = await getRouteAuth(request)

  if (!user) {
    return applyCookies(NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    ))
  }

  try {
    const body = await request.json()
    const { userId, email, fullName, organizationName, language } = body

    if (!userId || !email || !fullName || !organizationName) {
      return applyCookies(NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      ))
    }

    // Ensure the authenticated user matches the userId in the request
    if (user.id !== userId) {
      return applyCookies(NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      ))
    }

    const db = getDb()
    const orgId = crypto.randomUUID()
    const now = new Date().toISOString()
    const trialEnds = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Create organization
    try {
      await db.insert(organizations).values({
        id: orgId,
        name: organizationName,
        subscriptionPlan: 'trial',
        trialEndsAt: trialEnds,
        createdAt: now,
        updatedAt: now,
      })
    } catch (orgError) {
      console.error('Organization creation error:', orgError)
      return applyCookies(NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      ))
    }

    // 2. Create user profile
    try {
      await db.insert(userProfiles).values({
        id: userId,
        organizationId: orgId,
        email: email,
        fullName: fullName,
        role: 'org_admin',
        languagePreference: language || 'ja',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    } catch (profileError) {
      console.error('Profile creation error:', profileError)
      // Rollback org
      await db.delete(organizations).where(eq(organizations.id, orgId))
      return applyCookies(NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      ))
    }

    // 3. Create membership
    try {
      await db.insert(userMemberships).values({
        id: crypto.randomUUID(),
        userId: userId,
        organizationId: orgId,
        role: 'org_admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    } catch (membershipError) {
      console.error('Membership creation error:', membershipError)
      await db.delete(userProfiles).where(eq(userProfiles.id, userId))
      await db.delete(organizations).where(eq(organizations.id, orgId))
      return applyCookies(NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 }
      ))
    }

    // 4. Create default categories
    await createDefaultCategories(db, orgId)

    // 5. Audit log
    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId: userId,
        action: 'organization.created',
        resourceType: 'organization',
        resourceId: orgId,
        changes: JSON.stringify({
          organization_name: organizationName,
          first_user: email
        }),
        createdAt: now,
      })
    } catch (auditError) {
      console.error('Audit log creation error:', auditError)
    }

    return applyCookies(NextResponse.json({
      success: true,
      organizationId: orgId
    }))

  } catch (error) {
    console.error('Signup API error:', error)
    return applyCookies(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ))
  }
}
