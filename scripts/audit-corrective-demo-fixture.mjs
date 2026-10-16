// Fictional, additive scenario. No customer or personal data.
export const auditDemoOrganizationId = '70000000-0000-4000-8000-000000000002';
const fixtureId = (code, n = 91) => `${code}0000-0000-4000-8000-0002${String(n).padStart(8, '0')}`;
export const auditDemoPlanId = fixtureId('7c02');
export const auditDemoNcId = fixtureId('7c05');
const auditor = fixtureId('7200', 3);

export function buildAuditCorrectiveDemo(anchor = new Date()) {
  const createdAt = anchor.toISOString();
  const day = (offset) => new Date(anchor.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const timestamps = { created_at: createdAt, updated_at: createdAt };
  const followUp = (n, title, description, due) => ({
    id: fixtureId('7c09', n), organization_id: auditDemoOrganizationId,
    audit_plan_id: auditDemoPlanId, nonconformity_id: auditDemoNcId,
    title, description, assigned_to: null, status: 'open', due_date: day(due),
    completed_at: null, verified_at: null, verified_by: null, created_by: auditor, ...timestamps,
  });
  return {
    audit_plans: [{
      id: auditDemoPlanId, organization_id: auditDemoOrganizationId,
      title: '【架空デモ】アクセス権レビュー記録の是正',
      description: '四半期アクセス権レビューの実施記録が見つからない。指摘発生から担当決定・是正・証跡記録・完了判断を試す。実会社・実個人とは無関係。',
      audit_type: 'internal', standard: 'ISO27001:2022', status: 'in_progress',
      planned_start_date: day(-1), planned_end_date: day(0), actual_start_date: day(-1),
      actual_end_date: null, lead_auditor_id: auditor, audit_period: 'Fictional corrective-action demo',
      audited_unit_id: null, auditor_signature: null, auditor_signed_at: null, ...timestamps,
    }],
    audit_team_members: [{ id: fixtureId('7c03'), audit_plan_id: auditDemoPlanId, user_id: auditor, role: 'lead', assigned_at: createdAt }],
    audit_checklists: [{
      id: fixtureId('7c04'), audit_plan_id: auditDemoPlanId, requirement_id: fixtureId('7c00', 3),
      check_item: '【架空デモ】四半期アクセス権レビューの実施記録と承認記録を確認できるか',
      evidence_required: '対象権限一覧・レビュー記録・承認記録。初回是正後も次回点検で再発防止の有効性を確認する。',
      auditor_id: auditor, status: 'completed', result: 'minor_nc',
      findings: '直近四半期の実施記録が見つからない。担当・期限・記録先が統一されていない可能性がある（原因仮説、要調査）。',
      evidence_provided: '【架空の監査時確認メモ】サンプルID DEMO-ACCESS-01〜03。権限一覧は存在するが、レビュー実施日・確認者・承認記録は未記録。是正実施や有効性の証明ではない。',
      reviewed_at: createdAt, ...timestamps,
    }],
    nonconformities: [{
      id: auditDemoNcId, audit_checklist_id: fixtureId('7c04'), nc_number: 'DEMO-ACCESS-001',
      type: 'minor', description: '【架空デモ】四半期アクセス権レビューの実施記録が見つからない。担当未割当の指摘から是正対応を開始してください。',
      root_cause: '原因仮説（未検証）：担当・実施期限・記録先が統一されていない。',
      corrective_action: null, preventive_action: null, responsible_id: null,
      due_date: day(14), status: 'open', resolution_date: null, verification_date: null, verified_by: null, ...timestamps,
    }],
    corrective_actions: [{
      id: fixtureId('7c06'), nonconformity_id: auditDemoNcId,
      action_description: '【未着手】原因を調査し、今回の権限レビューを実施する。担当・期限・記録先・次回点検の方法を決めてから内容を更新してください。',
      responsible_id: null, planned_date: day(14), completion_date: null, status: 'planned',
      effectiveness_review: null, reviewed_by: null, reviewed_at: null, ...timestamps,
    }],
    follow_up_records: [
      followUp(91, '【架空デモ】担当決定と初回是正', '担当を選び、対応開始へ進める。原因調査・権限レビュー実施・記録先の統一を行い、チェックリストへ架空の証跡テキストを残す。完了判断は実施後に行う。', 14),
      followUp(92, '【架空デモ】次回点検で有効性確認（未完）', '次回四半期のレビューが決めた担当・期限・記録先で実施されたかを確認する。初回点検だけで再発防止有効と確定せず、未完のまま残す。', 90),
    ],
  };
}

// Only fixed new IDs are inserted. Existing edits and unrelated rows survive reruns.
export async function insertAuditCorrectiveDemo(transaction, anchor = new Date()) {
  const org = await transaction.execute({ sql: 'select id from organizations where id = ? and subscription_status = ? and deletion_status = ?', args: [auditDemoOrganizationId, 'active', 'active'] });
  const user = await transaction.execute({ sql: 'select id from user_profiles where id = ? and organization_id = ? and is_active = 1', args: [auditor, auditDemoOrganizationId] });
  if (org.rows.length !== 1 || user.rows.length !== 1) throw new Error('Expected fictional demo organization/auditor is absent');
  let inserted = 0;
  for (const [table, rows] of Object.entries(buildAuditCorrectiveDemo(anchor))) {
    for (const row of rows) {
      const columns = Object.keys(row);
      const result = await transaction.execute({
        sql: `insert into ${table} (${columns.join(',')}) values (${columns.map(() => '?').join(',')}) on conflict(id) do nothing`,
        args: Object.values(row),
      });
      inserted += result.rowsAffected;
    }
  }
  return { inserted, planId: auditDemoPlanId, nonconformityId: auditDemoNcId };
}
