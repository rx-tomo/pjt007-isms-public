#!/usr/bin/env node
/**
 * Riscala AI for ISMS — SQLite/libSQL シードスクリプト
 *
 * モデル企業: Dev Manufacturing 株式会社（~200名 IT企業、ISO 27001 認証取得中）
 *
 * 使い方:
 *   node scripts/seed-sqlite.mjs            # file:local.db に接続
 *   TURSO_DATABASE_URL=... node scripts/seed-sqlite.mjs  # Turso に接続
 */

import { createClient } from '@libsql/client';
import crypto from 'node:crypto';

// ─────────────────────────────────────────────
// 接続
// ─────────────────────────────────────────────
const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const now = new Date().toISOString();
const nowMs = Date.now();

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID();
}

async function run(label, statements) {
  console.log(`\n▶ ${label}`);
  let count = 0;
  for (const sql of statements) {
    await db.execute(sql);
    count++;
  }
  console.log(`  ✔ ${count} statements executed`);
  return count;
}

// ─────────────────────────────────────────────
// 固定 ID
// ─────────────────────────────────────────────
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const ORG2_ID = '33333333-3333-4333-8333-333333333333';

const DEPT = {
  corporatePlanning: '00000000-0000-4000-8000-000000000001',
  generalAffairs:    '00000000-0000-4000-8000-000000000002',
  it:                '00000000-0000-4000-8000-000000000003',
  dev1:              '00000000-0000-4000-8000-000000000004',
  dev2:              '00000000-0000-4000-8000-000000000005',
  sales:             '00000000-0000-4000-8000-000000000006',
  support:           '00000000-0000-4000-8000-000000000007',
  qa:                '00000000-0000-4000-8000-000000000008',
};

const USER = {};
for (let i = 1; i <= 15; i++) {
  USER[`u${String(i).padStart(2, '0')}`] = `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`;
}

// Platform admin (super_admin) - no organization
const SUPER_ADMIN_ID = 'sa000000-0000-4000-8000-000000000001';
// System operator - manages both orgs
const SYSOP_ID = 'so000000-0000-4000-8000-000000000001';

// Org2 ユーザー ID
const USER2 = {
  u01: 'user2001-0000-4000-8000-000000000001',
  u02: 'user2002-0000-4000-8000-000000000001',
  u03: 'user2003-0000-4000-8000-000000000001',
};

// Org2 部門 ID
const DEPT2 = {
  management:  '00000000-0000-4000-8000-000000002001',
  development: '00000000-0000-4000-8000-000000002002',
  salesCs:     '00000000-0000-4000-8000-000000002003',
};

// リスクカテゴリ ID
const RCAT = {};
for (let i = 1; i <= 10; i++) {
  RCAT[`c${String(i).padStart(2, '0')}`] = `00000000-0000-4000-9000-0000000000${String(i).padStart(2, '0')}`;
}

// タスクカテゴリ ID
const TCAT = {};
for (let i = 1; i <= 8; i++) {
  TCAT[`t${String(i).padStart(2, '0')}`] = `00000000-0000-4000-a000-0000000000${String(i).padStart(2, '0')}`;
}

// bcrypt プレースホルダー（デモ用、実際の認証には使用しない）
const BCRYPT_PLACEHOLDER = '$2b$10$placeholderHashForDemoSeedOnlyXXXXXXXXXXXXXXXX';

// ═════════════════════════════════════════════
// 1. 組織 (Organization)
// ═════════════════════════════════════════════
const orgStatements = [
  {
    sql: `INSERT OR IGNORE INTO organizations
      (id, name, name_en, employee_count_range, iso_certification_status,
       subscription_plan, subscription_status, isms_phase,
       trial_ends_at, isms_phase_set_at, ai_config, deleted_at, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      ORG_ID,
      'Dev Manufacturing 株式会社',
      'Dev Manufacturing Co., Ltd.',
      '101-300',
      'in_progress',
      'standard',
      'active',
      'initial',
      null,
      now,
      null,
      null,
      now,
      now,
    ],
  },
  {
    sql: `INSERT OR IGNORE INTO organizations
      (id, name, name_en, employee_count_range, iso_certification_status,
       subscription_plan, subscription_status, isms_phase,
       trial_ends_at, isms_phase_set_at, ai_config, deleted_at, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      ORG2_ID,
      'Dev Solutions 株式会社',
      'Dev Solutions Co., Ltd.',
      '51-100',
      'planning',
      'starter',
      'active',
      'initial',
      null,
      now,
      null,
      null,
      now,
      now,
    ],
  },
];

