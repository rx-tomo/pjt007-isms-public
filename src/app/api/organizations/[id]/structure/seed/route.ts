import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/server/auth/getUser'
import { getDb } from '@/lib/db/drizzle/client'
import { userProfiles } from '@/lib/db/drizzle/schema/users'
import { eq } from 'drizzle-orm'
import { OrganizationService, ProjectRolePayload } from '@/lib/services/organization'

interface SeedRequestBody {
  roles: ProjectRolePayload[]
}

/**
 * POST /api/organizations/[id]/structure/seed
 * 推奨体制ロールを一括登録（ウィザード用）
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // 認証チェック
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ユーザーの組織と権限をチェック
    const db = getDb()
    const [profile] = await db
      .select({
        organizationId: userProfiles.organizationId,
        role: userProfiles.role,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1)

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // 権限チェック: org_admin または system_operator のみ
    if (!['org_admin', 'system_operator'].includes(profile.role ?? '')) {
      return NextResponse.json(
        { error: 'Permission denied: requires org_admin or system_operator role' },
        { status: 403 }
      )
    }

    // 組織チェック: 自分の組織のみ操作可能
    if (profile.organizationId !== params.id) {
      return NextResponse.json(
        { error: 'Permission denied: can only seed roles for own organization' },
        { status: 403 }
      )
    }

    // リクエストボディを取得
    const body: SeedRequestBody = await request.json()

    if (!body.roles || !Array.isArray(body.roles) || body.roles.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: roles array is required' },
        { status: 400 }
      )
    }

    // サービス層を呼び出して一括登録
    const organizationService = new OrganizationService()
    const result = await organizationService.bulkUpsertProjectRoles(params.id, body.roles)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error seeding project roles:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
