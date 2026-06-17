/**
 * Drizzle ORM Schema - Users
 *
 * SQLite-compatible schema definitions for user-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 */

import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { organizations, organizationDepartments, projectAssignments } from './organizations'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const userRoleValues = [
  'super_admin',
  'system_operator',
  'org_admin',
  'user',
  'auditor',
  'approver',
] as const
export type UserRole = (typeof userRoleValues)[number]

export const languagePreferenceValues = ['ja', 'en'] as const
export type LanguagePreference = (typeof languagePreferenceValues)[number]

export const membershipStatusValues = ['active', 'inactive'] as const
export type MembershipStatus = (typeof membershipStatusValues)[number]

export const departmentScopeTypeValues = ['own', 'subtree', 'all'] as const
export type DepartmentScopeType = (typeof departmentScopeTypeValues)[number]

// =========================================
// User Profiles Table
// =========================================
export const userProfiles = sqliteTable(
  'user_profiles',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    fullNameEn: text('full_name_en'),
    role: text('role').notNull(),
    department: text('department'),
    position: text('position'),
    phone: text('phone'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    avatarUrl: text('avatar_url'),
    languagePreference: text('language_preference').default('ja'),
    primaryDepartmentId: text('primary_department_id').references(() => organizationDepartments.id),
    // Role flag columns for structure management UI
    isCiso: integer('is_ciso', { mode: 'boolean' }).default(false),
    isSecurityManager: integer('is_security_manager', { mode: 'boolean' }).default(false),
    isOrgAdmin: integer('is_org_admin', { mode: 'boolean' }).default(false),
    isAuditCommittee: integer('is_audit_committee', { mode: 'boolean' }).default(false),
    isIsmsPromoter: integer('is_isms_promoter', { mode: 'boolean' }).default(false),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    lastLoginAt: text('last_login_at'),
  },
  (table) => [
    uniqueIndex('user_profiles_org_email_unique').on(table.organizationId, table.email),
    index('idx_user_profiles_organization_id').on(table.organizationId),
    index('idx_user_profiles_email').on(table.email),
    index('idx_user_profiles_role').on(table.role),
    index('idx_user_profiles_is_active').on(table.isActive),
    index('idx_user_profiles_org_flags').on(
      table.organizationId,
      table.isCiso,
      table.isSecurityManager,
      table.isOrgAdmin,
      table.isAuditCommittee,
      table.isIsmsPromoter,
    ),
  ]
)

export type UserProfile = typeof userProfiles.$inferSelect
export type UserProfileInsert = typeof userProfiles.$inferInsert

// =========================================
// User Memberships Table
// =========================================
export const userMemberships = sqliteTable(
  'user_memberships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    departmentScope: text('department_scope'),
    assignedBy: text('assigned_by').references(() => userProfiles.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('user_memberships_user_org_unique').on(table.userId, table.organizationId),
    index('idx_user_memberships_user').on(table.userId),
    index('idx_user_memberships_org').on(table.organizationId),
    index('idx_user_memberships_role').on(table.role),
  ]
)

export type UserMembership = typeof userMemberships.$inferSelect
export type UserMembershipInsert = typeof userMemberships.$inferInsert

// =========================================
// Organization Invitations Table
// =========================================
export const organizationInvitations = sqliteTable(
  'organization_invitations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => userProfiles.id),
    token: text('token').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
    createdAt: text('created_at'),
  },
  (table) => [
    uniqueIndex('unique_pending_invitation').on(table.organizationId, table.email),
    index('idx_invitations_token').on(table.token),
    index('idx_invitations_email').on(table.email),
    index('idx_invitations_expires_at').on(table.expiresAt),
  ]
)

export type OrganizationInvitation = typeof organizationInvitations.$inferSelect
export type OrganizationInvitationInsert = typeof organizationInvitations.$inferInsert