// ═════════════════════════════════════════════
// 2. 部門 (Departments)
// ═════════════════════════════════════════════
const departments = [
  { id: DEPT.corporatePlanning, name: '経営企画部',          nameEn: 'Corporate Planning',       manager: '佐藤美咲',   count: 25 },
  { id: DEPT.generalAffairs,    name: '総務・人事部',        nameEn: 'General Affairs & HR',     manager: '加藤麻衣',   count: 20 },
  { id: DEPT.it,                name: '情報システム部',      nameEn: 'IT Department',            manager: '田中花子',   count: 30 },
  { id: DEPT.dev1,              name: '第一開発部',          nameEn: 'Development Div.1',        manager: '高橋雄一',   count: 35 },
  { id: DEPT.dev2,              name: '第二開発部',          nameEn: 'Development Div.2',        manager: '木下直人',   count: 30 },
  { id: DEPT.sales,             name: '営業部',              nameEn: 'Sales',                    manager: '伊藤大輔',   count: 25 },
  { id: DEPT.support,           name: 'カスタマーサポート部', nameEn: 'Customer Support',         manager: '渡辺さくら', count: 20 },
  { id: DEPT.qa,                name: '品質保証部',          nameEn: 'Quality Assurance',        manager: '松本理恵',   count: 15 },
];

