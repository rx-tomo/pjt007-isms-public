import { NextResponse } from 'next/server'
import { getUser } from '@/lib/server/auth/getUser'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const db = getDb()
    const [profile] = await db
      .select({
        id: userProfiles.id,
        organizationId: userProfiles.organizationId,
        role: userProfiles.role,
        email: userProfiles.email,
        fullName: userProfiles.fullName,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1)

    if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 })

    return NextResponse.json({
      userId: profile.id,
      organizationId: profile.organizationId,
      role: profile.role,
      email: profile.email,
      name: profile.fullName,
    })
  } catch (e) {
    return NextResponse.json({ error: 'whoami failed' }, { status: 500 })
  }
}
