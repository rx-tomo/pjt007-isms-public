#!/usr/bin/env node
/**
 * QA for the reusable practical-verification seed.
 *
 * Run after `npm run seed:practical-verification -- --reset` to confirm that
 * the local DB contains both initial-registration and yearly-operation stories.
 */

import path from 'node:path';
import process from 'node:process';

const seedSource = 'practical-verification-v1';
const ids = {
  initialOrg: '70000000-0000-4000-8000-000000000001',
  surveillanceOrg: '70000000-0000-4000-8000-000000000002',
  enterpriseOrg: '70000000-0000-4000-8000-000000000003',
  suspendedOrg: '70000000-0000-4000-8000-000000000004',
  sharedOperatorUser: '72000000-0000-4000-8000-999900000001',
  sharedOperatorInitialMembership: '72020000-0000-4000-8000-999900000001',
  sharedOperatorSurveillanceMembership: '72020000-0000-4000-8000-999900000002',
  sharedOperatorEnterpriseMembership: '72020000-0000-4000-8000-999900000003',
  sharedOperatorInitialPermission: '72030000-0000-4000-8000-999900000001',
  sharedOperatorSurveillancePermission: '72030000-0000-4000-8000-999900000002',
  sharedOperatorEnterprisePermission: '72030000-0000-4000-8000-999900000003',
};

const expectedOrgs = [
  {
    scenario: 'initial',
    id: ids.initialOrg,
    name: '初回登録準備モデル株式会社',
    phase: 'initial',
    certificationStatus: 'planning',
  },
  {
    scenario: 'surveillance',
    id: ids.surveillanceOrg,
    name: '継続運用モデル株式会社',
    phase: 'surveillance',
    certificationStatus: 'certified',
  },
  {
    scenario: 'enterprise',
    id: ids.enterpriseOrg,
    name: '製造委託管理モデル株式会社',
    phase: 'surveillance',
    certificationStatus: 'in_progress',
  },
  {
    scenario: 'suspended',
    id: ids.suspendedOrg,
    name: '休止中モデル株式会社',
    phase: 'initial',
    certificationStatus: 'planning',
  },
];