const deptStatements = departments.map((d) => ({
  sql: `INSERT OR IGNORE INTO organization_departments
    (id, organization_id, name, name_en, parent_department_id, manager, description, member_count, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [d.id, ORG_ID, d.name, d.nameEn, null, d.manager, null, d.count, now, now],
}));

// 2b. 部門 — Org2 (organization_departments)
const departments2 = [
  { id: DEPT2.management,  name: '経営管理部', nameEn: 'Management',    manager: '山本健太', count: 10 },
  { id: DEPT2.development, name: '開発部',     nameEn: 'Development',   manager: '林誠一',   count: 40 },
  { id: DEPT2.salesCs,     name: '営業・CS部', nameEn: 'Sales & CS',    manager: '森田由美', count: 30 },
];

const dept2Statements = departments2.map((d) => ({
  sql: `INSERT OR IGNORE INTO organization_departments
    (id, organization_id, name, name_en, parent_department_id, manager, description, member_count, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [d.id, ORG2_ID, d.name, d.nameEn, null, d.manager, null, d.count, now, now],
}));

// ═════════════════════════════════════════════
// 3. ユーザー (Users / Accounts / Profiles / Memberships / Permissions)
// ═════════════════════════════════════════════
const users = [
  { id: USER.u01, name: '田中花子',     email: 'tanaka@dev-mfg.local',     role: 'org_admin', dept: DEPT.it,                deptName: '情報システム部',      position: '部長/ISMS推進事務局長',  isCiso: 0, isSecMgr: 1, isOrgAdmin: 1, isAuditor: 0, isIsmsPromoter: 1 },
  { id: USER.u02, name: '鈴木一郎',     email: 'suzuki@dev-mfg.local',     role: 'user',      dept: DEPT.dev1,              deptName: '第一開発部',          position: 'エンジニア',            isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u03, name: '佐藤美咲',     email: 'sato@dev-mfg.local',       role: 'approver',  dept: DEPT.corporatePlanning,  deptName: '経営企画部',          position: '部長',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u04, name: '中村太郎',     email: 'nakamura@dev-mfg.local',   role: 'org_admin', dept: DEPT.corporatePlanning,  deptName: '経営企画部',          position: '代表取締役/CISO',       isCiso: 1, isSecMgr: 0, isOrgAdmin: 1, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u05, name: '加藤麻衣',     email: 'kato@dev-mfg.local',       role: 'approver',  dept: DEPT.generalAffairs,     deptName: '総務・人事部',        position: '部長',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u06, name: '高橋雄一',     email: 'takahashi@dev-mfg.local',  role: 'user',      dept: DEPT.dev1,              deptName: '第一開発部',          position: '部長',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u07, name: '木下直人',     email: 'kinoshita@dev-mfg.local',  role: 'user',      dept: DEPT.dev2,              deptName: '第二開発部',          position: '部長',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u08, name: '伊藤大輔',     email: 'ito@dev-mfg.local',        role: 'user',      dept: DEPT.sales,             deptName: '営業部',              position: '部長',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u09, name: '渡辺さくら',   email: 'watanabe@dev-mfg.local',   role: 'user',      dept: DEPT.support,           deptName: 'カスタマーサポート部', position: '部長',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u10, name: '小林誠',       email: 'kobayashi@dev-mfg.local',  role: 'user',      dept: DEPT.it,                deptName: '情報システム部',      position: '主任',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u11, name: '吉田翔',       email: 'yoshida@dev-mfg.local',    role: 'user',      dept: DEPT.dev1,              deptName: '第一開発部',          position: 'エンジニア',            isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u12, name: '松本理恵',     email: 'matsumoto@dev-mfg.local',  role: 'auditor',   dept: DEPT.qa,                deptName: '品質保証部',          position: '内部監査員',            isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 1, isIsmsPromoter: 0 },
  { id: USER.u13, name: '井上拓也',     email: 'inoue@dev-mfg.local',      role: 'user',      dept: DEPT.sales,             deptName: '営業部',              position: '営業主任',              isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u14, name: '木村真由美',   email: 'kimura@dev-mfg.local',     role: 'user',      dept: DEPT.generalAffairs,    deptName: '総務・人事部',        position: '主任',                  isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER.u15, name: '清水浩二',     email: 'shimizu@dev-mfg.local',    role: 'user',      dept: DEPT.it,                deptName: '情報システム部',      position: 'インフラ担当',          isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
];

// Better Auth: user テーブル
const userStatements = users.map((u) => ({
  sql: `INSERT OR IGNORE INTO user
    (id, name, email, emailVerified, image, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)`,
  args: [u.id, u.name, u.email, 1, null, nowMs, nowMs],
}));

// Better Auth: account テーブル
const accountStatements = users.map((u) => ({
  sql: `INSERT OR IGNORE INTO account
    (id, accountId, providerId, userId, password,
     accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt,
     scope, idToken, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [uuid(), u.id, 'credential', u.id, BCRYPT_PLACEHOLDER, null, null, null, null, null, null, nowMs, nowMs],
}));

// user_profiles テーブル
const profileStatements = users.map((u) => ({
  sql: `INSERT OR IGNORE INTO user_profiles
    (id, organization_id, email, full_name, full_name_en, role, department, position,
     phone, avatar_url, is_active, language_preference, primary_department_id,
     is_ciso, is_security_manager, is_org_admin, is_audit_committee, is_isms_promoter,
     last_login_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    u.id, ORG_ID, u.email, u.name, null, u.role, u.deptName, u.position,
    null, null, 1, 'ja', u.dept,
    u.isCiso, u.isSecMgr, u.isOrgAdmin, u.isAuditor, u.isIsmsPromoter ?? 0,
    null, now, now,
  ],
}));

// user_memberships テーブル
const membershipStatements = users.map((u) => ({
  sql: `INSERT OR IGNORE INTO user_memberships
    (id, user_id, organization_id, role, status, department_scope, assigned_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [uuid(), u.id, ORG_ID, u.role, 'active', null, null, now, now],
}));

// user_permission_sets テーブル
// user-0001 (田中): all TRUE
// user-0004 (中村): all TRUE
// user-0005 (加藤): docs, risks, tasks = TRUE
// user-0012 (松本/auditor): audit = TRUE
// Others: tasks = TRUE only
function permissionsFor(userId) {
  if (userId === USER.u01 || userId === USER.u04) {
    return { docs: 1, risks: 1, tasks: 1, audit: 1, assets: 1, controls: 1 };
  }
  if (userId === USER.u05) {
    return { docs: 1, risks: 1, tasks: 1, audit: 0, assets: 0, controls: 0 };
  }
  if (userId === USER.u12) {
    return { docs: 0, risks: 0, tasks: 0, audit: 1, assets: 0, controls: 0 };
  }
  return { docs: 0, risks: 0, tasks: 1, audit: 0, assets: 0, controls: 0 };
}

const permissionStatements = users.map((u) => {
  const p = permissionsFor(u.id);
  return {
    sql: `INSERT OR IGNORE INTO user_permission_sets
      (id, user_id, organization_id,
       can_manage_documents, can_manage_risks, can_manage_tasks,
       can_manage_audit, can_manage_assets, can_manage_controls,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), u.id, ORG_ID, p.docs, p.risks, p.tasks, p.audit, p.assets, p.controls, now, now],
  };
});

// ─────────────────────────────────────────────
// 3f. スーパー管理者 (super_admin)
// ─────────────────────────────────────────────
const superAdminUserStmt = {
  sql: `INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)`,
  args: [SUPER_ADMIN_ID, 'Platform Admin', 'admin@riscala-isms.local', 1, null, nowMs, nowMs],
};
const superAdminAccountStmt = {
  sql: `INSERT OR IGNORE INTO account
    (id, accountId, providerId, userId, password,
     accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt,
     scope, idToken, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [uuid(), SUPER_ADMIN_ID, 'credential', SUPER_ADMIN_ID, BCRYPT_PLACEHOLDER, null, null, null, null, null, null, nowMs, nowMs],
};
const superAdminProfileStmt = {
  sql: `INSERT OR IGNORE INTO user_profiles
    (id, organization_id, email, full_name, full_name_en, role, department, position,
     phone, avatar_url, is_active, language_preference, primary_department_id,
     is_ciso, is_security_manager, is_org_admin, is_audit_committee, is_isms_promoter,
     last_login_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    SUPER_ADMIN_ID, null, 'admin@riscala-isms.local', 'プラットフォーム管理者', 'Platform Admin', 'super_admin', null, 'プラットフォーム管理者',
    null, null, 1, 'ja', null,
    0, 0, 0, 0, 0,
    null, now, now,
  ],
};

// ─────────────────────────────────────────────
// 3g. システム運営者 (system_operator)
// ─────────────────────────────────────────────
const sysopUserStmt = {
  sql: `INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)`,
  args: [SYSOP_ID, '山田太郎', 'yamada@riscala-isms.local', 1, null, nowMs, nowMs],
};
const sysopAccountStmt = {
  sql: `INSERT OR IGNORE INTO account
    (id, accountId, providerId, userId, password,
     accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt,
     scope, idToken, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [uuid(), SYSOP_ID, 'credential', SYSOP_ID, BCRYPT_PLACEHOLDER, null, null, null, null, null, null, nowMs, nowMs],
};
const sysopProfileStmt = {
  sql: `INSERT OR IGNORE INTO user_profiles
    (id, organization_id, email, full_name, full_name_en, role, department, position,
     phone, avatar_url, is_active, language_preference, primary_department_id,
     is_ciso, is_security_manager, is_org_admin, is_audit_committee, is_isms_promoter,
     last_login_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    SYSOP_ID, ORG_ID, 'yamada@riscala-isms.local', '山田太郎', 'Taro Yamada', 'system_operator', '情報システム部', 'ITコンサルタント/システム運営',
    null, null, 1, 'ja', null,
    0, 0, 0, 0, 0,
    null, now, now,
  ],
};
const sysopMembershipStatements = [
  {
    sql: `INSERT OR IGNORE INTO user_memberships
      (id, user_id, organization_id, role, status, department_scope, assigned_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), SYSOP_ID, ORG_ID, 'system_operator', 'active', 'all', null, now, now],
  },
  {
    sql: `INSERT OR IGNORE INTO user_memberships
      (id, user_id, organization_id, role, status, department_scope, assigned_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), SYSOP_ID, ORG2_ID, 'system_operator', 'active', 'all', null, now, now],
  },
];
const sysopPermissionStatements = [
  {
    sql: `INSERT OR IGNORE INTO user_permission_sets
      (id, user_id, organization_id,
       can_manage_documents, can_manage_risks, can_manage_tasks,
       can_manage_audit, can_manage_assets, can_manage_controls,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), SYSOP_ID, ORG_ID, 1, 1, 1, 1, 1, 1, now, now],
  },
  {
    sql: `INSERT OR IGNORE INTO user_permission_sets
      (id, user_id, organization_id,
       can_manage_documents, can_manage_risks, can_manage_tasks,
       can_manage_audit, can_manage_assets, can_manage_controls,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), SYSOP_ID, ORG2_ID, 1, 1, 1, 1, 1, 1, now, now],
  },
];

