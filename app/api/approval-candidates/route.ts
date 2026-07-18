import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/drizzle/client'
import { parseApprovalCandidatePurpose } from '@/lib/approvals/approvalCandidateContract'
import { listApprovalCandidatesForActor } from '@/lib/server/approvals/approvalCandidates'
import { getUser } from '@/lib/server/auth/getUser'

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  const purpose = parseApprovalCandidatePurpose(
    request.nextUrl.searchParams.get('purpose')
  )
  const resourceId = request.nextUrl.searchParams.get('resourceId')?.trim() || null
  const departmentId = request.nextUrl.searchParams.get('departmentId')?.trim() || null
  if (
    !organizationId
    || organizationId.length > 128
    || !purpose
    || (resourceId !== null && resourceId.length > 128)
    || (departmentId !== null && departmentId.length > 128)
    || ((purpose === 'document' || purpose === 'risk_acceptance') && resourceId === null)
    || (purpose === 'incident' && departmentId === null)
  ) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 })
  }

  try {
    const result = await listApprovalCandidatesForActor(
      getDb(),
      user.id,
      organizationId,
      purpose,
      { resourceId, departmentId }
    )
    if (!result.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      purpose,
      candidates: result.candidates,
    })
  } catch (error) {
    console.error('[ApprovalCandidates] failed to resolve candidates', error)
    return NextResponse.json(
      { error: 'failed_to_resolve_approval_candidates' },
      { status: 500 }
    )
  }
}
