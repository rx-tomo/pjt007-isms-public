import type { Config } from 'drizzle-kit'

const baseConfig = {
  schema: './lib/db/drizzle/schema',
  out: './drizzle',
} as const

const tursoUrl = process.env.TURSO_DATABASE_URL
const sqlitePath = process.env.SQLITE_DB_PATH || 'local.db'
const sqliteUrl = sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`

const config: Config = tursoUrl
  ? {
      ...baseConfig,
      dialect: 'turso',
      dbCredentials: {
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      },
    }
  : {
      ...baseConfig,
      dialect: 'sqlite',
      dbCredentials: {
        url: sqliteUrl,
      },
    }

export default config
