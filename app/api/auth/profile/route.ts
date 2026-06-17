import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getUser } from '@/lib/server/auth/getUser'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const db = getDb()
    const rows = await db
      .select({
        id: userProfiles.id,
        organizationId: userProfiles.organizationId,
        email: userProfiles.email,
        fullName: userProfiles.fullName,
        fullNameEn: userProfiles.fullNameEn,
        role: userProfiles.role,
        department: userProfiles.department,
        position: userProfiles.position,
        phone: userProfiles.phone,
        isActive: userProfiles.isActive,
        avatarUrl: userProfiles.avatarUrl,
        languagePreference: userProfiles.languagePreference,
        primaryDepartmentId: userProfiles.primaryDepartmentId,
        createdAt: userProfiles.createdAt,
        updatedAt: userProfiles.updatedAt,
        lastLoginAt: userProfiles.lastLoginAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1)

    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: 'profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      profile: {
        id: row.id,
        organization_id: row.organizationId,
        email: row.email,
        full_name: row.fullName,
        full_name_en: row.fullNameEn,
        role: row.role,
        department: row.department,
        position: row.position,
        phone: row.phone,
        is_active: row.isActive,
        avatar_url: row.avatarUrl,
        language_preference: row.languagePreference,
        primary_department_id: row.primaryDepartmentId,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        last_login_at: row.lastLoginAt,
      }
    })
  } catch (error) {
    console.error('[Auth/Profile] failed to resolve current profile', error)
    return NextResponse.json({ error: 'failed to resolve profile' }, { status: 500 })
  }
}
