import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { authUsers } from './auth';

export const userPreferences = sqliteTable(
  'user_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    theme: text('theme').notNull().default('light'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    uniqueIndex('user_preferences_user_id_unique').on(table.userId),
  ]
);

export type UserPreference = typeof userPreferences.$inferSelect;
export type UserPreferenceInsert = typeof userPreferences.$inferInsert;
