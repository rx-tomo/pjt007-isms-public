import { PERMISSION_KEYS, type PermissionTemplate } from '@/lib/dev-login/scenarios'

/**
 * dev-login における user_permission_sets の扱い。
 *
 * 契約: dev-login は「ログインさせるだけ」であり、権限の正は seed / アプリ操作側にある。
 * 既存行がある場合はロール既定値で上書きしない（seed が付与した追加権限を壊さないため）。
 * 行が無い場合のみ、ロール既定値で新規作成する。
 */
export type PermissionSetColumnValues = {
  canManageDocuments: boolean
  canManageRisks: boolean
  canManageTasks: boolean
  canManageAudit: boolean
  canManageAssets: boolean
  canManageControls: boolean
}

export type PermissionSetPlan =
  | { action: 'insert'; values: PermissionSetColumnValues }
  | { action: 'preserve' }

const COLUMN_BY_PERMISSION_KEY: Record<(typeof PERMISSION_KEYS)[number], keyof PermissionSetColumnValues> = {
  can_manage_documents: 'canManageDocuments',
  can_manage_risks: 'canManageRisks',
  can_manage_tasks: 'canManageTasks',
  can_manage_audit: 'canManageAudit',
  can_manage_assets: 'canManageAssets',
  can_manage_controls: 'canManageControls',
}

export function toPermissionSetColumnValues(permissions: Partial<PermissionTemplate>): PermissionSetColumnValues {
  return PERMISSION_KEYS.reduce<PermissionSetColumnValues>((acc, key) => {
    acc[COLUMN_BY_PERMISSION_KEY[key]] = permissions[key] ?? false
    return acc
  }, {} as PermissionSetColumnValues)
}

/**
 * 既存行の有無からどう書き込むかを決める。
 * 既存行があるときは preserve（何も書かない）。
 */
export function planPermissionSetWrite(
  hasExistingRow: boolean,
  permissions: Partial<PermissionTemplate>
): PermissionSetPlan {
  if (hasExistingRow) {
    return { action: 'preserve' }
  }

  return { action: 'insert', values: toPermissionSetColumnValues(permissions) }
}
