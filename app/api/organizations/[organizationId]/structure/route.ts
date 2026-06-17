import { NextRequest, NextResponse } from 'next/server'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { OrganizationService } from '@/lib/services/organization'
import { UserService } from '@/lib/services/user'

type Params = { organizationId: string }

const VALID_ROLE_FLAGS = ['is_security_manager', 'is_audit_committee', 'is_isms_promoter'] as const
type RoleFlag = typeof VALID_ROLE_FLAGS[number]

// ---------------------------------------------------------------------------
// GET /api/organizations/[organizationId]/structure?action=<action>
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params;
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId: params.organizationId,
    actionName: 'organization.structure.read',
    logContext: { organizationId: params.organizationId },
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { organizationId } = params
  const action = request.nextUrl.searchParams.get('action')
  const service = new OrganizationService()
  const userService = new UserService()

  try {
    switch (action) {
      case 'projectStructure': {
        const structure = await service.getProjectStructure(organizationId)
        return guard.json(structure)
      }

      case 'projectRoles': {
        const roles = await service.getProjectRoles(organizationId)
        return guard.json(roles)
      }

      case 'projectAssignments': {
        const assignments = await service.getProjectAssignments(organizationId)
        return guard.json(assignments)
      }

      case 'members': {
        const members = await service.getOrganizationMembers(organizationId)
        return guard.json(members)
      }

      case 'pendingInvitations': {
        const invitations = await userService.getPendingInvitations(organizationId)
        return guard.json(invitations)
      }

      case 'ciso': {
        const ciso = await service.getCurrentCiso(organizationId)
        return guard.json({ ciso })
      }

      case 'snapshots': {
        const snapshots = await service.getStructureSnapshots(organizationId)
        return guard.json(snapshots)
      }

      case 'memberFlags': {
        const members = await service.getMembersWithRoleFlags(organizationId)
        return guard.json(members)
      }

      default:
        return guard.json(
          { error: `Invalid action: ${action}. Valid actions: projectStructure, projectRoles, projectAssignments, members, pendingInvitations, ciso, snapshots, memberFlags` },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error(`[Structure GET] action=${action} failed`, err)
    return guard.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/organizations/[organizationId]/structure
// body.action determines the operation
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, props: { params: Promise<Params> }) {
  const params = await props.params;
  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['super_admin', 'system_operator', 'org_admin'],
    organizationId: params.organizationId,
    actionName: 'organization.structure.write',
    logContext: { organizationId: params.organizationId },
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { organizationId } = params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return guard.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const action = body.action as string | undefined
  if (!action) {
    return guard.json({ error: 'Missing action in request body' }, { status: 400 })
  }

  const service = new OrganizationService()

  try {
    switch (action) {
      case 'setCiso': {
        const userId = body.userId as string | undefined
        if (!userId || typeof userId !== 'string') {
          return guard.json({ error: 'userId is required for setCiso' }, { status: 400 })
        }
        await service.setCiso(organizationId, userId)
        return guard.json({ status: 'ok' })
      }

      case 'clearCiso': {
        await service.clearCiso(organizationId)
        return guard.json({ status: 'ok' })
      }

      case 'bulkUpdateRoleFlags': {
        const roleFlag = body.roleFlag as string | undefined
        const enabledMemberIds = body.enabledMemberIds

        if (!roleFlag || !VALID_ROLE_FLAGS.includes(roleFlag as RoleFlag)) {
          return guard.json(
            { error: `Invalid roleFlag. Valid values: ${VALID_ROLE_FLAGS.join(', ')}` },
            { status: 400 }
          )
        }
        if (!Array.isArray(enabledMemberIds) || !enabledMemberIds.every(id => typeof id === 'string')) {
          return guard.json(
            { error: 'enabledMemberIds must be an array of strings' },
            { status: 400 }
          )
        }

        const result = await service.bulkUpdateRoleFlags(
          organizationId,
          roleFlag as RoleFlag,
          enabledMemberIds as string[]
        )
        return guard.json({ status: 'ok', updated: result.updated })
      }

      case 'createProjectRole': {
        const payload = body.payload as Record<string, unknown> | undefined
        if (!payload || typeof payload !== 'object') {
          return guard.json({ error: 'payload object is required for createProjectRole' }, { status: 400 })
        }
        const role = await service.createProjectRole(organizationId, payload as any)
        return guard.json(role)
      }

      case 'updateProjectRole': {
        const roleId = body.roleId as string | undefined
        const payload = body.payload as Record<string, unknown> | undefined
        if (!roleId || typeof roleId !== 'string') {
          return guard.json({ error: 'roleId is required for updateProjectRole' }, { status: 400 })
        }
        if (!payload || typeof payload !== 'object') {
          return guard.json({ error: 'payload object is required for updateProjectRole' }, { status: 400 })
        }
        const role = await service.updateProjectRole(organizationId, roleId, payload as any)
        return guard.json(role)
      }

      case 'deleteProjectRole': {
        const roleId = body.roleId as string | undefined
        if (!roleId || typeof roleId !== 'string') {
          return guard.json({ error: 'roleId is required for deleteProjectRole' }, { status: 400 })
        }
        await service.deleteProjectRole(organizationId, roleId)
        return guard.json({ status: 'ok' })
      }

      case 'setRoleAssignments': {
        const roleId = body.roleId as string | undefined
        const userIds = body.userIds
        const invitationIds = body.invitationIds
        if (!roleId || typeof roleId !== 'string') {
          return guard.json({ error: 'roleId is required for setRoleAssignments' }, { status: 400 })
        }
        if (!Array.isArray(userIds) || !userIds.every(id => typeof id === 'string')) {
          return guard.json({ error: 'userIds must be an array of strings' }, { status: 400 })
        }
        if (invitationIds !== undefined && (!Array.isArray(invitationIds) || !invitationIds.every(id => typeof id === 'string'))) {
          return guard.json({ error: 'invitationIds must be an array of strings' }, { status: 400 })
        }
        await service.setRoleAssignments({
          organizationId,
          roleId,
          userIds: userIds as string[],
          invitationIds: invitationIds as string[] | undefined,
          note: typeof body.note === 'string' ? body.note : null
        })
        return guard.json({ status: 'ok' })
      }

      case 'syncProjectAssignments': {
        const roleIds = body.roleIds
        const userId = body.userId as string | undefined
        const invitationId = body.invitationId as string | undefined
        if (!Array.isArray(roleIds) || !roleIds.every(id => typeof id === 'string')) {
          return guard.json({ error: 'roleIds must be an array of strings' }, { status: 400 })
        }
        await service.syncProjectAssignments({
          organizationId,
          roleIds: roleIds as string[],
          userId,
          invitationId,
          note: typeof body.note === 'string' ? body.note : null
        })
        return guard.json({ status: 'ok' })
      }

      case 'bulkUpsertProjectRoles': {
        const roles = body.roles
        if (!Array.isArray(roles)) {
          return guard.json({ error: 'roles must be an array' }, { status: 400 })
        }
        const result = await service.bulkUpsertProjectRoles(organizationId, roles as any)
        return guard.json(result)
      }

      case 'createSnapshot': {
        const snapshotName = body.snapshotName as string | undefined
        if (!snapshotName || typeof snapshotName !== 'string') {
          return guard.json({ error: 'snapshotName is required for createSnapshot' }, { status: 400 })
        }
        const snapshot = await service.createStructureSnapshot(organizationId, snapshotName)
        return guard.json({ status: 'ok', id: snapshot.id })
      }

      case 'compareSnapshots': {
        const snapshotId1 = body.snapshotId1 as string | undefined
        const snapshotId2 = body.snapshotId2 as string | undefined
        if (!snapshotId1 || !snapshotId2) {
          return guard.json({ error: 'snapshotId1 and snapshotId2 are required' }, { status: 400 })
        }
        const diff = await service.compareSnapshots(snapshotId1, snapshotId2, organizationId)
        return guard.json(diff)
      }

      case 'updateMembershipRole': {
        const userId = body.userId as string | undefined
        const role = body.role as string | undefined
        if (!userId || !role) {
          return guard.json({ error: 'userId and role are required' }, { status: 400 })
        }
        const ALLOWED_ROLES = ['org_admin', 'user', 'auditor', 'approver'] as const
        if (!ALLOWED_ROLES.includes(role as any)) {
          return guard.json({ error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` }, { status: 400 })
        }
        await service.updateMembershipRole(organizationId, userId, role as any)
        return guard.json({ status: 'ok' })
      }

      default:
        return guard.json(
          { error: `Invalid action: ${action}. Valid actions: setCiso, clearCiso, bulkUpdateRoleFlags, createProjectRole, updateProjectRole, deleteProjectRole, setRoleAssignments, syncProjectAssignments, bulkUpsertProjectRoles, createSnapshot, compareSnapshots, updateMembershipRole` },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error(`[Structure POST] action=${action} failed`, err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return guard.json({ error: message }, { status: 500 })
  }
}
