import type { UserRole } from '@/lib/services/user'
import type { Database } from '@/types/database.types'

type OrganizationPlan = NonNullable<Database['public']['Tables']['organizations']['Row']['subscription_plan']>
type OrganizationStatus = NonNullable<Database['public']['Tables']['organizations']['Row']['subscription_status']>

export const PERMISSION_KEYS = [
  'can_manage_documents',
  'can_manage_risks',
  'can_manage_tasks',
  'can_manage_audit',
  'can_manage_assets',
  'can_manage_controls'
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export type PermissionTemplate = Record<PermissionKey, boolean>

export type RoleKey = UserRole

/**
 * Minimal organization metadata that Dev Login needs in order to seed local DB
 * and display tenant context in the selector.
 */
export interface RoleScenarioOrganization {
  id: string
  name: string
  plan: OrganizationPlan
  status: OrganizationStatus
}

/**
 * Local storage key used by `/[locale]/dev-login` to persist per-role tenant overrides.
 * See docs/06-operations/development-environment-guide.md for the operator workflow.
 */
export const DEV_LOGIN_ORGANIZATION_STORAGE_KEY = 'dev-login:organization-overrides' as const

/**
 * Shape of the tenant override map stored under `DEV_LOGIN_ORGANIZATION_STORAGE_KEY`.
 * Each role can optionally provide a replacement `RoleScenarioOrganization`.
 */
export type RoleOrganizationOverrideMap = Partial<Record<RoleKey, RoleScenarioOrganization>>

export interface RoleScenarioSeedOptions {
  riskDemo?: boolean
}

export interface RoleScenario {
  email: string
  password: string
  fullName: string
  role: RoleKey
  organization: RoleScenarioOrganization | null
  permissions: PermissionTemplate
  seeds?: RoleScenarioSeedOptions
  department?: string | null
  departmentScopes?: string[]
}

export interface DevLoginRoleFlow {
  requiresTenantSelection: boolean
  requiresUserSelection: boolean
}

export const ROLE_SCENARIOS: Record<RoleKey, RoleScenario> = {
  super_admin: {
    email: 'admin@riscala-isms.local',
    password: 'DevSuperAdmin1!',
    fullName: 'プラットフォーム管理者',
    role: 'super_admin',
    organization: null,
    permissions: {
      can_manage_documents: true,
      can_manage_risks: true,
      can_manage_tasks: true,
      can_manage_audit: true,
      can_manage_assets: true,
      can_manage_controls: true
    }
  },
  system_operator: {
    email: 'operator.practical@isms-practical.local',
    password: 'DevSystemOperator1!',
    fullName: 'Riscala AI for ISMS システム運営者',
    role: 'system_operator',
    organization: {
      id: '70000000-0000-4000-8000-000000000001',
      name: '初回登録準備モデル株式会社',
      plan: 'trial',
      status: 'active'
    },
    permissions: {
      can_manage_documents: true,
      can_manage_risks: true,
      can_manage_tasks: true,
      can_manage_audit: true,
      can_manage_assets: true,
      can_manage_controls: true
    },
    department: '横断運営',
    departmentScopes: ['経営管理部']
  },
  org_admin: {
    email: 'tanaka.initial@isms-practical.local',
    password: 'DevOrgAdmin1!',
    fullName: '田中航',
    role: 'org_admin',
    organization: {
      id: '70000000-0000-4000-8000-000000000001',
      name: '初回登録準備モデル株式会社',
      plan: 'trial',
      status: 'active'
    },
    permissions: {
      can_manage_documents: true,
      can_manage_risks: true,
      can_manage_tasks: true,
      can_manage_audit: true,
      can_manage_assets: true,
      can_manage_controls: true
    },
    department: '情報システム部',
    departmentScopes: ['情報システム部', '品質保証部']
  },
  user: {
    email: 'takahashi.initial@isms-practical.local',
    password: 'DevMember1!',
    fullName: '高橋誠',
    role: 'user',
    organization: {
      id: '70000000-0000-4000-8000-000000000001',
      name: '初回登録準備モデル株式会社',
      plan: 'trial',
      status: 'active'
    },
    permissions: {
      can_manage_documents: false,
      can_manage_risks: false,
      can_manage_tasks: true,
      can_manage_audit: false,
      can_manage_assets: false,
      can_manage_controls: false
    },
    department: '営業・CS部',
    departmentScopes: ['営業・CS部']
  },
  auditor: {
    email: 'matsumoto.initial@isms-practical.local',
    password: 'DevAuditor1!',
    fullName: '松本結衣',
    role: 'auditor',
    organization: {
      id: '70000000-0000-4000-8000-000000000001',
      name: '初回登録準備モデル株式会社',
      plan: 'trial',
      status: 'active'
    },
    permissions: {
      can_manage_documents: false,
      can_manage_risks: false,
      can_manage_tasks: false,
      can_manage_audit: true,
      can_manage_assets: false,
      can_manage_controls: false
    },
    department: '経営管理部',
    departmentScopes: ['経営管理部']
  },
  approver: {
    email: 'suzuki.initial@isms-practical.local',
    password: 'DevApprover1!',
    fullName: '鈴木玲奈',
    role: 'approver',
    organization: {
      id: '70000000-0000-4000-8000-000000000001',
      name: '初回登録準備モデル株式会社',
      plan: 'trial',
      status: 'active'
    },
    permissions: {
      can_manage_documents: false,
      can_manage_risks: false,
      can_manage_tasks: true,
      can_manage_audit: false,
      can_manage_assets: false,
      can_manage_controls: false
    },
    department: '開発部',
    departmentScopes: ['開発部']
  }
}

export const ROLE_KEYS = Object.keys(ROLE_SCENARIOS) as RoleKey[]

export const DEV_LOGIN_ROLE_FLOW: Record<RoleKey, DevLoginRoleFlow> = {
  super_admin: {
    requiresTenantSelection: false,
    requiresUserSelection: false
  },
  system_operator: {
    requiresTenantSelection: true,
    requiresUserSelection: true
  },
  org_admin: {
    requiresTenantSelection: true,
    requiresUserSelection: true
  },
  user: {
    requiresTenantSelection: true,
    requiresUserSelection: true
  },
  auditor: {
    requiresTenantSelection: true,
    requiresUserSelection: true
  },
  approver: {
    requiresTenantSelection: true,
    requiresUserSelection: true
  }
}

export function getDefaultPermissions(role: RoleKey): PermissionTemplate {
  return { ...ROLE_SCENARIOS[role].permissions }
}

export function requiresTenantSelection(role: RoleKey): boolean {
  return DEV_LOGIN_ROLE_FLOW[role].requiresTenantSelection
}

export function requiresUserSelection(role: RoleKey): boolean {
  return DEV_LOGIN_ROLE_FLOW[role].requiresUserSelection
}
