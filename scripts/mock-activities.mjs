#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ORG_ID = '70000000-0000-4000-8000-000000000001';
const DEV_USERS = {
  org_admin: {
    userId: '72000000-0000-4000-8000-000100000002',
    email: 'tanaka.initial@isms-practical.local',
  },
  approver: {
    userId: '72000000-0000-4000-8000-000100000003',
    email: 'suzuki.initial@isms-practical.local',
  },
};
const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://${HOST}:${PORT}`;
const SUMMARY_PATH = process.env.QA_HOME_ACTIVITY_FEED_SEED_FILE
  || process.env.HOME_ACTIVITY_FEED_SUMMARY
  || path.join(process.cwd(), 'test-results', 'home-activity-feed-seed.json');

const ids = {
  document: '53000000-0000-4000-8000-000000000001',
  risk: '53000000-0000-4000-8000-000000000002',
  orgAdminNotification: '53000000-0000-4000-8000-000000000101',
  approverNotification: '53000000-0000-4000-8000-000000000102',
  documentLog: '53000000-0000-4000-8000-000000000201',
  riskLog: '53000000-0000-4000-8000-000000000202',
};

const summary = {
  document: {
    id: ids.document,
    title: 'QA activity feed document',
    link: `/documents/${ids.document}`,
  },
  risk: {
    id: ids.risk,
    title: 'QA activity feed risk',
    link: `/risks/${ids.risk}`,
  },
  notifications: {
    orgAdmin: [
      {
        id: ids.orgAdminNotification,
        title: 'QA activity feed org admin notice',
        link: `/documents/${ids.document}`,
      },
    ],
    approver: [
      {
        id: ids.approverNotification,
        title: 'QA activity feed approver notice',
        link: `/risks/${ids.risk}`,
      },
    ],
  },
  counts: {
    orgAdmin: 1,
    approver: 1,
  },
};

function getDatabaseUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'local.db');
  return `file:${dbPath}`;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/ja`, { method: 'GET' });
      if (response.ok || response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server is not ready at ${BASE_URL}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function ensureDevLogin(role) {
  const user = DEV_USERS[role];
  const response = await fetch(`${BASE_URL}/api/dev/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role,
      organizationId: ORG_ID,
      email: user?.email,
      userId: user?.userId,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Dev login seed for ${role} failed: HTTP ${response.status} ${text}`);
  }
}

async function fetchUser(client, email) {
  const result = await client.execute({
    sql: 'select id, email, full_name from user_profiles where organization_id = ? and email = ? limit 1',
    args: [ORG_ID, email],
  });
  const row = result.rows[0];
  if (!row) {
    throw new Error(`User profile not found after dev login: ${email}`);
  }
  return row;
}

async function execute(client, sql, args = []) {
  await client.execute({ sql, args });
}

async function main() {
  await waitForServer();
  await ensureDevLogin('org_admin');
  await ensureDevLogin('approver');

  const { createClient } = await import('@libsql/client');
  const client = createClient({
    url: getDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const orgAdmin = await fetchUser(client, 'tanaka@dev-mfg.local');
  const approver = await fetchUser(client, 'sato@dev-mfg.local');
  const now = new Date();
  const createdAt = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  await execute(
    client,
    `delete from notifications where id in (?, ?)`,
    [ids.orgAdminNotification, ids.approverNotification],
  );
  await execute(
    client,
    `delete from audit_logs where id in (?, ?)`,
    [ids.documentLog, ids.riskLog],
  );
  await execute(client, `delete from risks where id = ?`, [ids.risk]);
  await execute(client, `delete from documents where id = ?`, [ids.document]);

  await execute(
    client,
    `insert into documents
      (id, organization_id, title, description, status, category, tags, created_by, updated_by, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ids.document,
      ORG_ID,
      summary.document.title,
      'Seeded by mock:activities for UC-03 home activity feed QA.',
      'approved',
      'policy',
      '["qa","home-activity-feed"]',
      orgAdmin.id,
      orgAdmin.id,
      createdAt(4),
      createdAt(4),
    ],
  );
  await execute(
    client,
    `insert into risks
      (id, organization_id, title, description, impact_level, likelihood_level, risk_score, status, identified_date, identified_by, owner_id, assessment_period, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ids.risk,
      ORG_ID,
      summary.risk.title,
      'Seeded by mock:activities for UC-03 home activity feed QA.',
      4,
      3,
      12,
      'treating',
      createdAt(120),
      orgAdmin.id,
      approver.id,
      'FY2026-Q2',
      createdAt(3),
      createdAt(3),
    ],
  );

  await execute(
    client,
    `insert into audit_logs
      (id, organization_id, user_id, action, resource_type, resource_id, changes, scope, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ids.documentLog,
      ORG_ID,
      orgAdmin.id,
      'document.approved',
      'document',
      ids.document,
      JSON.stringify({ title: summary.document.title }),
      'tenant',
      createdAt(2),
    ],
  );
  await execute(
    client,
    `insert into audit_logs
      (id, organization_id, user_id, action, resource_type, resource_id, changes, scope, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ids.riskLog,
      ORG_ID,
      approver.id,
      'risk.created',
      'risk',
      ids.risk,
      JSON.stringify({ title: summary.risk.title }),
      'tenant',
      createdAt(1),
    ],
  );

  await execute(
    client,
    `insert into notifications
      (id, organization_id, user_id, title, message, type, priority, status, link, metadata, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ids.orgAdminNotification,
      ORG_ID,
      orgAdmin.id,
      summary.notifications.orgAdmin[0].title,
      'Confirm the approved document from the home activity feed.',
      'document_approval',
      'medium',
      'unread',
      summary.notifications.orgAdmin[0].link,
      JSON.stringify({ seed: 'mock:activities', documentId: ids.document }),
      createdAt(0),
    ],
  );
  await execute(
    client,
    `insert into notifications
      (id, organization_id, user_id, title, message, type, priority, status, link, metadata, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ids.approverNotification,
      ORG_ID,
      approver.id,
      summary.notifications.approver[0].title,
      'Confirm the related risk from the home activity feed.',
      'risk_alert',
      'high',
      'unread',
      summary.notifications.approver[0].link,
      JSON.stringify({ seed: 'mock:activities', riskId: ids.risk }),
      createdAt(0),
    ],
  );

  const orgAdminUnread = await client.execute({
    sql: `select count(*) as count from notifications where organization_id = ? and user_id = ? and status = 'unread'`,
    args: [ORG_ID, orgAdmin.id],
  });
  const approverUnread = await client.execute({
    sql: `select count(*) as count from notifications where organization_id = ? and user_id = ? and status = 'unread'`,
    args: [ORG_ID, approver.id],
  });

  summary.counts.orgAdmin = Number(orgAdminUnread.rows[0]?.count ?? summary.counts.orgAdmin);
  summary.counts.approver = Number(approverUnread.rows[0]?.count ?? summary.counts.approver);

  await fs.mkdir(path.dirname(SUMMARY_PATH), { recursive: true });
  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  console.log(`Home activity feed seed summary written: ${SUMMARY_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
