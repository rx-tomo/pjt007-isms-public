import { relations } from 'drizzle-orm'
import { sqliteTable, uniqueIndex, text } from 'drizzle-orm/sqlite-core'
import { authUsers } from './auth'

export const twoFactor = sqliteTable(
  'twoFactor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backupCodes').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('idx_twoFactor_userId').on(table.userId),
    // NOTE: idx_twoFactor_secret intentionally removed.
    // Better Auth already encrypts the TOTP secret with AES (symmetricEncrypt)
    // using BETTER_AUTH_SECRET before storing. An index on encrypted ciphertext
    // is useless for lookups and only increases exposure surface on DB leak.
  ]
)

export type TwoFactor = typeof twoFactor.$inferSelect
export type TwoFactorInsert = typeof twoFactor.$inferInsert

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(authUsers, {
    fields: [twoFactor.userId],
    references: [authUsers.id],
  }),
}))
