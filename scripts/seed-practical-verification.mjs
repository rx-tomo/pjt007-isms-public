#!/usr/bin/env node
/**
 * Practical verification seed for the current Riscala AI for ISMS goal.
 *
 * This seed is intentionally separate from the general demo seed. It creates
 * deterministic organizations that can be reset and reused while W-02 and
 * later yearly-operation journeys grow.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const dryRun = args.includes('--dry-run');
const scenarioArgIndex = args.findIndex((arg) => arg === '--scenario');
const scenario = scenarioArgIndex >= 0 ? args[scenarioArgIndex + 1] : 'all';

const supportedScenarios = ['all', 'initial', 'surveillance', 'enterprise', 'suspended'];

if (!supportedScenarios.includes(scenario)) {
  throw new Error(`unsupported --scenario: ${scenario}`);
}

const now = new Date().toISOString();
const nowMs = Date.now();
const seedSource = 'practical-verification-v1';
const bcryptPlaceholder = '$2b$10$placeholderHashForPracticalSeedOnlyXXXXXXXXXX';

const ids = {
  initialOrg: '70000000-0000-4000-8000-000000000001',
  surveillanceOrg: '70000000-0000-4000-8000-000000000002',
  enterpriseOrg: '70000000-0000-4000-8000-000000000003',
  suspendedOrg: '70000000-0000-4000-8000-000000000004',
  sharedOperatorUser: '72000000-0000-4000-8000-999900000001',
  sharedOperatorAccount: '72010000-0000-4000-8000-999900000001',
  sharedOperatorInitialMembership: '72020000-0000-4000-8000-999900000001',
  sharedOperatorSurveillanceMembership: '72020000-0000-4000-8000-999900000002',
  sharedOperatorEnterpriseMembership: '72020000-0000-4000-8000-999900000003',
  sharedOperatorInitialPermission: '72030000-0000-4000-8000-999900000001',
  sharedOperatorSurveillancePermission: '72030000-0000-4000-8000-999900000002',
  sharedOperatorEnterprisePermission: '72030000-0000-4000-8000-999900000003',
};

const orgs = [
  {
    scenario: 'initial',
    id: ids.initialOrg,
    name: '初回登録準備モデル株式会社',
    name_en: 'Initial Certification Model Co., Ltd.',
    employee_count_range: '51-100',
    industry: 'B2B SaaS / Web development',
    iso_certification_status: 'planning',
    subscription_plan: 'trial',
    subscription_status: 'active',
    isms_phase: 'initial',
    isms_phase_set_at: now,
    trial_ends_at: null,
    ai_config: JSON.stringify({ seedSource, story: 'initial' }),
    deleted_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    scenario: 'surveillance',
    id: ids.surveillanceOrg,
    name: '継続運用モデル株式会社',
    name_en: 'Annual Operation Model Co., Ltd.',
    employee_count_range: '101-300',
    industry: 'Managed service / Operations',
    iso_certification_status: 'certified',
    subscription_plan: 'standard',
    subscription_status: 'active',
    isms_phase: 'surveillance',
    isms_phase_set_at: now,
    trial_ends_at: null,
    ai_config: JSON.stringify({ seedSource, story: 'surveillance' }),
    deleted_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    scenario: 'enterprise',
    id: ids.enterpriseOrg,
    name: '製造委託管理モデル株式会社',
    name_en: 'Manufacturing Supplier Governance Model Co., Ltd.',
    employee_count_range: '301-1000',
    industry: 'Manufacturing / Supplier management',
    iso_certification_status: 'in_progress',
    subscription_plan: 'enterprise',
    subscription_status: 'active',
    isms_phase: 'surveillance',
    isms_phase_set_at: now,
    trial_ends_at: null,
    ai_config: JSON.stringify({ seedSource, story: 'enterprise-supplier-governance' }),
    deleted_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    scenario: 'suspended',
    id: ids.suspendedOrg,
    name: '休止中モデル株式会社',
    name_en: 'Suspended Low Maturity Model Co., Ltd.',
    employee_count_range: '1-50',
    industry: 'Professional services / Early ISMS',
    iso_certification_status: 'planning',
    subscription_plan: 'starter',
    subscription_status: 'suspended',
    isms_phase: 'initial',
    isms_phase_set_at: now,
    trial_ends_at: null,
    ai_config: JSON.stringify({ seedSource, story: 'suspended-low-maturity' }),
    deleted_at: null,
    created_at: now,
    updated_at: now,
  },
];

const departments = [
  dept('initial', '01', '経営管理部', 'Management', '佐藤真理', 8),
  dept('initial', '02', '情報システム部', 'IT Department', '田中航', 12),
  dept('initial', '03', '開発部', 'Development', '鈴木玲奈', 42),
  dept('initial', '04', '営業・CS部', 'Sales and Customer Success', '高橋誠', 18),
  dept('surveillance', '01', '経営管理部', 'Management', '山本彩', 14),
  dept('surveillance', '02', '情報システム部', 'IT Department', '井上拓', 20),
  dept('surveillance', '03', '運用部', 'Operations', '小林優', 65),
  dept('surveillance', '04', '品質保証部', 'Quality Assurance', '中村凛', 10),
  dept('enterprise', '01', '経営管理部', 'Management', '森田直子', 18),
  dept('enterprise', '02', '情報システム部', 'IT Department', '加藤大地', 35),
  dept('enterprise', '03', '製造管理部', 'Manufacturing Control', '藤井健', 120),
  dept('enterprise', '04', '購買・委託先管理部', 'Procurement and Supplier Governance', '石川葵', 42),
  dept('suspended', '01', '経営管理部', 'Management', '原田恵', 4),
  dept('suspended', '02', '情報管理担当', 'Information Management', '青木航', 3),
  dept('suspended', '03', '事業部', 'Business Operations', '宮本彩', 18),
  dept('suspended', '04', '外部監査対応', 'Audit Liaison', '西村優', 2),
];

const users = [
  user('initial', '01', 'org_admin', '佐藤真理', 'sato.initial@isms-practical.local', '経営管理部', '代表取締役/CISO', '01', { is_ciso: 1, is_org_admin: 1 }),
  user('initial', '02', 'org_admin', '田中航', 'tanaka.initial@isms-practical.local', '情報システム部', 'ISMS推進責任者', '02', { is_security_manager: 1, is_org_admin: 1, is_isms_promoter: 1 }),
  user('initial', '03', 'approver', '鈴木玲奈', 'suzuki.initial@isms-practical.local', '開発部', '開発部長', '03', {}),
  user('initial', '04', 'auditor', '松本結衣', 'matsumoto.initial@isms-practical.local', '経営管理部', '内部監査候補者', '01', { is_audit_committee: 1 }),
  user('initial', '05', 'user', '高橋誠', 'takahashi.initial@isms-practical.local', '営業・CS部', '部門責任者', '04', {}),
  user('surveillance', '01', 'org_admin', '山本彩', 'yamamoto.surveillance@isms-practical.local', '経営管理部', 'CISO', '01', { is_ciso: 1, is_org_admin: 1 }),
  user('surveillance', '02', 'org_admin', '井上拓', 'inoue.surveillance@isms-practical.local', '情報システム部', 'ISMS事務局長', '02', { is_security_manager: 1, is_org_admin: 1, is_isms_promoter: 1 }),
  user('surveillance', '03', 'auditor', '中村凛', 'nakamura.surveillance@isms-practical.local', '品質保証部', '内部監査責任者', '04', { is_audit_committee: 1 }),
  user('surveillance', '04', 'approver', '小林優', 'kobayashi.surveillance@isms-practical.local', '運用部', '運用部長', '03', {}),
  user('surveillance', '05', 'user', '伊藤悠', 'ito.surveillance@isms-practical.local', '運用部', 'サービス運用担当', '03', {}),
  user('enterprise', '01', 'org_admin', '森田直子', 'morita.enterprise@isms-practical.local', '経営管理部', 'CISO / 執行役員', '01', { is_ciso: 1, is_org_admin: 1 }),
  user('enterprise', '02', 'org_admin', '加藤大地', 'kato.enterprise@isms-practical.local', '情報システム部', 'ISMS統括責任者', '02', { is_security_manager: 1, is_org_admin: 1, is_isms_promoter: 1 }),
  user('enterprise', '03', 'approver', '藤井健', 'fujii.enterprise@isms-practical.local', '製造管理部', '製造管理部長', '03', {}),
  user('enterprise', '04', 'auditor', '石川葵', 'ishikawa.enterprise@isms-practical.local', '購買・委託先管理部', '委託先監査責任者', '04', { is_audit_committee: 1 }),
  user('enterprise', '05', 'user', '長谷川亮', 'hasegawa.enterprise@isms-practical.local', '購買・委託先管理部', '委託先管理担当', '04', {}),
  user('suspended', '01', 'org_admin', '原田恵', 'harada.suspended@isms-practical.local', '経営管理部', '代表/CISO', '01', { is_ciso: 1, is_org_admin: 1 }),
  user('suspended', '02', 'org_admin', '青木航', 'aoki.suspended@isms-practical.local', '情報管理担当', 'ISMS再開担当', '02', { is_security_manager: 1, is_org_admin: 1, is_isms_promoter: 1 }),
  user('suspended', '03', 'approver', '宮本彩', 'miyamoto.suspended@isms-practical.local', '事業部', '事業責任者', '03', {}),
  user('suspended', '04', 'auditor', '西村優', 'nishimura.suspended@isms-practical.local', '外部監査対応', '内部監査候補', '04', { is_audit_committee: 1 }),
  user('suspended', '05', 'user', '小川真', 'ogawa.suspended@isms-practical.local', '事業部', '業務担当', '03', {}),
];

const sharedOperator = {
  id: ids.sharedOperatorUser,
  organization_id: ids.initialOrg,
  email: 'operator.practical@isms-practical.local',
  full_name: 'Riscala AI for ISMS システム運営者',
  full_name_en: 'Riscala AI for ISMS System Operator',
  role: 'system_operator',
  department: '横断運営',
  position: 'Riscala AI for ISMS 運営オペレーター',
  phone: null,
  avatar_url: null,
  is_active: 1,
  language_preference: 'ja',
  primary_department_id: null,
  is_ciso: 0,
  is_security_manager: 0,
  is_org_admin: 0,
  is_audit_committee: 0,
  is_isms_promoter: 0,
  last_login_at: null,
  created_at: now,
  updated_at: now,
};

const sharedOperatorMemberships = [
  sharedMembership('initial', ids.sharedOperatorInitialMembership),
  sharedMembership('surveillance', ids.sharedOperatorSurveillanceMembership),
  sharedMembership('enterprise', ids.sharedOperatorEnterpriseMembership),
];

const sharedOperatorPermissions = [
  sharedPermission('initial', ids.sharedOperatorInitialPermission),
  sharedPermission('surveillance', ids.sharedOperatorSurveillancePermission),
  sharedPermission('enterprise', ids.sharedOperatorEnterprisePermission),
];

const projectRoles = [
  role('initial', 'isms_owner', 'ISMS責任者', '経営責任とISMS方針の最終判断を担う', 1, 1, ['方針承認', '適用範囲承認', '審査登録準備判断']),
  role('initial', 'secretariat', 'ISMS推進事務局', '初回登録準備の進行管理を担う', 2, 1, ['タスク管理', '文書整備', '証跡収集']),
  role('initial', 'asset_owner', '情報資産オーナー', '部門の情報資産登録と分類を担う', 3, 1, ['資産登録', '分類判断', '棚卸し']),
  role('initial', 'risk_owner', 'リスクオーナー', 'リスク評価と対応計画を担う', 4, 1, ['リスク評価', '対応策検討', '残留リスク確認']),
  role('initial', 'internal_auditor', '内部監査員候補', '初回審査前の内部確認を担う', 5, 0, ['監査準備', 'チェックリスト確認']),
  role('surveillance', 'isms_owner', 'ISMS責任者', '年次運用と経営レビュー判断を担う', 1, 1, ['年次計画承認', 'マネジメントレビュー', '改善判断']),
  role('surveillance', 'secretariat', 'ISMS事務局', '年次運用の証跡と期限管理を担う', 2, 1, ['月次確認', '期限管理', '証跡整理']),
  role('surveillance', 'internal_auditor', '内部監査責任者', '内部監査と是正確認を担う', 3, 1, ['監査計画', '不適合確認', '是正フォロー']),
  role('surveillance', 'operations_owner', '運用責任者', '運用部門の管理策実施を担う', 4, 1, ['運用記録', 'インシデント初動', '改善タスク']),
  role('enterprise', 'isms_owner', 'ISMS責任者', '委託先を含むISMS統制の最終判断を担う', 1, 1, ['方針承認', '委託先統制', '経営レビュー']),
  role('enterprise', 'secretariat', 'ISMS統括事務局', '複数部門と委託先の証跡を集約する', 2, 1, ['証跡集約', '委託先評価', '進捗管理']),
  role('enterprise', 'supplier_owner', '委託先管理責任者', '主要委託先の契約・評価・改善を担う', 3, 1, ['委託先評価', '契約管理', '改善要求']),
  role('enterprise', 'internal_auditor', '委託先監査責任者', '委託先監査と内部監査の実施を担う', 4, 1, ['監査計画', '是正確認', '証跡レビュー']),
  role('suspended', 'isms_owner', 'ISMS再開責任者', '休止状態からの再開可否と優先度を判断する', 1, 1, ['再開判断', '方針見直し', 'リスク受容']),
  role('suspended', 'secretariat', '再開準備担当', '不足データの棚卸しと再開準備を担う', 2, 1, ['データ棚卸し', '文書更新', '利用再開準備']),
  role('suspended', 'business_owner', '事業責任者', '事業部門側の影響確認を担う', 3, 1, ['影響確認', 'タスク実行', '教育再開']),
  role('suspended', 'audit_liaison', '監査対応担当', '外部審査・内部確認の再開準備を担う', 4, 0, ['監査準備', '証跡確認']),
];

const assignments = [
  assignment('initial', 'isms_owner', '01'),
  assignment('initial', 'secretariat', '02'),
  assignment('initial', 'asset_owner', '05'),
  assignment('initial', 'risk_owner', '03'),
  assignment('initial', 'internal_auditor', '04'),
  assignment('surveillance', 'isms_owner', '01'),
  assignment('surveillance', 'secretariat', '02'),
  assignment('surveillance', 'internal_auditor', '03'),
  assignment('surveillance', 'operations_owner', '04'),
  assignment('enterprise', 'isms_owner', '01'),
  assignment('enterprise', 'secretariat', '02'),
  assignment('enterprise', 'supplier_owner', '05'),
  assignment('enterprise', 'internal_auditor', '04'),
  assignment('suspended', 'isms_owner', '01'),
  assignment('suspended', 'secretariat', '02'),
  assignment('suspended', 'business_owner', '03'),
  assignment('suspended', 'audit_liaison', '04'),
];

const scopes = [
  {
    scenario: 'initial',
    id: id('initial', 'scope', '01'),
    organization_id: ids.initialOrg,
    physical_locations: JSON.stringify(['東京本社', 'リモート勤務環境']),
    it_systems: JSON.stringify(['顧客管理SaaS', '開発リポジトリ', '社内ID基盤']),
    departments: JSON.stringify(['経営管理部', '情報システム部', '開発部', '営業・CS部']),
    processes: JSON.stringify(['SaaS開発', '顧客サポート', '委託先管理', 'アカウント管理']),
    exclusions: JSON.stringify(['海外拠点なし', '自社データセンター運用なし']),
    created_at: now,
    updated_at: now,
  },
  {
    scenario: 'surveillance',
    id: id('surveillance', 'scope', '01'),
    organization_id: ids.surveillanceOrg,
    physical_locations: JSON.stringify(['東京本社', '大阪サポート拠点', 'リモート勤務環境']),
    it_systems: JSON.stringify(['運用監視基盤', 'チケット管理', '顧客ポータル', 'ID管理基盤']),
    departments: JSON.stringify(['経営管理部', '情報システム部', '運用部', '品質保証部']),
    processes: JSON.stringify(['サービス運用', '障害対応', '内部監査', '継続改善']),
    exclusions: JSON.stringify(['製造設備なし']),
    created_at: now,
    updated_at: now,
  },
  {
    scenario: 'enterprise',
    id: id('enterprise', 'scope', '01'),
    organization_id: ids.enterpriseOrg,
    physical_locations: JSON.stringify(['本社', '東日本工場', '西日本物流センター', 'リモート勤務環境']),
    it_systems: JSON.stringify(['生産管理システム', '委託先ポータル', 'ERP', '社内ID基盤']),
    departments: JSON.stringify(['経営管理部', '情報システム部', '製造管理部', '購買・委託先管理部']),
    processes: JSON.stringify(['製造委託管理', '委託先評価', '生産情報管理', 'アクセスレビュー']),
    exclusions: JSON.stringify(['海外子会社の現地製造ラインは別ISMS']),
    created_at: now,
    updated_at: now,
  },
  {
    scenario: 'suspended',
    id: id('suspended', 'scope', '01'),
    organization_id: ids.suspendedOrg,
    physical_locations: JSON.stringify(['小規模本社', 'リモート勤務環境']),
    it_systems: JSON.stringify(['ファイル共有', 'メール', '顧客管理表']),
    departments: JSON.stringify(['経営管理部', '情報管理担当', '事業部', '外部監査対応']),
    processes: JSON.stringify(['契約管理', '顧客情報管理', '利用再開準備']),
    exclusions: JSON.stringify(['認証審査は未予定', '本番SaaS連携なし']),
    created_at: now,
    updated_at: now,
  },
];

const documentTemplates = [
  template('policy-basic-ja', '情報セキュリティ基本方針テンプレート', '初回登録準備で最初に整える方針文書', 'policy', 'ISO 27001:2022 5.2', '# 情報セキュリティ基本方針\n\n目的、適用範囲、責任、継続的改善を記載する。'),
  template('scope-statement-ja', 'ISMS適用範囲記述書テンプレート', '組織、拠点、システム、除外事項を整理する', 'form', 'ISO 27001:2022 4.3', '# ISMS適用範囲\n\n対象部門、業務、情報システム、除外事項を記載する。'),
  template('risk-procedure-ja', 'リスクアセスメント手順書テンプレート', 'リスク評価基準と対応方針を記録する', 'procedure', 'ISO 27001:2022 6.1', '# リスクアセスメント手順\n\n特定、分析、評価、対応、レビューの手順を記載する。'),
  template('audit-checklist-ja', '内部監査チェックリストテンプレート', '継続運用で内部監査証跡を残す', 'checklist', 'ISO 27001:2022 9.2', '# 内部監査チェックリスト\n\n監査項目、確認結果、証跡、不適合を記載する。'),
];

const documents = [
  doc('initial', '01', '情報セキュリティ基本方針 ドラフト', '初回登録準備として経営者承認前の基本方針を作成する。', 'draft', 'policy', '01', null, null),
  doc('initial', '02', 'ISMS適用範囲記述書', '初回審査登録に向けた対象範囲と除外事項の整理。', 'in_review', 'form', '02', '01', null),
  doc('initial', '03', 'リスクアセスメント手順書 ドラフト', '資産、脅威、脆弱性、評価基準を整理するための手順書。', 'draft', 'procedure', '02', null, null),
  doc('surveillance', '01', '情報セキュリティ基本方針 2026年版', '継続運用中の承認済み基本方針。', 'approved', 'policy', '01', '01', '2026-04-01T09:00:00.000Z'),
  doc('surveillance', '02', 'リスクアセスメント手順書 2026年版', '年次見直し済みのリスク評価手順。', 'approved', 'procedure', '02', '01', '2026-04-05T09:00:00.000Z'),
  doc('surveillance', '03', '内部監査計画書 2026', '年次内部監査の対象、日程、監査員を整理する。', 'in_review', 'plan', '03', null, null),
  doc('surveillance', '04', 'マネジメントレビュー議事録 下書き', '年次レビューの入力情報と決定事項を整理する下書き。', 'draft', 'form', '02', null, null),
  doc('enterprise', '01', '委託先情報セキュリティ要求事項', '主要委託先へ提示するセキュリティ要求事項と評価基準。', 'approved', 'policy', '02', '01', '2026-05-10T09:00:00.000Z'),
  doc('enterprise', '02', '主要委託先評価票 2026', '製造委託先と物流委託先の評価結果をまとめる。', 'in_review', 'form', '05', null, null),
  doc('enterprise', '03', '製造データ取扱手順書', '製造データと委託先共有データの分類、保管、削除手順。', 'approved', 'procedure', '02', '01', '2026-05-12T09:00:00.000Z'),
  doc('suspended', '01', '情報セキュリティ基本方針 旧版', '利用休止前の旧方針。再開時に見直しが必要。', 'draft', 'policy', '02', null, null),
  doc('suspended', '02', 'ISMS再開準備チェックリスト', '休止状態から再開するための最低限の確認項目。', 'draft', 'checklist', '02', null, null),
];

const riskCategories = [
  riskCategory('initial', '01', 'アクセス管理', '初回登録準備で優先して確認するID/権限リスク', '#2563EB', 1),
  riskCategory('initial', '02', '委託先管理', 'クラウド/外部委託先の管理不足リスク', '#7C3AED', 2),
  riskCategory('initial', '03', 'データ管理', '顧客データや機密情報の取扱いリスク', '#DC2626', 3),
  riskCategory('surveillance', '01', '運用管理', '継続運用で発生する手順逸脱や証跡不足リスク', '#0891B2', 1),
  riskCategory('surveillance', '02', 'インシデント対応', '検知、初動、報告の遅れに関するリスク', '#EA580C', 2),
  riskCategory('surveillance', '03', '継続改善', '是正やレビューが形骸化するリスク', '#16A34A', 3),
  riskCategory('enterprise', '01', '委託先管理', '委託先の契約、評価、証跡不足リスク', '#7C3AED', 1),
  riskCategory('enterprise', '02', '製造データ管理', '製造情報と委託先共有データの取扱いリスク', '#DC2626', 2),
  riskCategory('enterprise', '03', 'アクセス管理', '委託先ポータルとERP権限の管理リスク', '#2563EB', 3),
  riskCategory('suspended', '01', '再開準備', '休止後の情報更新不足や責任不明確リスク', '#EA580C', 1),
  riskCategory('suspended', '02', 'データ管理', '小規模運用での台帳・権限・証跡不足リスク', '#DC2626', 2),
  riskCategory('suspended', '03', '教育・認識', '利用再開時の教育不足リスク', '#16A34A', 3),
];

const riskCriteria = [
  ...criteriaSet('initial'),
  ...criteriaSet('surveillance'),
  ...criteriaSet('enterprise'),
  ...criteriaSet('suspended'),
];

const informationAssets = [
  asset('initial', '01', '顧客問い合わせ履歴', 'data', 'restricted', 'high', '05', '顧客管理SaaS', '顧客名、問い合わせ内容、契約状況を含む。'),
  asset('initial', '02', '開発リポジトリ', 'service', 'internal', 'high', '03', 'Git hosting service', 'ソースコード、issue、CI設定を含む。'),
  asset('initial', '03', '社内ID基盤', 'service', 'restricted', 'high', '02', 'Cloud IdP', '従業員認証と権限管理の中核。'),
  asset('surveillance', '01', '運用監視ログ', 'data', 'internal', 'high', '04', 'Monitoring platform', '障害検知、アラート、対応履歴を含む。'),
  asset('surveillance', '02', '顧客ポータル', 'service', 'restricted', 'high', '02', 'Production cloud', '認証済み顧客が利用するサービス入口。'),
  asset('surveillance', '03', '内部監査証跡フォルダ', 'data', 'internal', 'medium', '03', 'Document storage', '監査チェックリスト、是正記録、レビュー記録を含む。'),
  asset('enterprise', '01', '委託先評価台帳', 'data', 'restricted', 'high', '05', 'Supplier portal', '委託先評価、契約、改善要求の履歴を含む。'),
  asset('enterprise', '02', '生産管理システム', 'service', 'restricted', 'high', '03', 'Factory network', '生産計画、製造実績、品質記録を含む。'),
  asset('enterprise', '03', 'ERP購買データ', 'data', 'internal', 'medium', '04', 'ERP', '発注、検収、委託先支払情報を含む。'),
  asset('suspended', '01', '顧客管理表', 'data', 'restricted', 'medium', '03', 'Shared drive', '休止前の顧客連絡先と契約メモを含む。'),
  asset('suspended', '02', '旧ISMS文書フォルダ', 'data', 'internal', 'medium', '02', 'Shared drive', '旧方針、旧台帳、旧教育資料を含む。'),
  asset('suspended', '03', 'メールアカウント', 'service', 'internal', 'medium', '02', 'Cloud mail', '利用再開時に権限確認が必要なメール基盤。'),
];

const risks = [
  risk('initial', '01', '社内ID基盤の管理者権限が棚卸しされていない', '初回登録準備で管理者権限の妥当性と棚卸し証跡が不足している。', '01', 4, 3, 'treating', '02', '02', '2026-06-01'),
  risk('initial', '02', '委託先のセキュリティ確認が未完了', 'クラウド委託先の評価票と契約上の管理策確認が未整備。', '02', 3, 3, 'identified', '05', '02', '2026-06-02'),
  risk('initial', '03', '顧客問い合わせ履歴の分類ルールが未定義', '顧客情報の分類とアクセス範囲が文書化されていない。', '03', 4, 2, 'analyzing', '05', '02', '2026-06-03'),
  risk('surveillance', '01', '月次アクセスレビューの証跡が一部不足', 'レビュー自体は実施しているが、承認記録と例外対応の証跡が不足している。', '01', 3, 3, 'monitoring', '02', '02', '2026-05-10'),
  risk('surveillance', '02', 'インシデント訓練後の改善タスクが未完了', '訓練で見つかった連絡フロー改善が期限を超過している。', '02', 4, 2, 'treating', '04', '03', '2026-05-15'),
  risk('surveillance', '03', 'マネジメントレビューへの入力情報が散在', '監査結果、KPI、是正状況が一箇所にまとまっていない。', '03', 3, 2, 'identified', '01', '02', '2026-05-20'),
  risk('enterprise', '01', '主要委託先の評価証跡が部署ごとに分散している', '委託先評価票、契約条項、改善要求が統一台帳で追跡されていない。', '01', 4, 3, 'treating', '05', '02', '2026-06-04'),
  risk('enterprise', '02', '製造データの委託先共有範囲が古い契約のまま残っている', '生産管理システムから共有するデータ項目の見直し証跡が不足している。', '02', 5, 2, 'analyzing', '03', '02', '2026-06-05'),
  risk('enterprise', '03', '委託先ポータルの休眠アカウント棚卸しが未完了', '委託先担当者の退職・異動反映が遅れ、不要アカウントが残る恐れがある。', '03', 4, 4, 'treating', '02', '04', '2026-06-06'),
  risk('suspended', '01', '休止前の顧客管理表にアクセス権が残っている', '利用再開前に共有ドライブ権限と保管期限を確認できていない。', '02', 4, 3, 'identified', '02', '02', '2026-06-07'),
  risk('suspended', '02', '旧ISMS文書の責任者と最新版が不明確', '休止期間中の文書更新が止まり、再開時の基準文書が不明確。', '01', 3, 3, 'identified', '01', '02', '2026-06-08'),
  risk('suspended', '03', '再開時教育の対象者が整理されていない', '再開時に最低限の教育対象と受講記録を作れない可能性がある。', '03', 3, 2, 'identified', '03', '02', '2026-06-09'),
];

const riskTreatments = [
  treatment('initial', '01', '01', 'reduce', '管理者権限一覧を出力し、CISO承認付きで棚卸しする。', '02', '2026-06-20', 'in_progress'),
  treatment('initial', '02', '02', 'reduce', '主要委託先の評価票を回収し、未回答先をリスト化する。', '05', '2026-06-28', 'planned'),
  treatment('surveillance', '01', '01', 'reduce', '月次レビューの承認欄と例外対応欄を統一テンプレートへ移行する。', '02', '2026-06-25', 'in_progress'),
  treatment('surveillance', '02', '02', 'reduce', '訓練後改善タスクの期限と責任者を再設定し、週次で確認する。', '04', '2026-06-18', 'planned'),
  treatment('enterprise', '01', '01', 'reduce', '委託先評価台帳を統一し、未完了評価を購買・委託先管理部で週次確認する。', '05', '2026-07-10', 'in_progress'),
  treatment('enterprise', '02', '03', 'reduce', '委託先ポータルの休眠アカウント一覧を出力し、削除証跡を残す。', '02', '2026-07-05', 'planned'),
  treatment('suspended', '01', '01', 'reduce', '共有ドライブ権限を棚卸しし、再開までに不要権限を削除する。', '02', '2026-06-30', 'planned'),
  treatment('suspended', '02', '02', 'accept', '旧文書の再開判断までは暫定版として扱い、正式レビュー期限を設定する。', '01', '2026-07-15', 'planned'),
];

const isoControls = [
  control('initial', '01', 'A.5.15', 'Access control', 'アクセス制御', '業務要件に基づいてアクセス制御ルールを定義する。', ['access', 'initial']),
  control('initial', '02', 'A.5.19', 'Supplier relationships', '委託先管理', '委託先との情報セキュリティ要求事項を定義し確認する。', ['supplier', 'initial']),
  control('initial', '03', 'A.5.9', 'Asset inventory', '情報資産台帳', '情報資産と所有者を特定し台帳化する。', ['asset', 'initial']),
  control('surveillance', '01', 'A.5.18', 'Access rights', 'アクセス権レビュー', 'アクセス権の付与、変更、削除を定期的にレビューする。', ['access', 'surveillance']),
  control('surveillance', '02', 'A.5.24', 'Incident management planning', 'インシデント対応計画', 'インシデント対応の計画と準備を維持する。', ['incident', 'surveillance']),
  control('surveillance', '03', 'A.5.35', 'Independent review', '独立したレビュー', 'ISMSの有効性を独立した観点でレビューする。', ['review', 'surveillance']),
  control('enterprise', '01', 'A.5.19', 'Supplier relationships', '委託先管理', '委託先との情報セキュリティ要求事項を定義し確認する。', ['supplier', 'enterprise']),
  control('enterprise', '02', 'A.5.20', 'Supplier agreements', '委託先契約', '委託先契約に情報セキュリティ要求事項を含める。', ['supplier', 'contract']),
  control('enterprise', '03', 'A.5.18', 'Access rights', '委託先アクセス権レビュー', '委託先ユーザのアクセス権を定期的にレビューする。', ['access', 'supplier']),
  control('suspended', '01', 'A.5.9', 'Asset inventory', '情報資産台帳再整備', '情報資産と所有者を再特定し台帳化する。', ['asset', 'restart']),
  control('suspended', '02', 'A.5.15', 'Access control', '再開時アクセス制御', '利用再開時のアクセス権を業務要件に基づき確認する。', ['access', 'restart']),
  control('suspended', '03', 'A.6.3', 'Information security awareness', '再開時教育', '利用再開に必要な教育と認識向上を実施する。', ['education', 'restart']),
];

const riskControlLinks = [
  riskControlLink('initial', '01', '01'),
  riskControlLink('initial', '02', '02'),
  riskControlLink('surveillance', '01', '01'),
  riskControlLink('surveillance', '02', '02'),
  riskControlLink('enterprise', '01', '01'),
  riskControlLink('enterprise', '02', '03'),
  riskControlLink('suspended', '01', '02'),
  riskControlLink('suspended', '02', '01'),
];

const riskAssets = [
  riskAsset('initial', '01', '03'),
  riskAsset('initial', '02', '02'),
  riskAsset('initial', '03', '01'),
  riskAsset('surveillance', '01', '02'),
  riskAsset('surveillance', '02', '01'),
  riskAsset('surveillance', '03', '03'),
  riskAsset('enterprise', '01', '01'),
  riskAsset('enterprise', '02', '02'),
  riskAsset('enterprise', '03', '01'),
  riskAsset('suspended', '01', '01'),
  riskAsset('suspended', '02', '02'),
  riskAsset('suspended', '03', '03'),
];

const taskCategories = [
  taskCategory('initial', '01', '初回登録準備', '#2563EB', 'shield', 1),
  taskCategory('initial', '02', '資産・リスク整備', '#DC2626', 'alert', 2),
  taskCategory('initial', '03', '文書承認', '#16A34A', 'file', 3),
  taskCategory('surveillance', '01', '月次運用', '#0891B2', 'calendar', 1),
  taskCategory('surveillance', '02', '内部監査', '#7C3AED', 'search', 2),
  taskCategory('surveillance', '03', '是正・改善', '#EA580C', 'check', 3),
  taskCategory('enterprise', '01', '委託先管理', '#7C3AED', 'users', 1),
  taskCategory('enterprise', '02', 'アクセス権レビュー', '#2563EB', 'shield', 2),
  taskCategory('enterprise', '03', '製造データ統制', '#DC2626', 'database', 3),
  taskCategory('suspended', '01', '利用再開準備', '#EA580C', 'restart', 1),
  taskCategory('suspended', '02', 'データ棚卸し', '#DC2626', 'folder', 2),
  taskCategory('suspended', '03', '教育再開', '#16A34A', 'book', 3),
];

const tasks = [
  task('initial', '01', 'ISMS適用範囲をCISOに確認する', 'スコープ記述書の対象部門、ITシステム、除外事項を確認する。', '01', '02', '01', 'in_progress', 'high', '2026-06-14', 40),
  task('initial', '02', '初回登録準備の体制ロールを確定する', 'ISMS責任者、事務局、資産オーナー、リスクオーナーを確定する。', '01', '02', '01', 'todo', 'high', '2026-06-12', 10),
  task('initial', '03', '重要情報資産の初回棚卸しを完了する', '顧客問い合わせ履歴、開発リポジトリ、ID基盤の分類と所有者を登録する。', '02', '05', '02', 'in_progress', 'high', '2026-06-18', 50),
  task('initial', '04', 'リスク対応計画を管理策に紐づける', '主要リスク2件について対応策とISO管理策の関係を確認する。', '02', '03', '02', 'todo', 'medium', '2026-06-24', 0),
  task('initial', '05', '情報セキュリティ基本方針を承認依頼する', 'ドラフトをCISOに回覧し、承認待ち状態へ進める。', '03', '02', '01', 'todo', 'medium', '2026-06-21', 0),
  task('surveillance', '01', '6月のアクセスレビュー証跡を補完する', '例外承認とレビュー実施者を記録し、監査で追える状態にする。', '01', '02', '01', 'in_progress', 'high', '2026-06-15', 55),
  task('surveillance', '02', '内部監査計画書を承認依頼する', '監査範囲、監査員、対象部門、日程を確定して承認へ進める。', '02', '03', '02', 'review', 'high', '2026-06-22', 80),
  task('surveillance', '03', 'インシデント訓練後の是正タスクを更新する', '期限超過した改善タスクの責任者と期限を再設定する。', '03', '04', '03', 'todo', 'medium', '2026-06-18', 15),
  task('surveillance', '04', 'マネジメントレビュー入力情報を整理する', 'KPI、監査結果、是正状況、リスク見直しをレビュー資料へ集約する。', '03', '02', '01', 'todo', 'medium', '2026-07-05', 0),
  task('enterprise', '01', '主要委託先評価票を統一台帳へ移行する', '部署別に保管されている委託先評価票を統一台帳へ移す。', '01', '05', '02', 'in_progress', 'high', '2026-07-10', 45),
  task('enterprise', '02', '委託先ポータルの休眠アカウントを棚卸しする', '休眠アカウント一覧を確認し、削除対象と例外承認を記録する。', '02', '02', '04', 'todo', 'high', '2026-07-05', 10),
  task('enterprise', '03', '製造データ共有範囲を契約条項と照合する', '委託先に共有する製造データ項目と契約上の制限を照合する。', '03', '03', '02', 'todo', 'medium', '2026-07-18', 0),
  task('suspended', '01', '利用再開前の共有ドライブ権限を確認する', '顧客管理表と旧ISMS文書フォルダのアクセス権を棚卸しする。', '01', '02', '01', 'todo', 'high', '2026-06-30', 0),
  task('suspended', '02', '旧ISMS文書の最新版と責任者を整理する', '休止前文書の使えるもの、更新が必要なもの、破棄するものを分類する。', '02', '02', '01', 'todo', 'medium', '2026-07-08', 0),
  task('suspended', '03', '再開時教育の対象者を確定する', '再開時に受講が必要なメンバーと教育内容を決める。', '03', '03', '02', 'todo', 'medium', '2026-07-12', 0),
];

const iso27001Requirements = [
  auditRequirement('01', '4.3', 'ISMSの適用範囲', '組織はISMSの境界及び適用可能性を決定しなければならない。'),
  auditRequirement('02', '6.1.2', '情報セキュリティリスクアセスメント', '組織は情報セキュリティリスクアセスメントのプロセスを定義し適用しなければならない。'),
  auditRequirement('03', '8.1', '運用の計画及び管理', '組織は情報セキュリティ要求事項を満たすために必要なプロセスを計画し管理しなければならない。'),
  auditRequirement('04', '9.2', '内部監査', '組織はISMSが要求事項に適合しているかを判断するため内部監査を実施しなければならない。'),
  auditRequirement('05', '9.3', 'マネジメントレビュー', 'トップマネジメントはISMSの適切性、妥当性、有効性をレビューしなければならない。'),
  auditRequirement('06', '10.1', '継続的改善', '組織はISMSの適切性、妥当性及び有効性を継続的に改善しなければならない。'),
];

const auditUnits = [
  auditUnit('surveillance', '01', '情報システム部', 'process', 'アクセス権管理、ログレビュー、クラウド設定管理を対象にする。'),
  auditUnit('surveillance', '02', '運用部', 'process', 'インシデント対応、変更管理、運用証跡を対象にする。'),
];

const auditPlans = [
  auditPlan('surveillance', '01', '2026年度 第1回 内部監査', '認証維持審査に向けてアクセス管理、インシデント対応、証跡管理を確認する。', 'internal', 'scheduled', '2026-07-01', '2026-07-15', null, null, '03', 'FY2026 Q2', '01'),
  auditPlan('surveillance', '02', '2026年度 是正フォローアップ監査', '前回監査と訓練で見つかった是正処置の有効性を確認する。', 'internal', 'in_progress', '2026-08-05', '2026-08-20', '2026-08-05', null, '03', 'FY2026 Q2', '02'),
];

const auditTeamMembers = [
  auditTeamMember('surveillance', '01', '01', '03', 'lead'),
  auditTeamMember('surveillance', '02', '01', '02', 'auditor'),
  auditTeamMember('surveillance', '03', '02', '03', 'lead'),
  auditTeamMember('surveillance', '04', '02', '04', 'auditor'),
];

const auditChecklists = [
  auditChecklist('surveillance', '01', '01', '04', '内部監査計画が承認され、対象範囲と監査員が明確か', '監査計画書、承認記録', '03', 'in_progress', 'observation', '監査対象と日程は明確。証跡保管場所の統一が必要。', '内部監査計画書 2026'),
  auditChecklist('surveillance', '02', '01', '02', 'リスクアセスメント結果が年次で見直されているか', 'リスク台帳、見直し議事録', '03', 'not_started', null, null, null),
  auditChecklist('surveillance', '03', '02', '03', 'インシデント訓練後の改善タスクが期限内に管理されているか', '訓練記録、改善タスク一覧', '03', 'completed', 'minor_nc', '訓練後改善タスクの一部が期限超過している。', 'インシデント訓練記録、タスク一覧'),
  auditChecklist('surveillance', '04', '02', '06', '是正処置の有効性レビューが記録されているか', '是正処置記録、有効性レビュー', '03', 'in_progress', 'observation', '一部レビュー予定はあるが、完了記録が未整備。', null),
];

const nonconformitiesSeed = [
  nonconformity('surveillance', '01', '03', 'PV-NC-2026-001', 'minor', 'インシデント訓練後の連絡フロー改善が期限超過している。', '訓練後の改善タスクを週次確認へ載せていなかった。', '改善タスクの責任者、期限、週次確認ルールを再設定する。', '改善タスクを定例確認へ組み込む。', '04', '2026-06-18', 'in_progress', null, null, null),
];

const correctiveActionsSeed = [
  correctiveAction('surveillance', '01', '01', 'インシデント訓練後改善タスクの期限と責任者を再設定し、週次レビューに追加する。', '04', '2026-06-18', null, 'in_progress', null, null, null),
];

const auditReports = [
  auditReport('surveillance', '01', '01', '内部監査は計画済みで、アクセスレビューと訓練後改善に重点を置く。', '情報システム部、運用部、アクセス管理、インシデント対応', '文書レビュー、担当者ヒアリング、証跡サンプリング', '監査計画と責任者は明確。', '証跡保管場所と是正確認の統一が必要。', '内部監査を予定通り実施し、是正処置の週次確認を重点管理する。', '2026-07-20', null, null, 'draft'),
];

const auditEvidenceSeed = [
  auditEvidence('surveillance', '01', '01', 'internal-audit-plan-2026.pdf', '/seed/practical-verification/internal-audit-plan-2026.pdf', '内部監査計画書のサンプル証跡。', '03'),
  auditEvidence('surveillance', '02', '03', 'incident-drill-followup.csv', '/seed/practical-verification/incident-drill-followup.csv', 'インシデント訓練後改善タスクのサンプル証跡。', '04'),
];

const followUpRecordsSeed = [
  followUpRecord('surveillance', '01', '02', '01', '訓練後改善タスクの週次確認', '期限超過した改善タスクを週次確認へ載せ、完了まで追跡する。', '04', 'in_progress', '2026-06-18', null, null, null, '03'),
];

const managementReviewsSeed = [
  managementReview('surveillance', '11', '2025年度 年度末 マネジメントレビュー', '2026-03-25', 'completed', ['前年度内部監査結果', 'リスク対応状況', '教育訓練結果', '次年度改善計画'], ['01', '02', '03', '04'], '東京本社会議室', 'FY2025年度末レビューを実施し、内部監査結果、リスク対応、教育訓練の完了状況を確認した。', 'ISMSは有効に運用されている。月次アクセスレビュー証跡の統一と訓練後改善タスクの追跡をFY2026重点改善とする。', '01'),
  managementReview('surveillance', '01', '2026年度 第1回 マネジメントレビュー', '2026-07-10', 'scheduled', ['内部監査計画', 'リスク見直し', '不適合と是正', '改善機会'], ['01', '02', '03', '04'], 'オンライン会議', null, null, '01'),
  managementReview('surveillance', '12', '2026年度 Q4 マネジメントレビュー予定', '2027-03-24', 'planned', ['年度末KPI', '内部監査総括', 'リスク再評価', '次年度ISMS計画'], ['01', '02', '03', '04'], '東京本社会議室', null, null, '01'),
];

const managementReviewItemsSeed = [
  managementReviewItem('surveillance', '01', '01', 'input', '内部監査計画と重点確認領域', '2026年度第1回内部監査の対象、日程、監査員、重点領域を確認する。', 'audit', 1),
  managementReviewItem('surveillance', '02', '01', 'input', 'リスク見直しと高リスク項目', 'アクセスレビュー証跡不足、インシデント訓練後改善、レビュー入力情報の散在を確認する。', 'risk', 2),
  managementReviewItem('surveillance', '03', '01', 'decision', '是正処置の週次確認', '期限超過した改善タスクを週次運用会議で確認する。', 'audit', 3),
  managementReviewItem('surveillance', '04', '01', 'output', '次回レビューまでの改善アクション', '証跡保管場所を統一し、内部監査と是正の状況を次回レビュー入力へつなげる。', 'policy', 4),
  managementReviewItem('surveillance', '11', '11', 'input', 'FY2025内部監査結果の総括', '前年度内部監査で重大不適合はなく、観察事項の是正状況を確認した。', 'audit', 1),
  managementReviewItem('surveillance', '12', '11', 'decision', 'FY2026アクセスレビュー証跡の統一', '月次アクセスレビューの承認記録と例外対応欄を統一テンプレートへ移行する。', 'risk', 2),
  managementReviewItem('surveillance', '13', '11', 'output', '次年度教育・訓練計画への反映', '訓練後改善タスクの追跡方法を年次教育と内部監査チェック項目へ反映する。', 'policy', 3),
];

const managementReviewActionsSeed = [
  managementReviewAction('surveillance', '01', '01', '03', '内部監査結果をレビュー資料へ反映する', '内部監査で見つかった観察事項と不適合を次回レビュー資料へ反映する。', '02', '2026-07-25', 'open', null),
  managementReviewAction('surveillance', '02', '01', '04', '是正処置の完了証跡を統一フォルダへ集約する', '期限超過タスクの対応記録と有効性レビューを監査証跡として集約する。', '04', '2026-07-31', 'in_progress', null),
  managementReviewAction('surveillance', '11', '11', '12', 'アクセスレビュー証跡テンプレートを確定する', '承認欄、例外対応、保管先を統一したFY2026用テンプレートを公開する。', '02', '2026-04-10', 'completed', '2026-04-08T10:00:00.000Z'),
  managementReviewAction('surveillance', '12', '11', '13', '訓練後改善のフォローアップ観点を教育資料へ反映する', 'インシデント訓練後の改善追跡を年次教育資料へ追記する。', '04', '2026-04-15', 'completed', '2026-04-12T10:00:00.000Z'),
];

const educationMaterialsSeed = [
  educationMaterial('initial', '01', '初回審査登録準備向け 情報セキュリティ教育資料', 'document', '/sample/education/initial-security-awareness.pdf', 'ISMS適用範囲、情報資産、リスク対応、日常ルールを初回審査前に共有する教材。'),
  educationMaterial('initial', '02', '初回登録準備 チェックテスト', 'link', '/sample/education/initial-check-test', '基本方針、事故報告、アクセス管理の理解度を確認するテスト。'),
  educationMaterial('surveillance', '01', '2026年度 年次セキュリティ教育資料', 'document', '/sample/education/annual-security-training-2026.pdf', '継続運用でのルール変更、内部監査指摘、インシデント訓練結果を反映した教材。'),
  educationMaterial('surveillance', '02', '内部監査・是正処置フィードバック資料', 'slide', '/sample/education/audit-capa-feedback-2026.pdf', '内部監査結果とCAPAの再発防止ポイントを関係者へ展開する教材。'),
  educationMaterial('enterprise', '01', '委託先管理セキュリティ教育資料', 'document', '/sample/education/supplier-governance-training.pdf', '委託先評価、契約条項、共有データ範囲、アクセスレビューを扱う教材。'),
  educationMaterial('enterprise', '02', '製造データ取扱チェック', 'link', '/sample/education/manufacturing-data-check', '製造データと委託先共有の理解度を確認するテスト。'),
  educationMaterial('suspended', '01', '利用再開前セキュリティ確認資料', 'document', '/sample/education/restart-security-check.pdf', '休止状態から再開する前に確認する権限、文書、教育の教材。'),
  educationMaterial('suspended', '02', '再開時教育チェック', 'link', '/sample/education/restart-check-test', '再開時の最低限ルールを確認するテスト。'),
];

const educationPlansSeed = [
  educationPlan('initial', '01', '初回審査登録準備 全社員セキュリティ教育', '初回審査登録に向けて、ISMS方針、適用範囲、情報資産、リスク対応、インシデント報告ルールを全社員へ周知する。', ['全社員', '初回登録準備メンバー'], '2026-06-01', '2026-06-30', 'in_progress', '02'),
  educationPlan('surveillance', '01', '2026年度 年次セキュリティ教育', '継続運用中の管理策変更、内部監査結果、是正処置、インシデント訓練の学びを年次教育として展開する。', ['全社員', '継続運用メンバー'], '2026-04-01', '2026-04-30', 'completed', '02'),
  educationPlan('enterprise', '01', '委託先管理・製造データ教育', '委託先評価、アクセス権レビュー、製造データ共有範囲を関係者へ周知する。', ['委託先管理部', '製造管理部', '情報システム部'], '2026-06-15', '2026-07-15', 'in_progress', '02'),
  educationPlan('suspended', '01', '利用再開前セキュリティ教育', '休止後の利用再開に向けて、最低限の権限確認、文書確認、事故報告ルールを再教育する。', ['再開準備メンバー'], '2026-07-01', '2026-07-31', 'planned', '02'),
];

const educationPlanMaterialsSeed = [
  educationPlanMaterial('initial', '01', '01', '01', 1),
  educationPlanMaterial('initial', '02', '01', '02', 2),
  educationPlanMaterial('surveillance', '01', '01', '01', 1),
  educationPlanMaterial('surveillance', '02', '01', '02', 2),
  educationPlanMaterial('enterprise', '01', '01', '01', 1),
  educationPlanMaterial('enterprise', '02', '01', '02', 2),
  educationPlanMaterial('suspended', '01', '01', '01', 1),
  educationPlanMaterial('suspended', '02', '01', '02', 2),
];

const educationRecordsSeed = [
  educationRecord('initial', '01', '01', '01', '2026-06-10T10:00:00.000Z', '2026-06-10T10:45:00.000Z', 92, 'passed', '経営層としてISMS方針と審査準備の責任を確認済み。'),
  educationRecord('initial', '02', '01', '02', '2026-06-11T10:00:00.000Z', '2026-06-11T10:45:00.000Z', 88, 'passed', 'ISMS推進責任者として教育内容と不足者フォローを確認済み。'),
  educationRecord('initial', '03', '01', '04', '2026-06-12T10:00:00.000Z', null, 64, 'incomplete', '内部監査候補者向けの追加説明が必要。'),
  educationRecord('surveillance', '01', '01', '01', '2026-04-12T10:00:00.000Z', '2026-04-12T10:40:00.000Z', 94, 'passed', 'CISOとして年次教育内容と監査指摘の展開を確認済み。'),
  educationRecord('surveillance', '02', '01', '02', '2026-04-13T10:00:00.000Z', '2026-04-13T10:40:00.000Z', 91, 'passed', 'ISMS事務局として継続運用の証跡化を確認済み。'),
  educationRecord('surveillance', '03', '01', '04', '2026-04-14T10:00:00.000Z', null, null, 'pending', '運用部門責任者の受講完了確認待ち。'),
  educationRecord('enterprise', '01', '01', '01', '2026-06-20T10:00:00.000Z', '2026-06-20T10:50:00.000Z', 93, 'passed', 'CISOとして委託先管理教育を確認済み。'),
  educationRecord('enterprise', '02', '01', '05', '2026-06-21T10:00:00.000Z', null, null, 'pending', '委託先管理担当の受講完了待ち。'),
  educationRecord('suspended', '01', '01', '01', null, null, null, 'pending', '利用再開前の受講予定。'),
  educationRecord('suspended', '02', '01', '03', null, null, null, 'pending', '事業部責任者の受講予定。'),
];

const phaseHistory = [
  phase('initial', 'initial', '初回登録準備ストーリーの検証用seed'),
  phase('surveillance', 'surveillance', '1年間継続運用ストーリーの検証用seed'),
  phase('enterprise', 'surveillance', '委託先管理を含む中堅製造業ストーリーの検証用seed'),
  phase('suspended', 'initial', '休止状態から再開する低成熟ストーリーの検証用seed'),
];

function currentOrgs() {
  return orgs.filter((org) => scenario === 'all' || org.scenario === scenario);
}

function currentOrgIds() {
  return currentOrgs().map((org) => org.id);
}

function currentUsers() {
  return users.filter((item) => scenario === 'all' || item.scenario === scenario);
}

function currentSeedUserIds() {
  const userIds = currentUsers().map((item) => item.id);
  if (scenario === 'all' || ['initial', 'surveillance', 'enterprise'].includes(scenario)) {
    userIds.push(sharedOperator.id);
  }
  return userIds;
}

function orgIdFor(s) {
  const orgIds = {
    initial: ids.initialOrg,
    surveillance: ids.surveillanceOrg,
    enterprise: ids.enterpriseOrg,
    suspended: ids.suspendedOrg,
  };
  return orgIds[s];
}

function scenarioForOrgId(organizationId) {
  const entries = {
    [ids.initialOrg]: 'initial',
    [ids.surveillanceOrg]: 'surveillance',
    [ids.enterpriseOrg]: 'enterprise',
    [ids.suspendedOrg]: 'suspended',
  };
  const resolved = entries[organizationId];
  if (!resolved) {
    throw new Error(`unknown seed organization id: ${organizationId}`);
  }
  return resolved;
}

function id(s, entity, n) {
  const stories = {
    initial: '0001',
    surveillance: '0002',
    enterprise: '0003',
    suspended: '0004',
  };
  const story = stories[s] ?? '0000';
  const codes = {
    dept: '7100',
    user: '7200',
    account: '7201',
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
    educationPlan: '7e00',
    educationRecord: '7e01',
    educationMaterial: '7e02',
    educationPlanMaterial: '7e03',
  };
  return `${codes[entity]}0000-0000-4000-8000-${story}${String(n).padStart(8, '0')}`;
}

function dept(s, n, name, nameEn, manager, count) {
  return {
    scenario: s,
    id: id(s, 'dept', n),
    organization_id: orgIdFor(s),
    name,
    name_en: nameEn,
    parent_department_id: null,
    manager,
    description: `${seedSource}:${s}`,
    member_count: count,
    created_at: now,
    updated_at: now,
  };
}

function user(s, n, roleName, name, email, department, position, deptNo, flags) {
  const defaults = {
    is_ciso: 0,
    is_security_manager: 0,
    is_org_admin: roleName === 'org_admin' ? 1 : 0,
    is_audit_committee: 0,
    is_isms_promoter: 0,
  };
  return {
    scenario: s,
    id: id(s, 'user', n),
    organization_id: orgIdFor(s),
    email,
    full_name: name,
    full_name_en: null,
    role: roleName,
    department,
    position,
    phone: null,
    avatar_url: null,
    is_active: 1,
    language_preference: 'ja',
    primary_department_id: id(s, 'dept', deptNo),
    ...defaults,
    ...flags,
    last_login_at: null,
    created_at: now,
    updated_at: now,
  };
}

function sharedMembership(s, membershipId) {
  return {
    scenario: s,
    id: membershipId,
    user_id: ids.sharedOperatorUser,
    organization_id: orgIdFor(s),
    role: 'system_operator',
    status: 'active',
    department_scope: 'all',
    assigned_by: null,
    created_at: now,
    updated_at: now,
  };
}

function sharedPermission(s, permissionId) {
  return {
    scenario: s,
    id: permissionId,
    user_id: ids.sharedOperatorUser,
    organization_id: orgIdFor(s),
    can_manage_documents: 1,
    can_manage_risks: 1,
    can_manage_tasks: 1,
    can_manage_audit: 1,
    can_manage_assets: 1,
    can_manage_controls: 1,
    created_at: now,
    updated_at: now,
  };
}

function role(s, key, name, description, displayOrder, isRequired, responsibilities) {
  return {
    scenario: s,
    id: id(s, 'role', String(displayOrder).padStart(2, '0')),
    organization_id: orgIdFor(s),
    key,
    name,
    name_en: null,
    description,
    responsibilities: JSON.stringify(responsibilities),
    display_order: displayOrder,
    is_required: isRequired,
    seed_source: seedSource,
    seeded_at: now,
    created_at: now,
    updated_at: now,
  };
}

function assignment(s, roleKey, userNo) {
  const roleRow = projectRoles.find((item) => item.scenario === s && item.key === roleKey);
  return {
    scenario: s,
    id: id(s, 'assignment', `${roleRow.display_order}${userNo}`),
    organization_id: orgIdFor(s),
    role_id: roleRow.id,
    user_id: id(s, 'user', userNo),
    invitation_id: null,
    assigned_by: id(s, 'user', '02'),
    note: `${seedSource}:${s}`,
    created_at: now,
    updated_at: now,
  };
}

function template(n, name, description, category, isoReference, contentTemplate) {
  return {
    id: `pv-${n}`,
    name,
    description,
    category,
    iso_reference: isoReference,
    content_template: contentTemplate,
    language: 'ja',
    is_active: 1,
    created_at: now,
    updated_at: now,
  };
}

function doc(s, n, title, description, status, category, createdByUserNo, approvedByUserNo, approvedAt) {
  return {
    scenario: s,
    id: id(s, 'document', n),
    organization_id: orgIdFor(s),
    title,
    description,
    file_name: null,
    file_path: null,
    file_size: null,
    mime_type: null,
    version_number: 1,
    status,
    category,
    tags: JSON.stringify([seedSource, s]),
    folder_id: null,
    created_by: id(s, 'user', createdByUserNo),
    updated_by: id(s, 'user', createdByUserNo),
    approved_by: approvedByUserNo ? id(s, 'user', approvedByUserNo) : null,
    approved_at: approvedAt,
    retention_delete_at: null,
    created_at: now,
    updated_at: now,
  };
}

function riskCategory(s, n, name, description, color, displayOrder) {
  return {
    scenario: s,
    id: id(s, 'riskCategory', n),
    organization_id: orgIdFor(s),
    name,
    description,
    color,
    display_order: displayOrder,
    created_at: now,
    updated_at: now,
  };
}

function criteriaSet(s) {
  const impact = [
    ['1', '軽微', '業務への影響は限定的。'],
    ['2', '小', '一部業務に影響する。'],
    ['3', '中', '複数業務に影響し、管理者対応が必要。'],
    ['4', '大', '重要業務や顧客対応に影響する。'],
    ['5', '甚大', '事業継続や審査準備に重大な影響がある。'],
  ];
  const likelihood = [
    ['1', '極低', 'ほぼ発生しない。'],
    ['2', '低', '稀に発生する。'],
    ['3', '中', '定期的に発生し得る。'],
    ['4', '高', '頻繁に発生し得る。'],
    ['5', '極高', 'ほぼ確実に発生する。'],
  ];
  return [
    ...impact.map(([level, label, description]) => criterion(s, `1${level}`, 'impact', Number(level), label, description)),
    ...likelihood.map(([level, label, description]) => criterion(s, `2${level}`, 'likelihood', Number(level), label, description)),
  ];
}

function criterion(s, n, type, level, label, description) {
  return {
    scenario: s,
    id: id(s, 'riskCriteria', n),
    organization_id: orgIdFor(s),
    type,
    level,
    label,
    description,
    created_at: now,
  };
}

function asset(s, n, name, assetType, classification, criticality, ownerNo, location, description) {
  return {
    scenario: s,
    id: id(s, 'asset', n),
    organization_id: orgIdFor(s),
    name,
    asset_type: assetType,
    classification,
    criticality,
    owner_id: id(s, 'user', ownerNo),
    location,
    status: 'in_use',
    description,
    created_at: now,
    updated_at: now,
  };
}

function risk(s, n, title, description, categoryNo, impact, likelihood, status, ownerNo, identifiedByNo, identifiedDate) {
  return {
    scenario: s,
    id: id(s, 'risk', n),
    organization_id: orgIdFor(s),
    category_id: id(s, 'riskCategory', categoryNo),
    title,
    description,
    impact_level: impact,
    likelihood_level: likelihood,
    risk_score: impact * likelihood,
    status,
    identified_date: identifiedDate,
    identified_by: id(s, 'user', identifiedByNo),
    owner_id: id(s, 'user', ownerNo),
    // 既存設計（RiskRepository）に合わせ identified_date から YYYY-MM を導出
    assessment_period: identifiedDate ? identifiedDate.slice(0, 7) : null,
    created_at: now,
    updated_at: now,
  };
}

function treatment(s, n, riskNo, treatmentType, description, responsibleNo, dueDate, status) {
  return {
    scenario: s,
    id: id(s, 'treatment', n),
    risk_id: id(s, 'risk', riskNo),
    treatment_type: treatmentType,
    description,
    responsible_id: id(s, 'user', responsibleNo),
    due_date: dueDate,
    status,
    residual_approval_status: 'draft',
    residual_approved_by: null,
    residual_approved_at: null,
    residual_rejection_reason: null,
    residual_review_due_date: treatmentType === 'accept' ? dueDate : null,
    cost_estimate: null,
    actual_cost: null,
    effectiveness_rating: null,
    created_at: now,
    updated_at: now,
  };
}

function control(s, n, controlCode, category, title, description, tags) {
  return {
    scenario: s,
    id: id(s, 'control', n),
    organization_id: orgIdFor(s),
    control_code: controlCode,
    category,
    title,
    description,
    tags: JSON.stringify(tags),
    template_key: `pv-${s}-${controlCode.toLowerCase().replaceAll('.', '-')}`,
    soa_status: 'not_reviewed',
    soa_applicability_reason: null,
    soa_exclusion_reason: null,
    soa_reviewed_by: null,
    soa_reviewed_at: null,
    soa_approval_status: 'draft',
    soa_approved_by: null,
    soa_approved_at: null,
    soa_rejection_reason: null,
    created_at: now,
    updated_at: now,
  };
}

function riskControlLink(s, treatmentNo, controlNo) {
  return {
    scenario: s,
    id: id(s, 'riskControlLink', `${treatmentNo}${controlNo}`),
    risk_treatment_id: id(s, 'treatment', treatmentNo),
    iso_control_id: id(s, 'control', controlNo),
    created_at: now,
    updated_at: now,
  };
}

function riskAsset(s, riskNo, assetNo) {
  return {
    scenario: s,
    id: id(s, 'riskAsset', `${riskNo}${assetNo}`),
    risk_id: id(s, 'risk', riskNo),
    asset_id: id(s, 'asset', assetNo),
    created_at: now,
  };
}

function taskCategory(s, n, name, color, icon, displayOrder) {
  return {
    scenario: s,
    id: id(s, 'taskCategory', n),
    organization_id: orgIdFor(s),
    name,
    color,
    icon,
    display_order: displayOrder,
    created_at: now,
    updated_at: now,
  };
}

function task(s, n, title, description, categoryNo, assigneeNo, reporterNo, status, priority, dueDate, progress) {
  return {
    scenario: s,
    id: id(s, 'task', n),
    organization_id: orgIdFor(s),
    title,
    description,
    category_id: id(s, 'taskCategory', categoryNo),
    assignee_id: id(s, 'user', assigneeNo),
    reporter_id: id(s, 'user', reporterNo),
    status,
    priority,
    due_date: dueDate,
    estimated_hours: null,
    actual_hours: null,
    progress,
    parent_task_id: null,
    related_document_id: null,
    related_risk_id: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
}

function auditRequirement(n, clauseNumber, title, description) {
  return {
    id: id('surveillance', 'auditRequirement', n),
    clause_number: clauseNumber,
    title,
    description,
    parent_id: null,
    is_applicable: 1,
    created_at: now,
  };
}

function auditUnit(s, n, name, unitType, description) {
  return {
    scenario: s,
    id: id(s, 'auditUnit', n),
    organization_id: orgIdFor(s),
    name,
    unit_type: unitType,
    description,
    is_active: 1,
    created_at: now,
    updated_at: now,
  };
}

function auditPlan(s, n, title, description, auditType, status, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, leadAuditorNo, auditPeriod, unitNo) {
  return {
    scenario: s,
    id: id(s, 'auditPlan', n),
    organization_id: orgIdFor(s),
    title,
    description,
    audit_type: auditType,
    standard: 'ISO27001:2022',
    planned_start_date: plannedStartDate,
    planned_end_date: plannedEndDate,
    actual_start_date: actualStartDate,
    actual_end_date: actualEndDate,
    lead_auditor_id: id(s, 'user', leadAuditorNo),
    status,
    audit_period: auditPeriod,
    audited_unit_id: id(s, 'auditUnit', unitNo),
    auditor_signature: null,
    auditor_signed_at: null,
    created_at: now,
    updated_at: now,
  };
}

function auditTeamMember(s, n, planNo, userNo, roleName) {
  return {
    scenario: s,
    id: id(s, 'auditTeamMember', n),
    audit_plan_id: id(s, 'auditPlan', planNo),
    user_id: id(s, 'user', userNo),
    role: roleName,
    assigned_at: now,
  };
}

function auditChecklist(s, n, planNo, requirementNo, checkItem, evidenceRequired, auditorNo, status, result, findings, evidenceProvided) {
  return {
    scenario: s,
    id: id(s, 'auditChecklist', n),
    audit_plan_id: id(s, 'auditPlan', planNo),
    requirement_id: id('surveillance', 'auditRequirement', requirementNo),
    check_item: checkItem,
    evidence_required: evidenceRequired,
    auditor_id: id(s, 'user', auditorNo),
    status,
    result,
    findings,
    evidence_provided: evidenceProvided,
    reviewed_at: result ? '2026-06-10T09:00:00.000Z' : null,
    created_at: now,
    updated_at: now,
  };
}

function nonconformity(s, n, checklistNo, ncNumber, type, description, rootCause, action, preventiveAction, responsibleNo, dueDate, status, resolutionDate, verificationDate, verifiedByNo) {
  return {
    scenario: s,
    id: id(s, 'nonconformity', n),
    audit_checklist_id: id(s, 'auditChecklist', checklistNo),
    nc_number: ncNumber,
    type,
    description,
    root_cause: rootCause,
    corrective_action: action,
    preventive_action: preventiveAction,
    responsible_id: id(s, 'user', responsibleNo),
    due_date: dueDate,
    status,
    resolution_date: resolutionDate,
    verification_date: verificationDate,
    verified_by: verifiedByNo ? id(s, 'user', verifiedByNo) : null,
    created_at: now,
    updated_at: now,
  };
}

function correctiveAction(s, n, nonconformityNo, actionDescription, responsibleNo, plannedDate, completionDate, status, effectivenessReview, reviewedByNo, reviewedAt) {
  return {
    scenario: s,
    id: id(s, 'correctiveAction', n),
    nonconformity_id: id(s, 'nonconformity', nonconformityNo),
    action_description: actionDescription,
    responsible_id: id(s, 'user', responsibleNo),
    planned_date: plannedDate,
    completion_date: completionDate,
    status,
    effectiveness_review: effectivenessReview,
    reviewed_by: reviewedByNo ? id(s, 'user', reviewedByNo) : null,
    reviewed_at: reviewedAt,
    created_at: now,
    updated_at: now,
  };
}

function auditReport(s, n, planNo, executiveSummary, scope, methodology, positiveFindings, improvementOpportunities, conclusion, reportDate, approvedBy, approvedAt, approvalStatus) {
  return {
    scenario: s,
    id: id(s, 'auditReport', n),
    audit_plan_id: id(s, 'auditPlan', planNo),
    executive_summary: executiveSummary,
    scope,
    methodology,
    positive_findings: positiveFindings,
    improvement_opportunities: improvementOpportunities,
    conclusion,
    report_date: reportDate,
    approved_by: approvedBy,
    approved_at: approvedAt,
    approval_status: approvalStatus,
    rejection_reason: null,
    created_at: now,
    updated_at: now,
  };
}

function auditEvidence(s, n, checklistNo, fileName, filePath, description, uploadedByNo) {
  return {
    scenario: s,
    id: id(s, 'auditEvidence', n),
    audit_checklist_id: id(s, 'auditChecklist', checklistNo),
    file_name: fileName,
    file_path: filePath,
    file_size: 1024,
    mime_type: fileName.endsWith('.csv') ? 'text/csv' : 'application/pdf',
    description,
    uploaded_by: id(s, 'user', uploadedByNo),
    uploaded_at: now,
  };
}

function followUpRecord(s, n, planNo, nonconformityNo, title, description, assignedToNo, status, dueDate, completedAt, verifiedAt, verifiedByNo, createdByNo) {
  return {
    scenario: s,
    id: id(s, 'followUpRecord', n),
    organization_id: orgIdFor(s),
    audit_plan_id: id(s, 'auditPlan', planNo),
    nonconformity_id: nonconformityNo ? id(s, 'nonconformity', nonconformityNo) : null,
    title,
    description,
    assigned_to: id(s, 'user', assignedToNo),
    status,
    due_date: dueDate,
    completed_at: completedAt,
    verified_at: verifiedAt,
    verified_by: verifiedByNo ? id(s, 'user', verifiedByNo) : null,
    created_by: id(s, 'user', createdByNo),
    created_at: now,
    updated_at: now,
  };
}

function managementReview(s, n, title, reviewDate, status, agenda, participantNos, location, minutes, conclusions, createdByNo) {
  return {
    scenario: s,
    id: id(s, 'managementReview', n),
    organization_id: orgIdFor(s),
    title,
    review_date: reviewDate,
    status,
    agenda: JSON.stringify(agenda),
    participants: JSON.stringify(participantNos.map((no) => id(s, 'user', no))),
    location,
    minutes,
    conclusions,
    created_by: id(s, 'user', createdByNo),
    created_at: now,
    updated_at: now,
  };
}

function managementReviewItem(s, n, reviewNo, itemType, title, description, relatedArea, sortOrder) {
  return {
    scenario: s,
    id: id(s, 'managementReviewItem', n),
    review_id: id(s, 'managementReview', reviewNo),
    item_type: itemType,
    title,
    description,
    related_area: relatedArea,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  };
}

function managementReviewAction(s, n, reviewNo, itemNo, title, description, assigneeNo, dueDate, status, completedAt) {
  return {
    scenario: s,
    id: id(s, 'managementReviewAction', n),
    review_id: id(s, 'managementReview', reviewNo),
    review_item_id: itemNo ? id(s, 'managementReviewItem', itemNo) : null,
    title,
    description,
    assignee_id: id(s, 'user', assigneeNo),
    due_date: dueDate,
    status,
    completed_at: completedAt,
    created_at: now,
    updated_at: now,
  };
}

function educationPlan(s, n, title, description, targetAudience, startDate, endDate, status, createdByNo) {
  return {
    scenario: s,
    id: id(s, 'educationPlan', n),
    organization_id: orgIdFor(s),
    title,
    description,
    target_audience: JSON.stringify(targetAudience),
    start_date: startDate,
    end_date: endDate,
    status,
    created_by: id(s, 'user', createdByNo),
    created_at: now,
    updated_at: now,
  };
}

function educationMaterial(s, n, title, materialType, url, description) {
  return {
    scenario: s,
    id: id(s, 'educationMaterial', n),
    organization_id: orgIdFor(s),
    title,
    material_type: materialType,
    url,
    file_reference: null,
    description,
    created_at: now,
    updated_at: now,
  };
}

function educationPlanMaterial(s, n, planNo, materialNo, displayOrder) {
  return {
    scenario: s,
    id: id(s, 'educationPlanMaterial', n),
    plan_id: id(s, 'educationPlan', planNo),
    material_id: id(s, 'educationMaterial', materialNo),
    display_order: displayOrder,
    created_at: now,
  };
}

function educationRecord(s, n, planNo, attendeeNo, attendedAt, completedAt, score, result, feedback) {
  return {
    scenario: s,
    id: id(s, 'educationRecord', n),
    plan_id: id(s, 'educationPlan', planNo),
    attendee_id: id(s, 'user', attendeeNo),
    attended_at: attendedAt,
    completed_at: completedAt,
    score,
    result,
    feedback,
    created_at: now,
    updated_at: now,
  };
}

function phase(s, phaseName, notes) {
  return {
    scenario: s,
    id: id(s, 'phase', '01'),
    organization_id: orgIdFor(s),
    phase: phaseName,
    source: 'system',
    changed_by: null,
    notes,
    recorded_at: now,
  };
}

function filterScenario(rows) {
  return rows.filter((row) => !row.scenario || scenario === 'all' || row.scenario === scenario)
    .map(({ scenario: _scenario, ...row }) => row);
}

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

function placeholders(values) {
  return values.map(() => '?').join(', ');
}

function statement(table, columns, row, conflictColumn = 'id') {
  const assignmentsForUpdate = columns
    .filter((column) => column !== conflictColumn)
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  return {
    sql: `insert into ${table} (${columns.join(', ')}) values (${placeholders(columns)}) on conflict(${conflictColumn}) do update set ${assignmentsForUpdate}`,
    args: columns.map((column) => row[column]),
  };
}

function statements(table, columns, rows, conflictColumn = 'id') {
  return rows.map((row) => statement(table, columns, row, conflictColumn));
}

function schemaStatements() {
  return [
    {
      sql: `create table if not exists user_department_scopes (
        id text primary key,
        organization_id text not null references organizations(id) on delete cascade,
        user_id text not null references user_profiles(id) on delete cascade,
        department_id text not null references organization_departments(id) on delete cascade,
        created_at text,
        updated_at text,
        unique(user_id, department_id)
      )`,
      args: [],
    },
    {
      sql: 'create index if not exists idx_user_department_scopes_org on user_department_scopes(organization_id)',
      args: [],
    },
    {
      sql: 'create index if not exists idx_user_department_scopes_user on user_department_scopes(user_id)',
      args: [],
    },
    {
      sql: 'create index if not exists idx_user_department_scopes_department on user_department_scopes(department_id)',
      args: [],
    },
    {
      sql: `create table if not exists soa_versions (
        id text primary key,
        organization_id text not null references organizations(id) on delete cascade,
        version_number integer not null,
        title text not null,
        change_summary text,
        snapshot text not null,
        control_count integer not null default 0,
        approved_control_count integer not null default 0,
        published_by text references user_profiles(id) on delete set null,
        published_at text not null,
        review_status text not null default 'draft',
        reviewed_by text references user_profiles(id) on delete set null,
        reviewed_at text,
        rejection_reason text,
        created_at text not null,
        unique(organization_id, version_number)
      )`,
      args: [],
    },
    {
      sql: 'create index if not exists idx_soa_versions_org on soa_versions(organization_id)',
      args: [],
    },
    {
      sql: 'create index if not exists idx_soa_versions_published_at on soa_versions(published_at)',
      args: [],
    },
  ];
}

async function ensureColumn(client, table, column, definition) {
  if (dryRun) {
    return { label: `ensure ${table}.${column}`, statements: 1, affected: 0 };
  }

  const info = await client.execute({ sql: `pragma table_info(${table})`, args: [] });
  const exists = info.rows.some((row) => row.name === column);
  if (exists) {
    return { label: `ensure ${table}.${column}`, statements: 0, affected: 0 };
  }

  await client.execute({ sql: `alter table ${table} add column ${column} ${definition}`, args: [] });
  return { label: `ensure ${table}.${column}`, statements: 1, affected: 0 };
}

async function ensureSchemaColumns(client) {
  const columns = [
    ['iso_controls', 'soa_status', "text not null default 'not_reviewed'"],
    ['iso_controls', 'soa_applicability_reason', 'text'],
    ['iso_controls', 'soa_exclusion_reason', 'text'],
    ['iso_controls', 'soa_reviewed_by', 'text references user_profiles(id) on delete set null'],
    ['iso_controls', 'soa_reviewed_at', 'text'],
    ['iso_controls', 'soa_approval_status', "text not null default 'draft'"],
    ['iso_controls', 'soa_approved_by', 'text references user_profiles(id) on delete set null'],
    ['iso_controls', 'soa_approved_at', 'text'],
    ['iso_controls', 'soa_rejection_reason', 'text'],
    ['soa_versions', 'change_summary', 'text'],
    ['soa_versions', 'review_status', "text not null default 'draft'"],
    ['soa_versions', 'reviewed_by', 'text references user_profiles(id) on delete set null'],
    ['soa_versions', 'reviewed_at', 'text'],
    ['soa_versions', 'rejection_reason', 'text'],
    ['risk_treatments', 'residual_approval_status', "text not null default 'draft'"],
    ['risk_treatments', 'residual_approved_by', 'text references user_profiles(id) on delete set null'],
    ['risk_treatments', 'residual_approved_at', 'text'],
    ['risk_treatments', 'residual_rejection_reason', 'text'],
    ['risk_treatments', 'residual_review_due_date', 'text'],
  ];

  const results = [];
  for (const [table, column, definition] of columns) {
    results.push(await ensureColumn(client, table, column, definition));
  }
  return results;
}

function makeDelete(sql, args = []) {
  return { sql, args };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function discoverResetTargets(client) {
  if (!client) {
    return { extraOrgIds: [], extraUserIds: [] };
  }

  const staleOrgRows = await client.execute({
    sql: `select id from organizations
      where id in (?, ?)
        or name like 'Playwright %'
        or name like 'Playwright Super Admin %'
        or name like 'e2e-test %'`,
    args: [
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ],
  });
  const extraOrgIds = staleOrgRows.rows.map((row) => String(row.id));

  if (extraOrgIds.length === 0) {
    return { extraOrgIds, extraUserIds: [] };
  }

  const marks = placeholders(extraOrgIds);
  const staleUserRows = await client.execute({
    sql: `select distinct id from user_profiles where organization_id in (${marks})`,
    args: extraOrgIds,
  });

  return {
    extraOrgIds,
    extraUserIds: staleUserRows.rows.map((row) => String(row.id)),
  };
}

function deleteStatementsForReset(extraOrgIds = [], extraUserIds = []) {
  const orgIds = unique([...currentOrgIds(), ...extraOrgIds]);
  const userIds = unique([...currentSeedUserIds(), ...extraUserIds]);
  const orgMarks = placeholders(orgIds);
  const userMarks = placeholders(userIds);

  return [
    makeDelete(`delete from organization_notification_channel_logs where notification_id in (select id from notifications where organization_id in (${orgMarks}) or user_id in (${userMarks}))`, [...orgIds, ...userIds]),
    makeDelete(`delete from organization_notification_channels where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from email_logs where notification_id in (select id from notifications where organization_id in (${orgMarks}) or user_id in (${userMarks})) or user_id in (${userMarks})`, [...orgIds, ...userIds, ...userIds]),
    makeDelete(`delete from notifications where organization_id in (${orgMarks}) or user_id in (${userMarks})`, [...orgIds, ...userIds]),
    makeDelete(`delete from notification_preferences where user_id in (${userMarks})`, userIds),
    makeDelete(`delete from audit_logs where organization_id in (${orgMarks}) or user_id in (${userMarks})`, [...orgIds, ...userIds]),
    makeDelete(`delete from management_review_actions where review_id in (select id from management_reviews where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from management_review_items where review_id in (select id from management_reviews where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from management_reviews where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from follow_up_records where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from audit_evidence where audit_checklist_id in (select ac.id from audit_checklists ac join audit_plans ap on ac.audit_plan_id = ap.id where ap.organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from audit_reports where audit_plan_id in (select id from audit_plans where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from corrective_actions where nonconformity_id in (select nc.id from nonconformities nc join audit_checklists ac on nc.audit_checklist_id = ac.id join audit_plans ap on ac.audit_plan_id = ap.id where ap.organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from nonconformities where audit_checklist_id in (select ac.id from audit_checklists ac join audit_plans ap on ac.audit_plan_id = ap.id where ap.organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from audit_checklists where audit_plan_id in (select id from audit_plans where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from audit_team_members where audit_plan_id in (select id from audit_plans where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from audit_plans where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from audit_units where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from risk_control_links where risk_treatment_id in (select rt.id from risk_treatments rt join risks r on rt.risk_id = r.id where r.organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from risk_assets where risk_id in (select id from risks where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from risk_assessment_history where risk_id in (select id from risks where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from risk_treatments where risk_id in (select id from risks where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from task_reminders where task_id in (select id from tasks where organization_id in (${orgMarks})) or user_id in (${userMarks})`, [...orgIds, ...userIds]),
    makeDelete(`delete from tasks where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from task_categories where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from document_approvals where document_id in (select id from documents where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from document_versions where document_id in (select id from documents where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from documents where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from document_folders where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from education_plan_materials where plan_id in (select id from education_plans where organization_id in (${orgMarks})) or material_id in (select id from education_materials where organization_id in (${orgMarks}))`, [...orgIds, ...orgIds]),
    makeDelete(`delete from education_records where plan_id in (select id from education_plans where organization_id in (${orgMarks})) or attendee_id in (${userMarks})`, [...orgIds, ...userIds]),
    makeDelete(`delete from education_materials where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from education_plans where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from risks where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from risk_criteria where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from risk_categories where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from information_asset_import_rows where job_id in (select id from information_asset_import_jobs where organization_id in (${orgMarks}))`, orgIds),
    makeDelete(`delete from information_asset_import_jobs where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from information_assets where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from soa_versions where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from iso_controls where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from project_assignments where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from project_roles where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from organization_phase_history where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from organization_isms_scopes where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from organization_structure_snapshots where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from user_department_scopes where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from user_permission_sets where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from user_memberships where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from organization_invitations where organization_id in (${orgMarks})`, orgIds),
    makeDelete(`delete from user_profiles where id in (${userMarks})`, userIds),
    makeDelete(`delete from account where userId in (${userMarks})`, userIds),
    makeDelete(`delete from user where id in (${userMarks})`, userIds),
    makeDelete(`delete from organizations where id in (${orgMarks})`, orgIds),
  ];
}

async function run(client, label, items) {
  let affected = 0;
  if (!items.length) {
    return { label, statements: 0, affected };
  }
  for (const item of items) {
    if (!dryRun) {
      const result = await client.execute(item);
      affected += result.rowsAffected ?? 0;
    }
  }
  return { label, statements: items.length, affected };
}

async function main() {
  const dbUrl = resolveDbUrl();
  let client = null;
  if (!dryRun) {
    const { createClient } = await import('@libsql/client');
    client = createClient({
      url: dbUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  const outputDir = process.env.SEED_OUTPUT_DIR || path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });

  const summary = [];

  summary.push(await run(client, 'ensure practical verification schema', schemaStatements()));
  summary.push(...await ensureSchemaColumns(client));

  if (reset) {
    const cleanupTargets = await discoverResetTargets(client);
    summary.push({
      label: 'discover stale Playwright/E2E seed rows',
      statements: 2,
      affected: cleanupTargets.extraOrgIds.length + cleanupTargets.extraUserIds.length,
      details: {
        organizations: cleanupTargets.extraOrgIds.length,
        users: cleanupTargets.extraUserIds.length,
      },
    });
    summary.push(await run(
      client,
      'reset practical verification rows',
      deleteStatementsForReset(cleanupTargets.extraOrgIds, cleanupTargets.extraUserIds)
    ));
  }

  const scenarioOrgs = currentOrgs().map(({ scenario: _scenario, ...row }) => row);
  const scenarioUsers = filterScenario(users);
  const scenarioMemberships = [
    ...scenarioUsers.map((row) => ({
      id: id(scenarioForOrgId(row.organization_id), 'membership', row.id.slice(-2)),
      user_id: row.id,
      organization_id: row.organization_id,
      role: row.role,
      status: 'active',
      department_scope: row.role === 'org_admin' ? 'all' : null,
      assigned_by: null,
      created_at: now,
      updated_at: now,
    })),
    ...filterScenario(sharedOperatorMemberships),
  ];
  const scenarioPermissions = [
    ...scenarioUsers.map((row) => {
      const isAdmin = row.role === 'org_admin';
      const isAuditor = row.role === 'auditor';
      const story = scenarioForOrgId(row.organization_id);
      return {
        id: id(story, 'permission', row.id.slice(-2)),
        user_id: row.id,
        organization_id: row.organization_id,
        can_manage_documents: isAdmin || row.role === 'approver' ? 1 : 0,
        can_manage_risks: isAdmin ? 1 : 0,
        can_manage_tasks: 1,
        can_manage_audit: isAdmin || isAuditor ? 1 : 0,
        can_manage_assets: isAdmin ? 1 : 0,
        can_manage_controls: isAdmin ? 1 : 0,
        created_at: now,
        updated_at: now,
      };
    }),
    ...filterScenario(sharedOperatorPermissions),
  ];
  const scenarioDepartmentScopes = scenarioUsers
    .filter((row) => row.role !== 'org_admin' && row.primary_department_id)
    .map((row) => {
      const story = scenarioForOrgId(row.organization_id);
      return {
        id: id(story, 'departmentScope', row.id.slice(-2)),
        organization_id: row.organization_id,
        user_id: row.id,
        department_id: row.primary_department_id,
        created_at: now,
        updated_at: now,
      };
    });

  const batches = [
    ['organizations', statements('organizations', [
      'id', 'name', 'name_en', 'employee_count_range', 'industry', 'iso_certification_status',
      'subscription_plan', 'subscription_status', 'isms_phase', 'isms_phase_set_at',
      'trial_ends_at', 'ai_config', 'deleted_at', 'created_at', 'updated_at',
    ], scenarioOrgs)],
    ['organization_departments', statements('organization_departments', [
      'id', 'organization_id', 'name', 'name_en', 'parent_department_id', 'manager',
      'description', 'member_count', 'created_at', 'updated_at',
    ], filterScenario(departments))],
    ['user', statements('user', [
      'id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt',
    ], [
      ...scenarioUsers.map((row) => ({
        id: row.id,
        name: row.full_name,
        email: row.email,
        emailVerified: 1,
        image: null,
        createdAt: nowMs,
        updatedAt: nowMs,
      })),
      {
        id: sharedOperator.id,
        name: sharedOperator.full_name,
        email: sharedOperator.email,
        emailVerified: 1,
        image: null,
        createdAt: nowMs,
        updatedAt: nowMs,
      },
    ])],
    ['account', statements('account', [
      'id', 'accountId', 'providerId', 'userId', 'password',
      'accessToken', 'refreshToken', 'accessTokenExpiresAt', 'refreshTokenExpiresAt',
      'scope', 'idToken', 'createdAt', 'updatedAt',
    ], [
      ...scenarioUsers.map((row) => ({
        id: id(scenarioForOrgId(row.organization_id), 'account', row.id.slice(-2)),
        accountId: row.id,
        providerId: 'credential',
        userId: row.id,
        password: bcryptPlaceholder,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        idToken: null,
        createdAt: nowMs,
        updatedAt: nowMs,
      })),
      {
        id: ids.sharedOperatorAccount,
        accountId: ids.sharedOperatorUser,
        providerId: 'credential',
        userId: ids.sharedOperatorUser,
        password: bcryptPlaceholder,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        idToken: null,
        createdAt: nowMs,
        updatedAt: nowMs,
      },
    ])],
    ['user_profiles', statements('user_profiles', [
      'id', 'organization_id', 'email', 'full_name', 'full_name_en', 'role', 'department',
      'position', 'phone', 'avatar_url', 'is_active', 'language_preference',
      'primary_department_id', 'is_ciso', 'is_security_manager', 'is_org_admin',
      'is_audit_committee', 'is_isms_promoter', 'last_login_at', 'created_at', 'updated_at',
    ], [
      ...scenarioUsers,
      sharedOperator,
    ])],
    ['user_memberships', statements('user_memberships', [
      'id', 'user_id', 'organization_id', 'role', 'status', 'department_scope',
      'assigned_by', 'created_at', 'updated_at',
    ], scenarioMemberships)],
    ['user_permission_sets', statements('user_permission_sets', [
      'id', 'user_id', 'organization_id', 'can_manage_documents', 'can_manage_risks',
      'can_manage_tasks', 'can_manage_audit', 'can_manage_assets', 'can_manage_controls',
      'created_at', 'updated_at',
    ], scenarioPermissions)],
    ['user_department_scopes', statements('user_department_scopes', [
      'id', 'organization_id', 'user_id', 'department_id', 'created_at', 'updated_at',
    ], scenarioDepartmentScopes)],
    ['organization_isms_scopes', statements('organization_isms_scopes', [
      'id', 'organization_id', 'physical_locations', 'it_systems', 'departments',
      'processes', 'exclusions', 'created_at', 'updated_at',
    ], filterScenario(scopes))],
    ['project_roles', statements('project_roles', [
      'id', 'organization_id', 'key', 'name', 'name_en', 'description',
      'responsibilities', 'display_order', 'is_required', 'seed_source',
      'seeded_at', 'created_at', 'updated_at',
    ], filterScenario(projectRoles))],
    ['project_assignments', statements('project_assignments', [
      'id', 'organization_id', 'role_id', 'user_id', 'invitation_id',
      'assigned_by', 'note', 'created_at', 'updated_at',
    ], filterScenario(assignments))],
    ['document_templates', statements('document_templates', [
      'id', 'name', 'description', 'category', 'iso_reference',
      'content_template', 'language', 'is_active', 'created_at', 'updated_at',
    ], documentTemplates)],
    ['documents', statements('documents', [
      'id', 'organization_id', 'title', 'description', 'file_name', 'file_path',
      'file_size', 'mime_type', 'version_number', 'status', 'category', 'tags',
      'folder_id', 'created_by', 'updated_by', 'approved_by', 'approved_at',
      'retention_delete_at', 'created_at', 'updated_at',
    ], filterScenario(documents))],
    ['education_materials', statements('education_materials', [
      'id', 'organization_id', 'title', 'material_type', 'url', 'file_reference',
      'description', 'created_at', 'updated_at',
    ], filterScenario(educationMaterialsSeed))],
    ['education_plans', statements('education_plans', [
      'id', 'organization_id', 'title', 'description', 'target_audience',
      'start_date', 'end_date', 'status', 'created_by', 'created_at', 'updated_at',
    ], filterScenario(educationPlansSeed))],
    ['education_plan_materials', statements('education_plan_materials', [
      'id', 'plan_id', 'material_id', 'display_order', 'created_at',
    ], filterScenario(educationPlanMaterialsSeed))],
    ['education_records', statements('education_records', [
      'id', 'plan_id', 'attendee_id', 'attended_at', 'completed_at',
      'score', 'result', 'feedback', 'created_at', 'updated_at',
    ], filterScenario(educationRecordsSeed))],
    ['risk_categories', statements('risk_categories', [
      'id', 'organization_id', 'name', 'description', 'color',
      'display_order', 'created_at', 'updated_at',
    ], filterScenario(riskCategories))],
    ['risk_criteria', statements('risk_criteria', [
      'id', 'organization_id', 'type', 'level', 'label', 'description', 'created_at',
    ], filterScenario(riskCriteria))],
    ['information_assets', statements('information_assets', [
      'id', 'organization_id', 'name', 'asset_type', 'classification', 'criticality',
      'owner_id', 'location', 'status', 'description', 'created_at', 'updated_at',
    ], filterScenario(informationAssets))],
    ['risks', statements('risks', [
      'id', 'organization_id', 'category_id', 'title', 'description',
      'impact_level', 'likelihood_level', 'risk_score', 'status', 'identified_date',
      'identified_by', 'owner_id', 'assessment_period', 'created_at', 'updated_at',
    ], filterScenario(risks))],
    ['risk_assets', statements('risk_assets', [
      'id', 'risk_id', 'asset_id', 'created_at',
    ], filterScenario(riskAssets))],
    ['risk_treatments', statements('risk_treatments', [
      'id', 'risk_id', 'treatment_type', 'description', 'responsible_id',
      'due_date', 'status', 'cost_estimate', 'actual_cost', 'effectiveness_rating',
      'residual_approval_status', 'residual_approved_by', 'residual_approved_at',
      'residual_rejection_reason', 'residual_review_due_date',
      'created_at', 'updated_at',
    ], filterScenario(riskTreatments))],
    ['iso_controls', statements('iso_controls', [
      'id', 'organization_id', 'control_code', 'category', 'title', 'description',
      'tags', 'template_key', 'soa_status', 'soa_applicability_reason',
      'soa_exclusion_reason', 'soa_reviewed_by', 'soa_reviewed_at',
      'soa_approval_status', 'soa_approved_by', 'soa_approved_at',
      'soa_rejection_reason',
      'created_at', 'updated_at',
    ], filterScenario(isoControls))],
    ['risk_control_links', statements('risk_control_links', [
      'id', 'risk_treatment_id', 'iso_control_id', 'created_at', 'updated_at',
    ], filterScenario(riskControlLinks))],
    ['task_categories', statements('task_categories', [
      'id', 'organization_id', 'name', 'color', 'icon', 'display_order', 'created_at', 'updated_at',
    ], filterScenario(taskCategories))],
    ['tasks', statements('tasks', [
      'id', 'organization_id', 'title', 'description', 'category_id', 'assignee_id',
      'reporter_id', 'status', 'priority', 'due_date', 'estimated_hours',
      'actual_hours', 'progress', 'parent_task_id', 'related_document_id',
      'related_risk_id', 'completed_at', 'created_at', 'updated_at',
    ], filterScenario(tasks))],
    ['iso27001_requirements', statements('iso27001_requirements', [
      'id', 'clause_number', 'title', 'description', 'parent_id', 'is_applicable', 'created_at',
    ], iso27001Requirements)],
    ['audit_units', statements('audit_units', [
      'id', 'organization_id', 'name', 'unit_type', 'description',
      'is_active', 'created_at', 'updated_at',
    ], filterScenario(auditUnits))],
    ['audit_plans', statements('audit_plans', [
      'id', 'organization_id', 'title', 'description', 'audit_type', 'standard',
      'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date',
      'lead_auditor_id', 'status', 'audit_period', 'audited_unit_id',
      'auditor_signature', 'auditor_signed_at', 'created_at', 'updated_at',
    ], filterScenario(auditPlans))],
    ['audit_team_members', statements('audit_team_members', [
      'id', 'audit_plan_id', 'user_id', 'role', 'assigned_at',
    ], filterScenario(auditTeamMembers))],
    ['audit_checklists', statements('audit_checklists', [
      'id', 'audit_plan_id', 'requirement_id', 'check_item', 'evidence_required',
      'auditor_id', 'status', 'result', 'findings', 'evidence_provided',
      'reviewed_at', 'created_at', 'updated_at',
    ], filterScenario(auditChecklists))],
    ['nonconformities', statements('nonconformities', [
      'id', 'audit_checklist_id', 'nc_number', 'type', 'description',
      'root_cause', 'corrective_action', 'preventive_action', 'responsible_id',
      'due_date', 'status', 'resolution_date', 'verification_date', 'verified_by',
      'created_at', 'updated_at',
    ], filterScenario(nonconformitiesSeed))],
    ['corrective_actions', statements('corrective_actions', [
      'id', 'nonconformity_id', 'action_description', 'responsible_id',
      'planned_date', 'completion_date', 'status', 'effectiveness_review',
      'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
    ], filterScenario(correctiveActionsSeed))],
    ['audit_reports', statements('audit_reports', [
      'id', 'audit_plan_id', 'executive_summary', 'scope', 'methodology',
      'positive_findings', 'improvement_opportunities', 'conclusion',
      'report_date', 'approved_by', 'approved_at', 'approval_status',
      'rejection_reason', 'created_at', 'updated_at',
    ], filterScenario(auditReports))],
    ['audit_evidence', statements('audit_evidence', [
      'id', 'audit_checklist_id', 'file_name', 'file_path', 'file_size',
      'mime_type', 'description', 'uploaded_by', 'uploaded_at',
    ], filterScenario(auditEvidenceSeed))],
    ['follow_up_records', statements('follow_up_records', [
      'id', 'organization_id', 'audit_plan_id', 'nonconformity_id', 'title',
      'description', 'assigned_to', 'status', 'due_date', 'completed_at',
      'verified_at', 'verified_by', 'created_by', 'created_at', 'updated_at',
    ], filterScenario(followUpRecordsSeed))],
    ['management_reviews', statements('management_reviews', [
      'id', 'organization_id', 'title', 'review_date', 'status', 'agenda',
      'participants', 'location', 'minutes', 'conclusions', 'created_by',
      'created_at', 'updated_at',
    ], filterScenario(managementReviewsSeed))],
    ['management_review_items', statements('management_review_items', [
      'id', 'review_id', 'item_type', 'title', 'description', 'related_area',
      'sort_order', 'created_at', 'updated_at',
    ], filterScenario(managementReviewItemsSeed))],
    ['management_review_actions', statements('management_review_actions', [
      'id', 'review_id', 'review_item_id', 'title', 'description', 'assignee_id',
      'due_date', 'status', 'completed_at', 'created_at', 'updated_at',
    ], filterScenario(managementReviewActionsSeed))],
    ['organization_phase_history', statements('organization_phase_history', [
      'id', 'organization_id', 'phase', 'source', 'changed_by', 'notes', 'recorded_at',
    ], filterScenario(phaseHistory))],
  ];

  for (const [label, items] of batches) {
    summary.push(await run(client, label, items));
  }

  const payload = {
    ok: true,
    generatedAt: now,
    seedSource,
    scenario,
    reset,
    dryRun,
    databaseUrl: safeDbUrl(dbUrl),
    organizations: currentOrgs().map((org) => ({
      id: org.id,
      name: org.name,
      isms_phase: org.isms_phase,
      iso_certification_status: org.iso_certification_status,
    })),
    summary,
  };

  const outputPath = path.join(outputDir, `practical-verification-seed-${scenario}-${timestamp()}-${process.pid}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ...payload, outputPath }, null, 2));

  await client?.close();
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
