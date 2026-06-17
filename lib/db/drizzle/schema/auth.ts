/**
 * Drizzle ORM Schema - Better Auth
 *
 * SQLite-compatible schema definitions for Better Auth tables.
 * These tables are managed by Better Auth for authentication concerns.
 *
 * Tables:
 * - authUsers: Core user identity (email, name, emailVerified)
 * - authSessions: DB-backed sessions with cookie token
 * - authAccounts: Credential/OAuth account links (password hash stored here)
 * - authVerifications: Email verification and password reset tokens
 *
 * Relationship to existing tables:
 * - authUsers.id = userProfiles.id (1:1 FK)
 * - userProfiles holds ISMS business domain fields (role, department, etc.)
 */

import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { userProfiles } from './users'

// =========================================
// Better Auth: user table
// =========================================
export const authUsers = sqliteTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
    twoFactorEnabled: integer('twoFactorEnabled', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  }
)

export type AuthUser = typeof authUsers.$inferSelect
export type AuthUserInsert = typeof authUsers.$inferInsert

// =========================================
// Better Auth: session table
// =========================================
export const authSessions = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    activeOrganizationId: text('activeOrganizationId'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_session_userId').on(table.userId),
    index('idx_session_token').on(table.token),
  ]
)

export type AuthSession = typeof authSessions.$inferSelect
export type AuthSessionInsert = typeof authSessions.$inferInsert

// =========================================
// Better Auth: account table
// =========================================
export const authAccounts = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
    scope: text('scope'),
    idToken: text('idToken'),
    password: text('password'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_account_userId').on(table.userId),
  ]
)

export type AuthAccount = typeof authAccounts.$inferSelect
export type AuthAccountInsert = typeof authAccounts.$inferInsert

// =========================================
// Better Auth: verification table
// =========================================
export const authVerifications = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' }),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }),
  }
)

export type AuthVerification = typeof authVerifications.$inferSelect
export type AuthVerificationInsert = typeof authVerifications.$inferInsert

// =========================================
// Relations
// =========================================
export const authUsersRelations = relations(authUsers, ({ many, one }) => ({
  sessions: many(authSessions),
  accounts: many(authAccounts),
  profile: one(userProfiles, {
    fields: [authUsers.id],
    references: [userProfiles.id],
  }),
}))

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(authUsers, {
    fields: [authSessions.userId],
    references: [authUsers.id],
  }),
}))

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(authUsers, {
    fields: [authAccounts.userId],
    references: [authUsers.id],
  }),
}))
