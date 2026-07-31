import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const migrationPath = resolve(process.cwd(), 'drizzle/0018_add_notification_receipts.sql')

function transactionBody(sql) {
  // The raw artifact owns its transaction. The programmatic path already holds
  // an immediate libSQL write transaction, so remove only the outer controls.
  return sql
    .replace(/BEGIN\s+IMMEDIATE\s*;/i, '')
    .replace(/\s*COMMIT\s*;\s*$/i, '')
}

export class NotificationReceiptMigrationPreflightError extends Error {
  constructor(poisonedNotificationIds) {
    super(`Notification receipt migration blocked by ${poisonedNotificationIds.length} poisoned direct notification(s)`)
    this.name = 'NotificationReceiptMigrationPreflightError'
    this.poisonedCount = poisonedNotificationIds.length
    this.poisonedNotificationIds = [...poisonedNotificationIds]
  }
}

export async function inspectNotificationReceiptMigration(client) {
  const result = await client.execute(`
    SELECT notifications.id AS notification_id
    FROM notifications
    WHERE notifications.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM user_memberships
        WHERE user_memberships.user_id = notifications.user_id
          AND user_memberships.organization_id = notifications.organization_id
          AND user_memberships.status = 'active'
      )
    ORDER BY notifications.id
  `)
  const poisonedNotificationIds = result.rows.map(row => String(row.notification_id))
  return {
    safe: poisonedNotificationIds.length === 0,
    poisonedNotificationIds,
  }
}

async function receiptTableExists(executor) {
  const result = await executor.execute(`
    SELECT COUNT(*) AS present
    FROM sqlite_master
    WHERE type = 'table' AND name = 'notification_receipts'
  `)
  return Number(result.rows[0].present) > 0
}

async function pendingLegacyReceiptCount(executor) {
  const result = await executor.execute(`
    SELECT COUNT(*) AS pending
    FROM notifications
    WHERE notifications.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM user_memberships
        WHERE user_memberships.user_id = notifications.user_id
          AND user_memberships.organization_id = notifications.organization_id
          AND user_memberships.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM notification_receipts
        WHERE notification_receipts.notification_id = notifications.id
          AND notification_receipts.user_id = notifications.user_id
      )
  `)
  return Number(result.rows[0].pending)
}

/**
 * `drizzle-kit push` は schema から空の `notification_receipts` を作るだけで
 * legacy direct 通知の既読/アーカイブを移送しない。0018 の raw artifact は
 * `CREATE TABLE`（IF NOT EXISTS なし）を含むため、push 済み DB へはそのまま
 * 当てられない。この関数は table の有無に関わらず一度で収束させる。
 *
 * - table が無ければ 0018 をそのまま適用する
 * - table があれば preflight のうえ未移送の direct 通知だけを追加する
 * - 既に receipt がある組み合わせは触らない（再実行しても増えない）
 */
export async function backfillNotificationReceipts(client, { dryRun = false } = {}) {
  if (dryRun) {
    const preflight = await inspectNotificationReceiptMigration(client)
    const tablePresent = await receiptTableExists(client)
    return {
      applied: false,
      tablePresent,
      preflight,
      pending: tablePresent && preflight.safe
        ? await pendingLegacyReceiptCount(client)
        : null,
      inserted: 0,
    }
  }

  const transaction = await client.transaction('write')
  try {
    const preflight = await inspectNotificationReceiptMigration(transaction)
    if (!preflight.safe) {
      throw new NotificationReceiptMigrationPreflightError(preflight.poisonedNotificationIds)
    }

    const tablePresent = await receiptTableExists(transaction)
    if (!tablePresent) {
      const sql = transactionBody(
        (await readFile(migrationPath, 'utf8')).replaceAll('--> statement-breakpoint', '')
      )
      await transaction.executeMultiple(sql)
      const inserted = Number(
        (await transaction.execute('SELECT COUNT(*) AS value FROM notification_receipts')).rows[0].value
      )
      await transaction.commit()
      return { applied: true, tablePresent: false, preflight, pending: inserted, inserted }
    }

    const pending = await pendingLegacyReceiptCount(transaction)
    if (pending > 0) {
      await transaction.execute(`
        INSERT INTO notification_receipts (
          id, notification_id, user_id, status, read_at, archived_at, created_at, updated_at
        )
        SELECT
          'legacy:' || notifications.id || ':' || notifications.user_id,
          notifications.id,
          notifications.user_id,
          CASE notifications.status
            WHEN 'read' THEN 'read'
            WHEN 'archived' THEN 'archived'
            ELSE 'unread'
          END,
          notifications.read_at,
          notifications.archived_at,
          notifications.created_at,
          COALESCE(notifications.archived_at, notifications.read_at, notifications.created_at)
        FROM notifications
        WHERE notifications.user_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM user_memberships
            WHERE user_memberships.user_id = notifications.user_id
              AND user_memberships.organization_id = notifications.organization_id
              AND user_memberships.status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM notification_receipts
            WHERE notification_receipts.notification_id = notifications.id
              AND notification_receipts.user_id = notifications.user_id
          )
      `)
    }
    await transaction.commit()
    return { applied: pending > 0, tablePresent: true, preflight, pending, inserted: pending }
  } catch (error) {
    if (!transaction.closed) await transaction.rollback()
    throw error
  } finally {
    transaction.close()
  }
}

export async function applyNotificationReceiptMigration(client) {
  // @libsql/client executeMultiple() is not atomic on Client. A "write"
  // transaction starts with BEGIN IMMEDIATE and serializes competing writers.
  const transaction = await client.transaction('write')
  try {
    const preflight = await inspectNotificationReceiptMigration(transaction)
    if (!preflight.safe) {
      throw new NotificationReceiptMigrationPreflightError(preflight.poisonedNotificationIds)
    }

    const sql = transactionBody(
      (await readFile(migrationPath, 'utf8'))
        .replaceAll('--> statement-breakpoint', '')
    )
    await transaction.executeMultiple(sql)
    await transaction.commit()
    return preflight
  } catch (error) {
    if (!transaction.closed) await transaction.rollback()
    throw error
  } finally {
    transaction.close()
  }
}