// ─────────────────────────────────────────────
// 3h. Org2 ユーザー
// ─────────────────────────────────────────────
const org2Users = [
  { id: USER2.u01, name: '山本健太',   nameEn: 'Kenta Yamamoto', email: 'yamamoto@dev-solutions.local', role: 'org_admin', dept: DEPT2.management,  deptName: '経営管理部', position: '部長',   isCiso: 0, isSecMgr: 0, isOrgAdmin: 1, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER2.u02, name: '林誠一',     nameEn: 'Seiichi Hayashi', email: 'hayashi@dev-solutions.local',  role: 'user',      dept: DEPT2.development, deptName: '開発部',     position: '部長',   isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
  { id: USER2.u03, name: '森田由美',   nameEn: 'Yumi Morita',    email: 'morita@dev-solutions.local',   role: 'user',      dept: DEPT2.salesCs,     deptName: '営業・CS部', position: '部長',   isCiso: 0, isSecMgr: 0, isOrgAdmin: 0, isAuditor: 0, isIsmsPromoter: 0 },
];

const org2UserStatements = org2Users.map((u) => ({
  sql: `INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)`,
  args: [u.id, u.name, u.email, 1, null, nowMs, nowMs],
}));

const org2AccountStatements = org2Users.map((u) => ({
  sql: `INSERT OR IGNORE INTO account
    (id, accountId, providerId, userId, password,
     accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt,
     scope, idToken, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [uuid(), u.id, 'credential', u.id, BCRYPT_PLACEHOLDER, null, null, null, null, null, null, nowMs, nowMs],
}));

const org2ProfileStatements = org2Users.map((u) => ({
  sql: `INSERT OR IGNORE INTO user_profiles
    (id, organization_id, email, full_name, full_name_en, role, department, position,
     phone, avatar_url, is_active, language_preference, primary_department_id,
     is_ciso, is_security_manager, is_org_admin, is_audit_committee, is_isms_promoter,
     last_login_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    u.id, ORG2_ID, u.email, u.name, u.nameEn, u.role, u.deptName, u.position,
    null, null, 1, 'ja', u.dept,
    u.isCiso, u.isSecMgr, u.isOrgAdmin, u.isAuditor, u.isIsmsPromoter ?? 0,
    null, now, now,
  ],
}));

const org2MembershipStatements = org2Users.map((u) => ({
  sql: `INSERT OR IGNORE INTO user_memberships
    (id, user_id, organization_id, role, status, department_scope, assigned_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [uuid(), u.id, ORG2_ID, u.role, 'active', null, null, now, now],
}));

function org2PermissionsFor(userId) {
  if (userId === USER2.u01) {
    return { docs: 1, risks: 1, tasks: 1, audit: 1, assets: 1, controls: 1 };
  }
  return { docs: 0, risks: 0, tasks: 1, audit: 0, assets: 0, controls: 0 };
}

const org2PermissionStatements = org2Users.map((u) => {
  const p = org2PermissionsFor(u.id);
  return {
    sql: `INSERT OR IGNORE INTO user_permission_sets
      (id, user_id, organization_id,
       can_manage_documents, can_manage_risks, can_manage_tasks,
       can_manage_audit, can_manage_assets, can_manage_controls,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), u.id, ORG2_ID, p.docs, p.risks, p.tasks, p.audit, p.assets, p.controls, now, now],
  };
});