const expectedRows = [
  tableIds('organization_departments', 'initial', 'dept', 4),
  tableIds('organization_departments', 'surveillance', 'dept', 4),
  tableIds('organization_departments', 'enterprise', 'dept', 4),
  tableIds('organization_departments', 'suspended', 'dept', 4),
  tableIds('user_profiles', 'initial', 'user', 5),
  tableIds('user_profiles', 'surveillance', 'user', 5),
  tableIds('user_profiles', 'enterprise', 'user', 5),
  tableIds('user_profiles', 'suspended', 'user', 5),
  tableIds('user_memberships', 'initial', 'membership', 5),
  tableIds('user_memberships', 'surveillance', 'membership', 5),
  tableIds('user_memberships', 'enterprise', 'membership', 5),
  tableIds('user_memberships', 'suspended', 'membership', 5),
  {
    table: 'user_memberships',
    scenario: 'shared_operator',
    ids: [ids.sharedOperatorInitialMembership, ids.sharedOperatorSurveillanceMembership, ids.sharedOperatorEnterpriseMembership],
  },
  tableIds('user_permission_sets', 'initial', 'permission', 5),
  tableIds('user_permission_sets', 'surveillance', 'permission', 5),
  tableIds('user_permission_sets', 'enterprise', 'permission', 5),
  tableIds('user_permission_sets', 'suspended', 'permission', 5),
  {
    table: 'user_permission_sets',
    scenario: 'shared_operator',
    ids: [ids.sharedOperatorInitialPermission, ids.sharedOperatorSurveillancePermission, ids.sharedOperatorEnterprisePermission],
  },
  tableIds('user_department_scopes', 'initial', 'departmentScope', 3, ['03', '04', '05']),
  tableIds('user_department_scopes', 'surveillance', 'departmentScope', 3, ['03', '04', '05']),
  tableIds('user_department_scopes', 'enterprise', 'departmentScope', 3, ['03', '04', '05']),
  tableIds('user_department_scopes', 'suspended', 'departmentScope', 3, ['03', '04', '05']),
  tableIds('project_roles', 'initial', 'role', 5),
  tableIds('project_roles', 'surveillance', 'role', 4),
  tableIds('project_roles', 'enterprise', 'role', 4),
  tableIds('project_roles', 'suspended', 'role', 4),
  tableIds('project_assignments', 'initial', 'assignment', 5, ['101', '202', '305', '403', '504']),
  tableIds('project_assignments', 'surveillance', 'assignment', 4, ['101', '202', '303', '404']),
  tableIds('project_assignments', 'enterprise', 'assignment', 4, ['101', '202', '305', '404']),
  tableIds('project_assignments', 'suspended', 'assignment', 4, ['101', '202', '303', '404']),
  tableIds('organization_isms_scopes', 'initial', 'scope', 1),
  tableIds('organization_isms_scopes', 'surveillance', 'scope', 1),
  tableIds('organization_isms_scopes', 'enterprise', 'scope', 1),
  tableIds('organization_isms_scopes', 'suspended', 'scope', 1),
  tableIds('documents', 'initial', 'document', 3),
  tableIds('documents', 'surveillance', 'document', 4),
  tableIds('documents', 'enterprise', 'document', 3),
  tableIds('documents', 'suspended', 'document', 2),
  tableIds('risk_categories', 'initial', 'riskCategory', 3),
  tableIds('risk_categories', 'surveillance', 'riskCategory', 3),
  tableIds('risk_categories', 'enterprise', 'riskCategory', 3),
  tableIds('risk_categories', 'suspended', 'riskCategory', 3),
  tableIds('risk_criteria', 'initial', 'riskCriteria', 10, ['11', '12', '13', '14', '15', '21', '22', '23', '24', '25']),
  tableIds('risk_criteria', 'surveillance', 'riskCriteria', 10, ['11', '12', '13', '14', '15', '21', '22', '23', '24', '25']),
  tableIds('risk_criteria', 'enterprise', 'riskCriteria', 10, ['11', '12', '13', '14', '15', '21', '22', '23', '24', '25']),
  tableIds('risk_criteria', 'suspended', 'riskCriteria', 10, ['11', '12', '13', '14', '15', '21', '22', '23', '24', '25']),
  tableIds('information_assets', 'initial', 'asset', 3),
  tableIds('information_assets', 'surveillance', 'asset', 3),
  tableIds('information_assets', 'enterprise', 'asset', 3),
  tableIds('information_assets', 'suspended', 'asset', 3),
  tableIds('risks', 'initial', 'risk', 3),
  tableIds('risks', 'surveillance', 'risk', 3),
  tableIds('risks', 'enterprise', 'risk', 3),
  tableIds('risks', 'suspended', 'risk', 3),
  tableIds('risk_assets', 'initial', 'riskAsset', 3, ['103', '202', '301']),
  tableIds('risk_assets', 'surveillance', 'riskAsset', 3, ['102', '201', '303']),
  tableIds('risk_assets', 'enterprise', 'riskAsset', 3, ['101', '202', '301']),
  tableIds('risk_assets', 'suspended', 'riskAsset', 3, ['101', '202', '303']),
  tableIds('risk_treatments', 'initial', 'treatment', 2),
  tableIds('risk_treatments', 'surveillance', 'treatment', 2),
  tableIds('risk_treatments', 'enterprise', 'treatment', 2),
  tableIds('risk_treatments', 'suspended', 'treatment', 2),
  tableIds('iso_controls', 'initial', 'control', 3),
  tableIds('iso_controls', 'surveillance', 'control', 3),
  tableIds('iso_controls', 'enterprise', 'control', 3),
  tableIds('iso_controls', 'suspended', 'control', 3),
  tableIds('risk_control_links', 'initial', 'riskControlLink', 2, ['101', '202']),
  tableIds('risk_control_links', 'surveillance', 'riskControlLink', 2, ['101', '202']),
  tableIds('risk_control_links', 'enterprise', 'riskControlLink', 2, ['101', '203']),
  tableIds('risk_control_links', 'suspended', 'riskControlLink', 2, ['102', '201']),
  tableIds('task_categories', 'initial', 'taskCategory', 3),
  tableIds('task_categories', 'surveillance', 'taskCategory', 3),
  tableIds('task_categories', 'enterprise', 'taskCategory', 3),
  tableIds('task_categories', 'suspended', 'taskCategory', 3),
  tableIds('tasks', 'initial', 'task', 5),
  tableIds('tasks', 'surveillance', 'task', 4),
  tableIds('tasks', 'enterprise', 'task', 3),
  tableIds('tasks', 'suspended', 'task', 3),
  tableIds('organization_phase_history', 'initial', 'phase', 1),
  tableIds('organization_phase_history', 'surveillance', 'phase', 1),
  tableIds('organization_phase_history', 'enterprise', 'phase', 1),
  tableIds('organization_phase_history', 'suspended', 'phase', 1),
  tableIds('iso27001_requirements', 'global', 'auditRequirement', 6, null, 'surveillance'),
  tableIds('audit_units', 'surveillance', 'auditUnit', 2),
  tableIds('audit_plans', 'surveillance', 'auditPlan', 2),
  tableIds('audit_team_members', 'surveillance', 'auditTeamMember', 4),
  tableIds('audit_checklists', 'surveillance', 'auditChecklist', 4),
  tableIds('nonconformities', 'surveillance', 'nonconformity', 1),
  tableIds('corrective_actions', 'surveillance', 'correctiveAction', 1),
  tableIds('audit_reports', 'surveillance', 'auditReport', 1),
  tableIds('audit_evidence', 'surveillance', 'auditEvidence', 2),
  tableIds('follow_up_records', 'surveillance', 'followUpRecord', 1),
  tableIds('management_reviews', 'surveillance', 'managementReview', 1),
  tableIds('management_review_items', 'surveillance', 'managementReviewItem', 4),
  tableIds('management_review_actions', 'surveillance', 'managementReviewAction', 2),
  {
    table: 'document_templates',
    scenario: 'global',
    ids: ['pv-policy-basic-ja', 'pv-scope-statement-ja', 'pv-risk-procedure-ja', 'pv-audit-checklist-ja'],
  },
];

