#!/usr/bin/env node
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const orgArgIndex = args.findIndex((arg) => arg === '--org' || arg === '--organization');
const explicitOrgId = orgArgIndex >= 0 ? args[orgArgIndex + 1] : process.env.QA_ORGANIZATION_ID;
const dryRun = args.includes('--dry-run');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function resolveDbUrl() {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'local.db');
  return `file:${dbPath}`;
}

function safeDbUrl(url) {
  if (url.startsWith('file:')) {
    return url;
  }
  return url.replace(/\/\/([^:@/]+):([^@/]+)@/, '//***:***@');
}

async function selectTargetOrganization(client) {
  if (explicitOrgId) {
    const result = await client.execute({
      sql: 'select id, name, isms_phase from organizations where id = ? limit 1',
      args: [explicitOrgId],
    });
    const row = result.rows[0];
    if (!row) {
      throw new Error(`organization not found: ${explicitOrgId}`);
    }
    return row;
  }

  const result = await client.execute(`
    select id, name, isms_phase
    from organizations
    where deleted_at is null
    order by created_at asc, id asc
    limit 1
  `);
  const row = result.rows[0];
  if (!row) {
    throw new Error('no active organization found');
  }
  return row;
}

async function main() {
  const dbUrl = resolveDbUrl();
  const client = createClient({
    url: dbUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const outputDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });

  const target = await selectTargetOrganization(client);
  const organizationId = String(target.id);
  const beforePhase = target.isms_phase ?? null;

  let deletedHistoryCount = 0;
  if (!dryRun) {
    const deleted = await client.execute({
      sql: 'delete from organization_phase_history where organization_id = ?',
      args: [organizationId],
    });
    deletedHistoryCount = deleted.rowsAffected ?? 0;

    await client.execute({
      sql: 'update organizations set isms_phase = null, isms_phase_set_at = null, updated_at = ? where id = ?',
      args: [new Date().toISOString(), organizationId],
    });
  }

  const after = await client.execute({
    sql: 'select id, name, isms_phase from organizations where id = ? limit 1',
    args: [organizationId],
  });
  const afterRow = after.rows[0] ?? {};

  const payload = {
    generatedAt: new Date().toISOString(),
    dryRun,
    databaseUrl: safeDbUrl(dbUrl),
    organizationId,
    organizationName: target.name ?? null,
    before: {
      isms_phase: beforePhase,
    },
    after: {
      isms_phase: afterRow.isms_phase ?? null,
    },
    deletedHistoryCount,
  };

  const outputPath = path.join(outputDir, `phase-selector-reset-${timestamp()}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(JSON.stringify({ ok: true, outputPath, ...payload }, null, 2));
  await client.close();
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