// ═════════════════════════════════════════════
// 4. リスクカテゴリ (Risk Categories)
// ═════════════════════════════════════════════
const riskCategories = [
  { id: RCAT.c01, name: '技術的脆弱性',         desc: 'ソフトウェア・ハードウェアの技術的な脆弱性に関するリスク',     color: '#EF4444', order: 1 },
  { id: RCAT.c02, name: '人的脅威',             desc: '従業員・関係者による意図的・非意図的な脅威',                  color: '#F97316', order: 2 },
  { id: RCAT.c03, name: '物理的脅威',           desc: '施設・設備への物理的なアクセスに関する脅威',                  color: '#EAB308', order: 3 },
  { id: RCAT.c04, name: '運用リスク',           desc: '日常的な運用・保守に関連するリスク',                          color: '#22C55E', order: 4 },
  { id: RCAT.c05, name: 'コンプライアンスリスク', desc: '法令・規制への準拠に関するリスク',                          color: '#3B82F6', order: 5 },
  { id: RCAT.c06, name: 'サプライチェーンリスク', desc: '外部委託先・取引先に関するリスク',                          color: '#8B5CF6', order: 6 },
  { id: RCAT.c07, name: '自然災害',             desc: '地震・台風・洪水等の自然災害に関するリスク',                  color: '#EC4899', order: 7 },
  { id: RCAT.c08, name: 'データ管理リスク',     desc: 'データの保管・転送・廃棄に関するリスク',                      color: '#14B8A6', order: 8 },
  { id: RCAT.c09, name: 'アクセス制御リスク',   desc: '認証・認可・アクセス管理に関するリスク',                      color: '#F59E0B', order: 9 },
  { id: RCAT.c10, name: '事業継続リスク',       desc: '事業継続・災害復旧に関するリスク',                            color: '#6366F1', order: 10 },
];

const riskCategoryStatements = riskCategories.map((c) => ({
  sql: `INSERT OR IGNORE INTO risk_categories
    (id, organization_id, name, description, color, display_order, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [c.id, ORG_ID, c.name, c.desc, c.color, c.order, now, now],
}));

// ═════════════════════════════════════════════
// 5. リスク基準 (Risk Criteria)
// ═════════════════════════════════════════════
const impactLevels = [
  { level: 1, label: '軽微', desc: '業務への影響がほぼない。対応不要。' },
  { level: 2, label: '小',   desc: '一部の業務に軽微な影響。通常業務内で対応可能。' },
  { level: 3, label: '中',   desc: '複数の業務に影響。対策が必要だが事業継続に支障なし。' },
  { level: 4, label: '大',   desc: '重要業務に深刻な影響。顧客対応・法的対応が必要。' },
  { level: 5, label: '甚大', desc: '事業継続に致命的な影響。経営レベルの対応が必須。' },
];

const likelihoodLevels = [
  { level: 1, label: '極低', desc: 'ほぼ発生しない（年1回未満）。' },
  { level: 2, label: '低',   desc: '稀に発生する可能性がある（年1〜2回）。' },
  { level: 3, label: '中',   desc: '発生する可能性がある（四半期に1回程度）。' },
  { level: 4, label: '高',   desc: '頻繁に発生する可能性がある（月1回程度）。' },
  { level: 5, label: '極高', desc: 'ほぼ確実に発生する（週1回以上）。' },
];

const riskCriteriaStatements = [
  ...impactLevels.map((l) => ({
    sql: `INSERT OR IGNORE INTO risk_criteria
      (id, organization_id, type, level, label, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), ORG_ID, 'impact', l.level, l.label, l.desc, now],
  })),
  ...likelihoodLevels.map((l) => ({
    sql: `INSERT OR IGNORE INTO risk_criteria
      (id, organization_id, type, level, label, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [uuid(), ORG_ID, 'likelihood', l.level, l.label, l.desc, now],
  })),
];

// ═════════════════════════════════════════════
// 6. リスク (Risks)
// ═════════════════════════════════════════════
const risks = [
  {
    title: 'ランサムウェア攻撃によるシステム暗号化',
    desc: '外部からのランサムウェア攻撃により、業務システムが暗号化され使用不能になるリスク。バックアップの定期検証と多層防御が必要。',
    categoryId: RCAT.c01, impact: 5, likelihood: 3, status: 'treating',
    ownerId: USER.u01, identifiedBy: USER.u01,
  },
  {
    title: '内部者による機密情報の漏洩',
    desc: '従業員による故意または過失での機密情報持ち出し。USB制御、DLP導入、退職時手続きの厳格化が対策として必要。',
    categoryId: RCAT.c02, impact: 4, likelihood: 3, status: 'treating',
    ownerId: USER.u01, identifiedBy: USER.u04,
  },
  {
    title: 'フィッシング攻撃による認証情報窃取',
    desc: '巧妙なフィッシングメールにより従業員の認証情報が窃取されるリスク。多要素認証とセキュリティ教育が対策の柱。',
    categoryId: RCAT.c01, impact: 3, likelihood: 4, status: 'monitoring',
    ownerId: USER.u10, identifiedBy: USER.u01,
  },
  {
    title: 'サーバールーム電源障害',
    desc: '停電・電源設備故障によるサーバールームの稼働停止リスク。UPS更新と自家発電設備の導入を検討中。',
    categoryId: RCAT.c03, impact: 4, likelihood: 2, status: 'identified',
    ownerId: USER.u15, identifiedBy: USER.u15,
  },
  {
    title: 'クラウドサービス(AWS)の大規模障害',
    desc: '主要クラウドプロバイダーの広域障害による業務停止リスク。マルチリージョン構成とフェイルオーバー計画が必要。',
    categoryId: RCAT.c10, impact: 3, likelihood: 3, status: 'analyzing',
    ownerId: USER.u01, identifiedBy: USER.u10,
  },
  {
    title: '退職者アカウントの不正利用',
    desc: '退職後も残存するアカウントを利用した不正アクセスリスク。退職プロセスにおけるアカウント無効化手順の自動化が必要。',
    categoryId: RCAT.c09, impact: 4, likelihood: 2, status: 'treating',
    ownerId: USER.u05, identifiedBy: USER.u14,
  },
  {
    title: '委託先からの情報漏洩',
    desc: '業務委託先のセキュリティ管理不備による情報漏洩リスク。委託先選定基準の策定と定期監査の実施が必要。',
    categoryId: RCAT.c06, impact: 4, likelihood: 2, status: 'identified',
    ownerId: USER.u08, identifiedBy: USER.u03,
  },
  {
    title: 'ソフトウェアライセンス違反',
    desc: '使用ソフトウェアのライセンス管理不備による違反リスク。IT資産管理ツール導入と定期棚卸の実施が対策。',
    categoryId: RCAT.c05, impact: 2, likelihood: 3, status: 'monitoring',
    ownerId: USER.u10, identifiedBy: USER.u10,
  },
];

const riskStatements = risks.map((r) => ({
  sql: `INSERT OR IGNORE INTO risks
    (id, organization_id, category_id, title, description,
     impact_level, likelihood_level, risk_score, status,
     identified_date, identified_by, owner_id, assessment_period,
     created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    uuid(), ORG_ID, r.categoryId, r.title, r.desc,
    r.impact, r.likelihood, r.impact * r.likelihood, r.status,
    '2026-01-15', r.identifiedBy, r.ownerId, 'FY2025',
    now, now,
  ],
}));

