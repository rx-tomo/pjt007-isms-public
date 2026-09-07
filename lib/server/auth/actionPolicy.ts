import { and, eq } from 'drizzle-orm'
import type { getDb } from '@/lib/db/drizzle/client'
import { userPermissionSets } from '@/lib/db/drizzle/schema/users'
import { isApprovalCandidateRole } from '@/lib/approvals/approvalCandidateContract'
import {
  resolveTenantAuthorizationContext,
  type TenantAuthorizationContext,
  type TenantAuthorizationDenial,
} from '@/lib/server/auth/authorizationContext'

export const managedModules = [
  'documents',
  'risks',
  'tasks',
  'audit',
  'assets',
  'controls',
] as const

export type ManagedModule = (typeof managedModules)[number]
export type ManagedModuleAction = 'read' | 'create' | 'update' | 'delete'
export type TenantAction =
  | `${ManagedModule}.${ManagedModuleAction}`
  | 'controls.submit'
  | 'controls.publish'
  | 'approvals.decide'
  | 'members.manage'
  | 'billing.manage'
  | 'global.operate'

export interface AdditivePermissionGrants {
  canManageDocuments?: boolean | null
  canManageRisks?: boolean | null
  canManageTasks?: boolean | null
  canManageAudit?: boolean | null
  canManageAssets?: boolean | null
  canManageControls?: boolean | null
}

export interface ManagedModuleCapabilities {
  read: boolean
  create: boolean
  update: boolean
  delete: boolean
}

export interface EffectiveCapabilities {
  modules: Record<ManagedModule, ManagedModuleCapabilities>
  approvalDecision: boolean
  memberAdministration: boolean
  billingAdministration: boolean
  globalOperations: boolean
  controlWorkflowSubmit: boolean
  controlVersionPublish: boolean
}

type ActionPolicyDb = ReturnType<typeof getDb>

const permissionKeyByModule: Record<ManagedModule, keyof AdditivePermissionGrants> = {
  documents: 'canManageDocuments',
  risks: 'canManageRisks',
  tasks: 'canManageTasks',
  audit: 'canManageAudit',
  assets: 'canManageAssets',
  controls: 'canManageControls',
}

const fullTenantManagers = new Set(['system_operator', 'org_admin'])

function roleCanReadModule(
  role: TenantAuthorizationContext['role'],
  module: ManagedModule
): boolean {
  if (fullTenantManagers.has(role)) return true
  if (role === 'auditor') return true
  if (role === 'user' || role === 'approver') {
    return module === 'documents' || module === 'tasks'
  }
  return false
}

function roleCanManageModule(
  role: TenantAuthorizationContext['role'],
  module: ManagedModule
): boolean {
  if (fullTenantManagers.has(role)) return true
  return role === 'auditor' && module === 'audit'
}

export function buildEffectiveCapabilities(
  context: TenantAuthorizationContext,
  grants: AdditivePermissionGrants | null | undefined
): EffectiveCapabilities {
  const tenantActionsDisabled = context.role === 'super_admin'
  const modules = Object.fromEntries(
    managedModules.map(module => {
      const additiveGrant = !tenantActionsDisabled
        && grants?.[permissionKeyByModule[module]] === true
      const roleManagement = roleCanManageModule(context.role, module)
      return [
        module,
        {
          read: roleCanReadModule(context.role, module) || additiveGrant,
          create: roleManagement || additiveGrant,
          update: roleManagement || additiveGrant,
          delete: fullTenantManagers.has(context.role),
        },
      ]
    })
  ) as Record<ManagedModule, ManagedModuleCapabilities>

  return {
    modules,
    // 二段階承認（設計 §5.6）: capability は「決裁UIを出してよいか」に留める。
    // 実際に決裁できるかは、当該 approval_request の assigned approver かどうかを
    // リポジトリ層 / 決裁経路で fail-closed に検査する。
    // org_admin は 2段目に assigned されているときだけ決裁が通る。
    // `!tenantActionsDisabled` は設計書に無い追加の締め付け（停止テナント/super_admin では
    // 決裁不可）。fail-closed 方向のため採用しているが、PO 追認事項。
    approvalDecision: !tenantActionsDisabled && isApprovalCandidateRole(context.role),
    memberAdministration: fullTenantManagers.has(context.role),
    billingAdministration: fullTenantManagers.has(context.role),
    // Global operations use the dedicated global-profile guard. A tenant
    // membership or additive permission never confers global authority.
    globalOperations: false,
    controlWorkflowSubmit: fullTenantManagers.has(context.role),
    controlVersionPublish: fullTenantManagers.has(context.role),
  }
}

export function canPerformTenantAction(
  capabilities: EffectiveCapabilities,
  action: TenantAction
): boolean {
  if (action === 'approvals.decide') return capabilities.approvalDecision
  if (action === 'members.manage') return capabilities.memberAdministration
  if (action === 'billing.manage') return capabilities.billingAdministration
  if (action === 'global.operate') return capabilities.globalOperations
  if (action === 'controls.submit') return capabilities.controlWorkflowSubmit
  if (action === 'controls.publish') return capabilities.controlVersionPublish

  const [module, operation] = action.split('.') as [ManagedModule, ManagedModuleAction]
  return capabilities.modules[module]?.[operation] === true
}

export async function resolveEffectiveCapabilities(
  db: ActionPolicyDb,
  context: TenantAuthorizationContext
): Promise<EffectiveCapabilities> {
  const [grants] = await db
    .select({
      canManageDocuments: userPermissionSets.canManageDocuments,
      canManageRisks: userPermissionSets.canManageRisks,
      canManageTasks: userPermissionSets.canManageTasks,
      canManageAudit: userPermissionSets.canManageAudit,
      canManageAssets: userPermissionSets.canManageAssets,
      canManageControls: userPermissionSets.canManageControls,
    })
    .from(userPermissionSets)
    .where(and(
      eq(userPermissionSets.userId, context.userId),
      eq(userPermissionSets.organizationId, context.organizationId)
    ))
    .limit(1)

  return buildEffectiveCapabilities(context, grants ?? null)
}

export type TenantActionAuthorizationResult =
  | {
      ok: true
      context: TenantAuthorizationContext
      capabilities: EffectiveCapabilities
    }
  | {
      ok: false
      reason: TenantAuthorizationDenial | 'action_denied'
    }

export function tenantActionDenialStatus(
  authorization: Extract<TenantActionAuthorizationResult, { ok: false }>
): 403 | 404 {
  return authorization.reason === 'action_denied' ? 403 : 404
}

export async function authorizeTenantAction(
  db: ActionPolicyDb,
  userId: string,
  organizationId: string,
  action: TenantAction
): Promise<TenantActionAuthorizationResult> {
  const authorization = await resolveTenantAuthorizationContext(db, userId, organizationId)
  if (!authorization.ok) return authorization

  const capabilities = await resolveEffectiveCapabilities(db, authorization.context)
  if (!canPerformTenantAction(capabilities, action)) {
    return { ok: false, reason: 'action_denied' }
  }

  return {
    ok: true,
    context: authorization.context,
    capabilities,
  }
}
