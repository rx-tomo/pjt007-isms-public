import type { Database } from '../../types/database.types'

export type PermissionUpdate = Omit<
  Database['public']['Tables']['user_permission_sets']['Insert'],
  'organization_id' | 'user_id'
>

export const defaultPermissions: PermissionUpdate = {
  can_manage_documents: false,
  can_manage_risks: false,
  can_manage_tasks: false,
  can_manage_audit: false,
  can_manage_assets: false,
  can_manage_controls: false
}