// ═════════════════════════════════════════════
// 7. タスクカテゴリ (Task Categories)
// ═════════════════════════════════════════════
const taskCategories = [
  { id: TCAT.t01, name: 'ISMS構築',           color: '#3B82F6', icon: 'shield',    order: 1 },
  { id: TCAT.t02, name: 'リスク対応',         color: '#EF4444', icon: 'alert',     order: 2 },
  { id: TCAT.t03, name: '文書管理',           color: '#22C55E', icon: 'file',      order: 3 },
  { id: TCAT.t04, name: '教育・訓練',         color: '#F97316', icon: 'book',      order: 4 },
  { id: TCAT.t05, name: '内部監査',           color: '#8B5CF6', icon: 'search',    order: 5 },
  { id: TCAT.t06, name: 'マネジメントレビュー', color: '#EC4899', icon: 'chart',    order: 6 },
  { id: TCAT.t07, name: 'インシデント対応',   color: '#EAB308', icon: 'warning',   order: 7 },
  { id: TCAT.t08, name: '是正処置',           color: '#14B8A6', icon: 'check',     order: 8 },
];

const taskCategoryStatements = taskCategories.map((c) => ({
  sql: `INSERT OR IGNORE INTO task_categories
    (id, organization_id, name, color, icon, display_order, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [c.id, ORG_ID, c.name, c.color, c.icon, c.order, now, now],
}));

// ═════════════════════════════════════════════
// 8. 文書 (Documents)
// ═════════════════════════════════════════════
const documents = [
  {
    title: '情報セキュリティ基本方針',
    desc: '当社の情報セキュリティに関する基本方針を定めた最上位文書。経営層の承認済み。',
    status: 'approved', category: 'policy', createdBy: USER.u04, approvedBy: USER.u04,
    approvedAt: '2026-01-20T10:00:00.000Z',
  },
  {
    title: 'リスクアセスメント手順書',
    desc: 'リスクの特定・分析・評価の手順および判定基準を定めた手順書。',
    status: 'approved', category: 'procedure', createdBy: USER.u01, approvedBy: USER.u03,
    approvedAt: '2026-02-01T14:00:00.000Z',
  },
  {
    title: 'インシデント対応手順書',
    desc: '情報セキュリティインシデント発生時の対応手順、連絡体制、報告フローを定義。',
    status: 'in_review', category: 'procedure', createdBy: USER.u01, approvedBy: null,
    approvedAt: null,
  },
  {
    title: 'アクセス制御ポリシー',
    desc: '情報資産へのアクセス制御に関する方針。最小権限の原則、認証要件を規定。',
    status: 'draft', category: 'policy', createdBy: USER.u10, approvedBy: null,
    approvedAt: null,
  },
  {
    title: '教育訓練計画書',
    desc: 'FY2025年度の情報セキュリティ教育・訓練の年間計画。対象者・実施時期・内容を記載。',
    status: 'approved', category: 'plan', createdBy: USER.u05, approvedBy: USER.u04,
    approvedAt: '2026-01-25T09:00:00.000Z',
  },
  {
    title: '事業継続計画(BCP)',
    desc: '大規模災害・システム障害発生時の事業継続に関する計画。復旧優先順位・体制を定義。',
    status: 'draft', category: 'plan', createdBy: USER.u03, approvedBy: null,
    approvedAt: null,
  },
];

const documentStatements = documents.map((d) => ({
  sql: `INSERT OR IGNORE INTO documents
    (id, organization_id, title, description, file_name, file_path, file_size, mime_type,
     version_number, status, category, tags, folder_id,
     created_by, updated_by, approved_by, approved_at, retention_delete_at,
     created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    uuid(), ORG_ID, d.title, d.desc, null, null, null, null,
    1, d.status, d.category, null, null,
    d.createdBy, d.createdBy, d.approvedBy, d.approvedAt, null,
    now, now,
  ],
}));

