#!/usr/bin/env node
// Operator-only additive bootstrap. Never called by a public API.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { insertAuditCorrectiveDemo } from './audit-corrective-demo-fixture.mjs';

const remote = process.argv.slice(2).join(' ') === '--public-demo';
if (process.argv.length > 2 && !remote) throw new Error('Usage: seed-audit-corrective-demo.mjs [--public-demo]');
let url;
if (remote) {
  url = process.env.TURSO_DATABASE_URL;
  const parsed = new URL(url || 'invalid:');
  if (process.env.PUBLIC_DEMO_ENABLED !== 'true' || process.env.NODE_ENV !== 'production' ||
      parsed.protocol !== 'libsql:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
      url !== process.env.PUBLIC_DEMO_EXPECTED_DATABASE_URL || !process.env.PUBLIC_DEMO_EXPECTED_DATABASE_ID ||
      !process.env.TURSO_AUTH_TOKEN) throw new Error('Public demo database contract is incomplete or mismatched');
} else {
  if (process.env.TURSO_DATABASE_URL) throw new Error('Remote database requires --public-demo');
  const dbPath = process.env.SQLITE_DB_PATH;
  if (!dbPath || !path.isAbsolute(dbPath)) throw new Error('Explicit temporary SQLITE_DB_PATH required');
  const canonical = fs.realpathSync(dbPath);
  const relative = path.relative(fs.realpathSync(os.tmpdir()), canonical);
  if (canonical !== dbPath || relative.startsWith('..') || path.isAbsolute(relative) || !relative.includes(path.sep)) throw new Error('Database must be in an isolated OS temporary directory');
  url = `file:${canonical}`;
}
const client = createClient({ url, authToken: remote ? process.env.TURSO_AUTH_TOKEN : undefined });
const transaction = await client.transaction('write');
try {
  if (remote) {
    const marker = await transaction.execute("select database_id, status from demo_fixture_state where id = 'public-demo'");
    if (marker.rows.length !== 1 || marker.rows[0].database_id !== process.env.PUBLIC_DEMO_EXPECTED_DATABASE_ID ||
        !['idle', 'failed'].includes(marker.rows[0].status)) throw new Error('Demo fixture is absent, mismatched, or resetting');
  }
  const result = await insertAuditCorrectiveDemo(transaction);
  await transaction.commit();
  console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  transaction.close();
  client.close();
}
