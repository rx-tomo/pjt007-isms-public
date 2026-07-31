#!/usr/bin/env node
/**
 * 通知 receipt の legacy backfill を、明示された1つのDBに対してだけ実行する。
 *
 * 既定は dry-run。書き込むには `--apply` を明示する。既定DBへのフォールバックは
 * 持たない（2026-07-19に、既定 `local.db` へ書くスクリプトを誤って起動して
 * 開発DBと固定文書を失った事故があるため、対象は常に引数で受け取る）。
 *
 *   node scripts/backfill-notification-receipts.mjs --database-url file:./local.db
 *   node scripts/backfill-notification-receipts.mjs --database-url file:./local.db --apply
 *   node scripts/backfill-notification-receipts.mjs --database-url libsql://... --auth-token ... --apply
 */
import { createClient } from '@libsql/client'
import {
  backfillNotificationReceipts,
  NotificationReceiptMigrationPreflightError,
} from './notification-receipts-migration.mjs'

const USAGE = `usage: node scripts/backfill-notification-receipts.mjs --database-url <url> [--auth-token <token>] [--apply]

  --database-url  必須。対象DBのURL（例: file:./local.db, libsql://...）。既定値はない。
  --auth-token    Turso Cloud 用の認証トークン。環境変数 TURSO_AUTH_TOKEN でも可。
  --apply         実際に書き込む。省略時は dry-run で件数だけを報告する。
  --help          この使い方を表示して終了する（何も実行しない）。
`

function parseArguments(argv) {
  const options = { databaseUrl: null, authToken: null, apply: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }
    if (argument === '--apply') {
      options.apply = true
      continue
    }
    if (argument === '--database-url' || argument === '--auth-token') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`)
      }
      if (argument === '--database-url') options.databaseUrl = value
      else options.authToken = value
      index += 1
      continue
    }
    throw new Error(`unknown argument: ${argument}`)
  }
  return options
}

async function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}`)
    process.exitCode = 64
    return
  }

  if (options.help) {
    process.stdout.write(USAGE)
    return
  }
  if (!options.databaseUrl) {
    process.stderr.write(`--database-url は必須です。\n\n${USAGE}`)
    process.exitCode = 64
    return
  }

  const client = createClient({
    url: options.databaseUrl,
    authToken: options.authToken ?? process.env.TURSO_AUTH_TOKEN,
  })

  try {
    const result = await backfillNotificationReceipts(client, { dryRun: !options.apply })
    process.stdout.write(`${JSON.stringify({
      mode: options.apply ? 'apply' : 'dry-run',
      databaseUrl: options.databaseUrl,
      tablePresent: result.tablePresent,
      preflightSafe: result.preflight.safe,
      poisonedCount: result.preflight.poisonedNotificationIds.length,
      pending: result.pending,
      inserted: result.inserted,
      applied: result.applied,
    }, null, 2)}\n`)
  } catch (error) {
    if (error instanceof NotificationReceiptMigrationPreflightError) {
      process.stderr.write(`${JSON.stringify({
        error: 'preflight_blocked',
        poisonedCount: error.poisonedCount,
        hint: '所属していない受信者を指す direct 通知があるため、書き込まずに停止した。',
      }, null, 2)}\n`)
      process.exitCode = 65
      return
    }
    throw error
  } finally {
    client.close()
  }
}

await main()