// ═════════════════════════════════════════════
// 9. 監査計画 (Audit Plans)
// ═════════════════════════════════════════════
const auditPlans = [
  {
    title: 'FY2025 内部監査（第1回）',
    desc: '2025年度第1回内部監査。情報システム部・開発部門を対象にISMS運用状況を確認。',
    auditType: 'internal', standard: 'ISO27001:2022',
    plannedStart: '2025-10-01', plannedEnd: '2025-10-31',
    actualStart: '2025-10-03', actualEnd: '2025-10-28',
    status: 'completed', period: 'FY2025-H1',
  },
  {
    title: 'FY2025 内部監査（第2回）',
    desc: '2025年度第2回内部監査。全部門を対象とした認証審査前の総合内部監査。',
    auditType: 'internal', standard: 'ISO27001:2022',
    plannedStart: '2026-02-01', plannedEnd: '2026-02-28',
    actualStart: '2026-02-03', actualEnd: null,
    status: 'in_progress', period: 'FY2025-H2',
  },
  {
    title: '認証審査（ステージ1）',
    desc: 'ISO27001認証取得に向けた第三者審査機関によるステージ1審査。文書審査中心。',
    auditType: 'external', standard: 'ISO27001:2022',
    plannedStart: '2026-04-14', plannedEnd: '2026-04-16',
    actualStart: null, actualEnd: null,
    status: 'planning', period: 'FY2026',
  },
];

const auditPlanStatements = auditPlans.map((a) => ({
  sql: `INSERT OR IGNORE INTO audit_plans
    (id, organization_id, title, description, audit_type, standard,
     planned_start_date, planned_end_date, actual_start_date, actual_end_date,
     lead_auditor_id, status, audit_period, audited_unit_id,
     auditor_signature, auditor_signed_at,
     created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    uuid(), ORG_ID, a.title, a.desc, a.auditType, a.standard,
    a.plannedStart, a.plannedEnd, a.actualStart, a.actualEnd,
    USER.u12, a.status, a.period, null,
    null, null,
    now, now,
  ],
}));

// ═════════════════════════════════════════════
// 10. タスク (Tasks)
// ═════════════════════════════════════════════
const tasks = [
  {
    title: '情報セキュリティ方針の最終承認取得',
    desc: '経営層による情報セキュリティ基本方針の最終レビューと承認を取得する。',
    categoryId: TCAT.t01, assigneeId: USER.u01, reporterId: USER.u04,
    status: 'done', priority: 'high', dueDate: '2026-01-31',
    estimatedHours: 8, actualHours: 6, progress: 100, completedAt: '2026-01-20T15:00:00.000Z',
  },
  {
    title: 'リスクアセスメント実施（第2四半期）',
    desc: '全部門の情報資産に対するリスクアセスメントを実施し、リスク対応計画を策定する。',
    categoryId: TCAT.t02, assigneeId: USER.u01, reporterId: USER.u04,
    status: 'in_progress', priority: 'high', dueDate: '2026-03-31',
    estimatedHours: 40, actualHours: 20, progress: 50, completedAt: null,
  },
  {
    title: '全社セキュリティ教育の実施',
    desc: '全従業員を対象とした情報セキュリティ意識向上教育（eラーニング＋集合研修）を実施する。',
    categoryId: TCAT.t04, assigneeId: USER.u05, reporterId: USER.u01,
    status: 'todo', priority: 'medium', dueDate: '2026-04-30',
    estimatedHours: 24, actualHours: 0, progress: 0, completedAt: null,
  },
  {
    title: 'サーバールーム入退室管理の改善',
    desc: 'サーバールームの入退室管理をICカード認証+生体認証の二要素に強化する。',
    categoryId: TCAT.t02, assigneeId: USER.u15, reporterId: USER.u01,
    status: 'in_progress', priority: 'medium', dueDate: '2026-04-15',
    estimatedHours: 16, actualHours: 8, progress: 40, completedAt: null,
  },
  {
    title: '委託先管理台帳の整備',
    desc: '全委託先のセキュリティ評価シートを更新し、管理台帳として一元化する。',
    categoryId: TCAT.t03, assigneeId: USER.u08, reporterId: USER.u03,
    status: 'todo', priority: 'low', dueDate: '2026-05-31',
    estimatedHours: 20, actualHours: 0, progress: 0, completedAt: null,
  },
];

const taskStatements = tasks.map((t) => ({
  sql: `INSERT OR IGNORE INTO tasks
    (id, organization_id, title, description, category_id, assignee_id, reporter_id,
     status, priority, due_date, estimated_hours, actual_hours, progress,
     parent_task_id, related_document_id, related_risk_id, completed_at,
     created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    uuid(), ORG_ID, t.title, t.desc, t.categoryId, t.assigneeId, t.reporterId,
    t.status, t.priority, t.dueDate, t.estimatedHours, t.actualHours, t.progress,
    null, null, null, t.completedAt,
    now, now,
  ],
}));