function tableIds(table, scenario, entity, count, explicitNumbers = null, idScenario = scenario) {
  const numbers = explicitNumbers || Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0'));
  return {
    table,
    scenario,
    ids: numbers.map((number) => id(idScenario, entity, number)),
  };
}

function id(scenario, entity, value) {
  const stories = {
    initial: '0001',
    surveillance: '0002',
    enterprise: '0003',
    suspended: '0004',
  };
  const story = stories[scenario] ?? '0000';
  const codes = {
    dept: '7100',
    user: '7200',
    membership: '7202',
    permission: '7203',
    departmentScope: '7204',
    role: '7300',
    assignment: '7301',
    scope: '7400',
    document: '7500',
    riskCategory: '7600',
    riskCriteria: '7601',
    asset: '7700',
    risk: '7800',
    treatment: '7801',
    riskAsset: '7802',
    control: '7900',
    riskControlLink: '7901',
    taskCategory: '7a00',
    task: '7a01',
    phase: '7b00',
    auditRequirement: '7c00',
    auditUnit: '7c01',
    auditPlan: '7c02',
    auditTeamMember: '7c03',
    auditChecklist: '7c04',
    nonconformity: '7c05',
    correctiveAction: '7c06',
    auditReport: '7c07',
    auditEvidence: '7c08',
    followUpRecord: '7c09',
    managementReview: '7d00',
    managementReviewItem: '7d01',
    managementReviewAction: '7d02',
  };
  return `${codes[entity]}0000-0000-4000-8000-${story}${String(value).padStart(8, '0')}`;
}

function getDatabaseUrl() {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'local.db');
  return `file:${dbPath}`;
}

function placeholders(values) {
  return values.map(() => '?').join(', ');
}

async function scalar(client, sql, args = []) {
  const result = await client.execute({ sql, args });
  return Number(result.rows[0]?.value ?? 0);
}