// =========================================
// User Permission Sets Table
// =========================================
export const userPermissionSets = sqliteTable(
  'user_permission_sets',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'cascade' }),
    canManageDocuments: integer('can_manage_documents', { mode: 'boolean' }).default(false),
    canManageRisks: integer('can_manage_risks', { mode: 'boolean' }).default(false),
    canManageTasks: integer('can_manage_tasks', { mode: 'boolean' }).default(false),
    canManageAudit: integer('can_manage_audit', { mode: 'boolean' }).default(false),
    canManageAssets: integer('can_manage_assets', { mode: 'boolean' }).default(false),
    canManageControls: integer('can_manage_controls', { mode: 'boolean' }).default(false),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (table) => [
    uniqueIndex('user_permission_sets_user_org_unique').on(table.userId, table.organizationId),
    index('idx_user_permission_sets_org').on(table.organizationId),
    index('idx_user_permission_sets_user').on(table.userId),
  ]
)

export type UserPermissionSet = typeof userPermissionSets.$inferSelect
export type UserPermissionSetInsert = typeof userPermissionSets.$inferInsert

// =========================================
// User Department Scopes Table
// =========================================
export const userDepartmentScopes = sqliteTable(
  'user_department_scopes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'cascade' }),
    departmentId: text('department_id')
      .notNull()
      .references(() => organizationDepartments.id, { onDelete: 'cascade' }),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (table) => [
    uniqueIndex('user_department_scopes_user_department_unique').on(table.userId, table.departmentId),
    index('idx_user_department_scopes_org').on(table.organizationId),
    index('idx_user_department_scopes_user').on(table.userId),
    index('idx_user_department_scopes_department').on(table.departmentId),
  ]
)

export type UserDepartmentScope = typeof userDepartmentScopes.$inferSelect
export type UserDepartmentScopeInsert = typeof userDepartmentScopes.$inferInsert

// =========================================
// Relations
// =========================================
export const userProfilesRelations = relations(userProfiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [userProfiles.organizationId],
    references: [organizations.id],
  }),
  primaryDepartment: one(organizationDepartments, {
    fields: [userProfiles.primaryDepartmentId],
    references: [organizationDepartments.id],
  }),
  memberships: many(userMemberships),
  permissionSets: many(userPermissionSets),
  departmentScopes: many(userDepartmentScopes),
  sentInvitations: many(organizationInvitations),
  projectAssignments: many(projectAssignments),
}))

export const userMembershipsRelations = relations(userMemberships, ({ one }) => ({
  user: one(userProfiles, {
    fields: [userMemberships.userId],
    references: [userProfiles.id],
  }),
  organization: one(organizations, {
    fields: [userMemberships.organizationId],
    references: [organizations.id],
  }),
  assignedByUser: one(userProfiles, {
    fields: [userMemberships.assignedBy],
    references: [userProfiles.id],
    relationName: 'assignedByUser',
  }),
}))

export const organizationInvitationsRelations = relations(organizationInvitations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationInvitations.organizationId],
    references: [organizations.id],
  }),
  invitedByUser: one(userProfiles, {
    fields: [organizationInvitations.invitedBy],
    references: [userProfiles.id],
  }),
  projectAssignments: many(projectAssignments),
}))

export const userPermissionSetsRelations = relations(userPermissionSets, ({ one }) => ({
  organization: one(organizations, {
    fields: [userPermissionSets.organizationId],
    references: [organizations.id],
  }),
  user: one(userProfiles, {
    fields: [userPermissionSets.userId],
    references: [userProfiles.id],
  }),
}))

export const userDepartmentScopesRelations = relations(userDepartmentScopes, ({ one }) => ({
  organization: one(organizations, {
    fields: [userDepartmentScopes.organizationId],
    references: [organizations.id],
  }),
  user: one(userProfiles, {
    fields: [userDepartmentScopes.userId],
    references: [userProfiles.id],
  }),
  department: one(organizationDepartments, {
    fields: [userDepartmentScopes.departmentId],
    references: [organizationDepartments.id],
  }),
}))
