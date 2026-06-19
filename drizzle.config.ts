import type { Config } from 'drizzle-kit'

const baseConfig = {
  schema: './lib/db/drizzle/schema',
  out: './drizzle',
} as const

const tursoUrl = process.env.TURSO_DATABASE_URL

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
        url: 'file:local.db',
      },
    }

export default config