// ═════════════════════════════════════════════
// 実行
// ═════════════════════════════════════════════
const summary = [];

async function main() {
  console.log('========================================');
  console.log(' Riscala AI for ISMS シードスクリプト (SQLite/libSQL)');
  console.log(' モデル企業: Dev Manufacturing 株式会社 + Dev Solutions 株式会社');
  console.log('========================================');
  console.log(`接続先: ${process.env.TURSO_DATABASE_URL ?? 'file:local.db'}`);
  console.log(`実行日時: ${now}`);

  let n;

  n = await run('1. 組織 (organizations)', orgStatements);
  summary.push(['organizations', orgStatements.length]);

  n = await run('2a. 部門 — Org1 (organization_departments)', deptStatements);
  n = await run('2b. 部門 — Org2 (organization_departments)', dept2Statements);
  summary.push(['organization_departments', departments.length + departments2.length]);

  n = await run('3a. ユーザー — Org1 (user)', userStatements);
  summary.push(['user', users.length + 2 + org2Users.length]);

  n = await run('3b. アカウント — Org1 (account)', accountStatements);
  summary.push(['account', users.length + 2 + org2Users.length]);

  n = await run('3c. ユーザープロフィール — Org1 (user_profiles)', profileStatements);
  summary.push(['user_profiles', users.length + 2 + org2Users.length]);

  n = await run('3d. メンバーシップ — Org1 (user_memberships)', membershipStatements);
  summary.push(['user_memberships', users.length + sysopMembershipStatements.length + org2MembershipStatements.length]);

  n = await run('3e. 権限セット — Org1 (user_permission_sets)', permissionStatements);
  summary.push(['user_permission_sets', users.length + sysopPermissionStatements.length + org2PermissionStatements.length]);

  // 3f. スーパー管理者
  n = await run('3f. スーパー管理者 (super_admin)', [superAdminUserStmt, superAdminAccountStmt, superAdminProfileStmt]);

  // 3g. システム運営者
  n = await run('3g. システム運営者 (system_operator)', [sysopUserStmt, sysopAccountStmt, sysopProfileStmt, ...sysopMembershipStatements, ...sysopPermissionStatements]);

  // 3h. Org2 ユーザー
  n = await run('3h. Org2 ユーザー (user)', org2UserStatements);
  n = await run('3h. Org2 アカウント (account)', org2AccountStatements);
  n = await run('3h. Org2 プロフィール (user_profiles)', org2ProfileStatements);
  n = await run('3h. Org2 メンバーシップ (user_memberships)', org2MembershipStatements);
  n = await run('3h. Org2 権限セット (user_permission_sets)', org2PermissionStatements);

  n = await run('4. リスクカテゴリ (risk_categories)', riskCategoryStatements);
  summary.push(['risk_categories', riskCategories.length]);

  n = await run('5. リスク基準 (risk_criteria)', riskCriteriaStatements);
  summary.push(['risk_criteria', impactLevels.length + likelihoodLevels.length]);

  n = await run('6. リスク (risks)', riskStatements);
  summary.push(['risks', risks.length]);

  n = await run('7. タスクカテゴリ (task_categories)', taskCategoryStatements);
  summary.push(['task_categories', taskCategories.length]);

  n = await run('8. 文書 (documents)', documentStatements);
  summary.push(['documents', documents.length]);

  n = await run('9. 監査計画 (audit_plans)', auditPlanStatements);
  summary.push(['audit_plans', auditPlans.length]);

  n = await run('10. タスク (tasks)', taskStatements);
  summary.push(['tasks', tasks.length]);

  // サマリーテーブル出力
  console.log('\n========================================');
  console.log(' シード完了 — サマリー');
  console.log('========================================');
  console.log('テーブル名                    | 件数');
  console.log('------------------------------|------');
  let total = 0;
  for (const [table, count] of summary) {
    console.log(`${table.padEnd(30)}| ${count}`);
    total += count;
  }
  console.log('------------------------------|------');
  console.log(`${'合計'.padEnd(30)}| ${total}`);
  console.log('========================================\n');

  db.close();
}

main().catch((err) => {
  console.error('シード実行エラー:', err);
  process.exit(1);
});