async function main() {
  const { createClient } = await import('@libsql/client');
  const databaseUrl = getDatabaseUrl();
  const client = createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const failures = [];
  const summary = [];

  for (const org of expectedOrgs) {
    const result = await client.execute({
      sql: 'SELECT id, name, isms_phase, iso_certification_status, ai_config FROM organizations WHERE id = ?',
      args: [org.id],
    });
    const row = result.rows[0];
    if (!row) {
      failures.push(`${org.scenario}: organization missing (${org.id})`);
      continue;
    }

    const aiConfig = String(row.ai_config ?? '');
    const checks = [
      [row.name, org.name, 'name'],
      [row.isms_phase, org.phase, 'isms_phase'],
      [row.iso_certification_status, org.certificationStatus, 'iso_certification_status'],
    ];
    for (const [actual, expected, label] of checks) {
      if (actual !== expected) {
        failures.push(`${org.scenario}: ${label} expected ${expected}, got ${actual}`);
      }
    }
    if (!aiConfig.includes(seedSource)) {
      failures.push(`${org.scenario}: ai_config does not include ${seedSource}`);
    }
    summary.push({ table: 'organizations', scenario: org.scenario, expected: 1, actual: 1 });
  }

  for (const item of expectedRows) {
    const actual = await scalar(
      client,
      `SELECT COUNT(*) AS value FROM ${item.table} WHERE id IN (${placeholders(item.ids)})`,
      item.ids,
    );
    if (actual !== item.ids.length) {
      failures.push(`${item.scenario}:${item.table} expected ${item.ids.length}, got ${actual}`);
    }
    summary.push({ table: item.table, scenario: item.scenario, expected: item.ids.length, actual });
  }

  const sharedOperatorProfile = await scalar(
    client,
    'SELECT COUNT(*) AS value FROM user_profiles WHERE id = ? AND role = ? AND email = ?',
    [ids.sharedOperatorUser, 'system_operator', 'operator.practical@isms-practical.local'],
  );
  if (sharedOperatorProfile !== 1) {
    failures.push('shared_operator:user_profiles expected system_operator profile, got missing or mismatched row');
  }
  summary.push({ table: 'user_profiles', scenario: 'shared_operator', expected: 1, actual: sharedOperatorProfile });

  const sharedOperatorMemberships = await scalar(
    client,
    `SELECT COUNT(*) AS value FROM user_memberships
      WHERE user_id = ?
        AND organization_id IN (?, ?, ?)
        AND role = ?
        AND status = ?
        AND department_scope = ?`,
    [ids.sharedOperatorUser, ids.initialOrg, ids.surveillanceOrg, ids.enterpriseOrg, 'system_operator', 'active', 'all'],
  );
  if (sharedOperatorMemberships !== 3) {
    failures.push(`shared_operator:user_memberships expected 3 active all-scope memberships, got ${sharedOperatorMemberships}`);
  }
  summary.push({ table: 'user_memberships', scenario: 'shared_operator_cross_tenant', expected: 3, actual: sharedOperatorMemberships });

  const sharedOperatorPermissions = await scalar(
    client,
    `SELECT COUNT(*) AS value FROM user_permission_sets
      WHERE user_id = ?
        AND organization_id IN (?, ?, ?)
        AND can_manage_documents = 1
        AND can_manage_risks = 1
        AND can_manage_tasks = 1
        AND can_manage_audit = 1
        AND can_manage_assets = 1
        AND can_manage_controls = 1`,
    [ids.sharedOperatorUser, ids.initialOrg, ids.surveillanceOrg, ids.enterpriseOrg],
  );
  if (sharedOperatorPermissions !== 3) {
    failures.push(`shared_operator:user_permission_sets expected 3 full-permission rows, got ${sharedOperatorPermissions}`);
  }
  summary.push({ table: 'user_permission_sets', scenario: 'shared_operator_cross_tenant', expected: 3, actual: sharedOperatorPermissions });

  console.log(JSON.stringify({
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    databaseUrl,
    seedSource,
    summary,
    failures,
  }, null, 2));

  client.close();

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
