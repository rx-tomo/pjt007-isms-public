/**
 * Drizzle ORM Schema - Incidents
 *
 * SQLite-compatible schema definitions for incident-related tables.
 * Converted from PostgreSQL schema with the following adaptations:
 * - UUID -> TEXT (using CUID2)
 * - TIMESTAMPTZ -> TEXT (ISO8601 string)
 * - ENUM -> TEXT with TypeScript type validation
 */

import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { userProfiles } from './users'

// =========================================
// Enums as TypeScript types (SQLite doesn't support ENUM)
// =========================================
export const incidentSeverityValues = ['low', 'medium', 'high', 'critical'] as const
export type IncidentSeverity = (typeof incidentSeverityValues)[number]

export const incidentStatusValues = ['draft', 'in_progress', 'resolved', 'closed'] as const
export type IncidentStatus = (typeof incidentStatusValues)[number]

export const incidentUpdateTypeValues = ['first', 'second', 'final'] as const
export type IncidentUpdateType = (typeof incidentUpdateTypeValues)[number]

export const incidentLinkTypeValues = ['task', 'risk', 'asset'] as const
export type IncidentLinkType = (typeof incidentLinkTypeValues)[number]

// =========================================
// Incidents Table
// =========================================
export const incidents = sqliteTable(
  'incidents',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    occurredAt: text('occurred_at').notNull(),
    detectedAt: text('detected_at'),
    severity: text('severity').notNull(),
    status: text('status').notNull().default('draft'),
    departmentId: text('department_id'),
    reporterId: text('reporter_id')
      .references(() => userProfiles.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_incidents_organization_id').on(table.organizationId),
    index('idx_incidents_occurred_at').on(table.occurredAt),
    index('idx_incidents_status').on(table.status),
  ]
)

export type Incident = typeof incidents.$inferSelect
export type IncidentInsert = typeof incidents.$inferInsert

// =========================================
// Incident Updates Table
// =========================================
export const incidentUpdates = sqliteTable(
  'incident_updates',
  {
    id: text('id').primaryKey(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    updateType: text('update_type').notNull(),
    content: text('content').notNull(),
    createdBy: text('created_by')
      .references(() => userProfiles.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('idx_incident_updates_incident_id').on(table.incidentId),
  ]
)

export type IncidentUpdate = typeof incidentUpdates.$inferSelect
export type IncidentUpdateInsert = typeof incidentUpdates.$inferInsert

// =========================================
// Incident Links Table
// =========================================
export const incidentLinks = sqliteTable(
  'incident_links',
  {
    id: text('id').primaryKey(),
    incidentId: text('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    linkType: text('link_type').notNull(),
    linkId: text('link_id').notNull(),
    createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex('idx_incident_links_unique').on(table.incidentId, table.linkType, table.linkId),
    index('idx_incident_links_incident_id').on(table.incidentId),
  ]
)

export type IncidentLink = typeof incidentLinks.$inferSelect
export type IncidentLinkInsert = typeof incidentLinks.$inferInsert

// =========================================
// Relations
// =========================================
export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [incidents.organizationId],
    references: [organizations.id],
  }),
  reporter: one(userProfiles, {
    fields: [incidents.reporterId],
    references: [userProfiles.id],
  }),
  updates: many(incidentUpdates),
  links: many(incidentLinks),
}))

export const incidentUpdatesRelations = relations(incidentUpdates, ({ one }) => ({
  incident: one(incidents, {
    fields: [incidentUpdates.incidentId],
    references: [incidents.id],
  }),
  createdByUser: one(userProfiles, {
    fields: [incidentUpdates.createdBy],
    references: [userProfiles.id],
  }),
}))

export const incidentLinksRelations = relations(incidentLinks, ({ one }) => ({
  incident: one(incidents, {
    fields: [incidentLinks.incidentId],
    references: [incidents.id],
  }),
}))
