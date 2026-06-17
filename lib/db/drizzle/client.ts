/**
 * Drizzle ORM libSQL Client
 *
 * Provides database connection for local SQLite (file:local.db) and
 * remote Turso (libsql://...) environments via @libsql/client.
 * createClient() is synchronous, so getDb() remains a sync function.
 */

import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

// Singleton instances
let db: LibSQLDatabase<typeof schema> | null = null
let client: Client | null = null

/**
 * Resolve the libSQL connection URL.
 * - TURSO_DATABASE_URL takes precedence if set.
 * - Falls back to file:<cwd>/local.db for local development.
 */
function resolveUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL
  }
  const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'local.db')
  return `file:${dbPath}`
}

/**
 * Get or create the Drizzle database instance.
 * createClient() from @libsql/client is synchronous, so this function
 * can safely be called from constructors (e.g. BaseSQLiteRepository).
 */
export function getDb(): LibSQLDatabase<typeof schema> {
  if (db) return db

  const url = resolveUrl()
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined

  // Ensure directory exists for local file-based databases
  if (url.startsWith('file:')) {
    const filePath = url.slice(5) // remove "file:" prefix
    const dbDir = path.dirname(filePath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
  }

  client = createClient({ url, authToken })
  db = drizzle(client, { schema })

  // Set PRAGMA for local file-based connections
  // Note: PRAGMA statements are executed asynchronously; errors are logged but non-blocking
  if (url.startsWith('file:')) {
    client.execute('PRAGMA journal_mode = WAL').catch((e) => {
      console.warn('[drizzle] Failed to set PRAGMA journal_mode = WAL:', e)
    })
    client.execute('PRAGMA foreign_keys = ON').catch((e) => {
      console.warn('[drizzle] Failed to set PRAGMA foreign_keys = ON:', e)
    })
  }

  return db
}

/**
 * Close the database connection.
 * Call this when shutting down the application.
 */
export function closeDb(): void {
  if (client) {
    client.close()
    client = null
    db = null
  }
}

/**
 * Reset the database (for testing).
 * WARNING: This deletes all data!
 */
export function resetDb(): void {
  closeDb()
  const url = resolveUrl()
  if (url.startsWith('file:')) {
    const filePath = url.slice(5)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      // Also remove WAL and SHM files if they exist
      const walPath = `${filePath}-wal`
      const shmPath = `${filePath}-shm`
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
    }
  }
}

/**
 * Check if database file exists (local mode only).
 */
export function dbExists(): boolean {
  const url = resolveUrl()
  if (url.startsWith('file:')) {
    const filePath = url.slice(5)
    return fs.existsSync(filePath)
  }
  // Remote Turso databases always "exist"
  return true
}

// Export type for use in repositories
export type DrizzleDb = LibSQLDatabase<typeof schema>
