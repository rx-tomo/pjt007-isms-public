import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle/client'
import { toCsv } from '@/lib/utils/exporters/csv'
import { createZipBuffer } from '@/lib/utils/exporters/zip'
import {
  auditLogs,
  auditChecklists,
  auditEvidence,
  auditPlans,
  auditReports,
  correctiveActions,
  documents,
  educationMaterials,
  educationPlans,
  educationRecords,
  followUpRecords,
  informationAssets,
  isoControls,
  managementReviewActions,
  managementReviewItems,
  managementReviews,
  nonconformities,
  organizationDepartments,
  organizationIsmsScopes,
  organizations,
  parseJsonArray,
  projectAssignments,
  projectRoles,
  riskTreatments,
  risks,
  soaVersions,
  tasks,
} from '@/lib/db/drizzle/schema'
import { requireServiceRole } from '@/lib/server/auth/secureClient'

type BundleItemStatus = 'ready' | 'missing' | 'needs_review'

type BundleItem = {
  key: string
  label: string
  status: BundleItemStatus
  count: number
  sources: string[]
  evidence: string[]
  gaps: string[]
  gapActions: BundleGapAction[]
}

type BundleGapAction = {
  gap: string
  reason: string
  nextAction: string
  route: string
}

type RawBundleItem = Omit<BundleItem, 'gapActions'>

type SubmissionBundle = {
  organization: {
    id: string
    name: string
    ismsPhase: string | null
    isoCertificationStatus: string | null
  }
  generatedAt: string
  reviewNotice: {
    title: string
    body: string
  }
  readiness: {
    status: 'ready' | 'ready_with_gaps'
    readyItems: number
    totalItems: number
    gapItems: string[]
  }
  latestSoaVersion: {
    id: string
    versionNumber: number
    title: string
    controlCount: number
    approvedControlCount: number
    publishedAt: string
  } | null
  items: BundleItem[]
}

const SUBMISSION_BUNDLE_REVIEW_NOTICE = {
  title: 'Audit preparation support notice',
  body: 'This package organizes evidence for audit preparation and internal review. It does not guarantee ISO 27001 certification or audit acceptance, but it helps teams review required information and open gaps.',
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function buildBundlePdfLines(bundle: SubmissionBundle): string[] {
  const phaseStory = bundle.organization.ismsPhase === 'surveillance'
    ? 'Certified organization annual operation'
    : 'Initial certification preparation'
  const bundleType = bundle.organization.ismsPhase === 'surveillance'
    ? 'Annual operation evidence package'
    : 'Initial certification preparation package'
  const latestSoa = bundle.latestSoaVersion
    ? `v${bundle.latestSoaVersion.versionNumber} / controls ${bundle.latestSoaVersion.controlCount} / approved ${bundle.latestSoaVersion.approvedControlCount}`
    : 'not published'
  const gapLines = bundle.items.flatMap((item) =>
    item.gapActions.map((action) => `- ${item.key}: ${action.reason} / next: ${action.nextAction} / route: ${action.route}`)
  )

  return [
    'ISMS Pilot - Audit Preparation Package',
    '審査準備パッケージサマリー',
    `Organization: ${bundle.organization.name}`,
    `Generated: ${bundle.generatedAt}`,
    '',
    'Document profile',
    '文書プロファイル',
    `Bundle type: ${bundleType}`,
    'Intended use: Audit preparation and internal review support',
    'Export package: manifest JSON, summary CSV, items CSV, gaps CSV, summary PDF',
    'Decision basis: Readiness status, evidence checklist, and open gap review',
    '',
    'Review scope',
    '確認範囲',
    `Phase story: ${phaseStory}`,
    `ISMS phase: ${bundle.organization.ismsPhase ?? '-'}`,
    `Certification status: ${bundle.organization.isoCertificationStatus ?? '-'}`,
    '',
    'Readiness summary',
    '準備状況サマリー',
    `Status: ${bundle.readiness.status}`,
    `Ready items: ${bundle.readiness.readyItems} / ${bundle.readiness.totalItems}`,
    `Gap item keys: ${bundle.readiness.gapItems.length > 0 ? bundle.readiness.gapItems.join(', ') : 'none'}`,
    `Latest applicability decision: ${latestSoa}`,
    '',
    'Audit preparation notice',
    '審査準備上の注意',
    bundle.reviewNotice.body,
    '',
    'Evidence checklist',
    '証跡チェックリスト',
    ...bundle.items.flatMap((item) => [
      `- [${item.status.toUpperCase()}] ${item.key}: ${item.label} / count ${item.count}`,
      `  sources: ${item.sources.join(', ')}`,
      `  evidence: ${item.evidence.length > 0 ? item.evidence.join('; ') : '-'}`,
    ]),
    '',
    'Gap review',
    '不足確認',
    ...(gapLines.length > 0 ? gapLines : ['No open gaps']),
    '',
    'Reviewer sign-off',
    '確認欄',
    'Prepared by: system_operator',
    'Reviewed by: ______________________________',
    'Review date: ______________________________',
    'Decision: Ready for audit preparation review / Needs follow-up',
    'Notes: ________________________________________________________________',
  ]
}

function buildBundlePdfHtml(bundle: SubmissionBundle) {
  const lines = buildBundlePdfLines(bundle)
  const phaseStory = bundle.organization.ismsPhase === 'surveillance'
    ? 'Certified organization annual operation'
    : 'Initial certification preparation'
  const bundleType = bundle.organization.ismsPhase === 'surveillance'
    ? 'Annual operation evidence package'
    : 'Initial certification preparation package'
  const latestSoa = bundle.latestSoaVersion
    ? `v${bundle.latestSoaVersion.versionNumber} / controls ${bundle.latestSoaVersion.controlCount} / approved ${bundle.latestSoaVersion.approvedControlCount}`
    : 'not published'
  const gapActions = bundle.items.flatMap((item) =>
    item.gapActions.map((action) => ({
      key: item.key,
      label: item.label,
      reason: action.reason,
      nextAction: action.nextAction,
      route: action.route,
    }))
  )
  const evidenceRows = bundle.items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.key)}</strong><br><span>${escapeHtml(item.label)}</span></td>
      <td><span class="status ${item.status}">${escapeHtml(item.status)}</span></td>
      <td class="count">${item.count}</td>
      <td>${escapeHtml(item.sources.join(', '))}</td>
      <td>${escapeHtml(item.evidence.length > 0 ? item.evidence.join('; ') : '-')}</td>
    </tr>
  `).join('')
  const gapRows = gapActions.length > 0
    ? gapActions.map((gap) => `
      <tr>
        <td><strong>${escapeHtml(gap.key)}</strong><br><span>${escapeHtml(gap.label)}</span></td>
        <td>${escapeHtml(gap.reason)}</td>
        <td>${escapeHtml(gap.nextAction)}</td>
        <td>${escapeHtml(gap.route)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4">No open gaps</td></tr>'
  const hiddenText = lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('\n')

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>ISMS Pilot - Audit Preparation Package</title>
  <style>
    @page { size: A4; margin: 18mm 14mm 20mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #172033;
      font-family: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "AppleGothic", system-ui, sans-serif;
      font-size: 10.2pt;
      line-height: 1.55;
      background: #ffffff;
    }
    h1, h2, h3, p { margin: 0; }
    .cover {
      border-bottom: 3px solid #1f5f6f;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .eyebrow {
      color: #6b7280;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    h1 {
      color: #12333b;
      font-size: 23pt;
      line-height: 1.22;
      margin-top: 4px;
    }
    .subtitle {
      color: #46515f;
      font-size: 10.5pt;
      margin-top: 8px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 16px 0;
    }
    .meta-card, .notice, .signoff {
      border: 1px solid #d7dee6;
      border-radius: 6px;
      padding: 10px 12px;
      break-inside: avoid;
    }
    .meta-card {
      background: #f7fafc;
    }
    .meta-card .label {
      color: #64748b;
      font-size: 8.3pt;
      font-weight: 700;
    }
    .meta-card .value {
      color: #172033;
      font-size: 10.2pt;
      font-weight: 700;
      margin-top: 3px;
    }
    .notice {
      background: #fff8e6;
      border-color: #e4c66d;
      color: #5f4600;
      margin: 12px 0 18px;
    }
    section {
      margin-top: 18px;
      break-inside: avoid-page;
    }
    h2 {
      color: #1f5f6f;
      font-size: 14pt;
      margin-bottom: 8px;
      padding-left: 9px;
      border-left: 4px solid #1f5f6f;
      break-after: avoid;
    }
    h3 {
      color: #334155;
      font-size: 10.5pt;
      margin: 10px 0 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.4pt;
      margin-top: 8px;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td {
      border: 1px solid #d7dee6;
      padding: 6px 7px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #eef6f8;
      color: #12333b;
      font-weight: 700;
    }
    td span {
      color: #64748b;
      font-size: 7.8pt;
    }
    .count {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .status {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 7.4pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status.ready { background: #e6f6ef; color: #11613d; }
    .status.missing { background: #fdecec; color: #9b1c1c; }
    .status.needs_review { background: #fff7df; color: #7c4a03; }
    .signoff {
      margin-top: 10px;
      background: #fbfdff;
    }
    .signoff-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
    }
    .line {
      border-bottom: 1px solid #9aa6b2;
      min-height: 22px;
      padding-top: 3px;
    }
    .notes {
      grid-column: 1 / -1;
      min-height: 52px;
    }
    .extractable-text {
      position: absolute;
      left: -10000px;
      top: 0;
      width: 1px;
      height: 1px;
      overflow: hidden;
      color: transparent;
      font-size: 1px;
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="eyebrow">ISMS Pilot - Audit Preparation Package</div>
    <h1>審査準備パッケージサマリー</h1>
    <p class="subtitle">審査準備と内部レビューのために、証跡、判断根拠、不足事項を読みやすく整理した確認資料です。</p>
  </div>

  <div class="meta-grid">
    <div class="meta-card"><div class="label">Organization</div><div class="value">${escapeHtml(bundle.organization.name)}</div></div>
    <div class="meta-card"><div class="label">Generated</div><div class="value">${escapeHtml(bundle.generatedAt)}</div></div>
    <div class="meta-card"><div class="label">Bundle type</div><div class="value">${escapeHtml(bundleType)}</div></div>
    <div class="meta-card"><div class="label">Phase story</div><div class="value">${escapeHtml(phaseStory)}</div></div>
    <div class="meta-card"><div class="label">Ready items</div><div class="value">${bundle.readiness.readyItems} / ${bundle.readiness.totalItems}</div></div>
    <div class="meta-card"><div class="label">Latest applicability decision</div><div class="value">${escapeHtml(latestSoa)}</div></div>
  </div>

  <div class="notice">
    <strong>Audit preparation notice / 審査準備上の注意</strong><br>
    ${escapeHtml(bundle.reviewNotice.body)}
  </div>

  <section>
    <h2>Document profile / 文書プロファイル</h2>
    <table>
      <tbody>
        <tr><th>Intended use</th><td>Audit preparation and internal review support</td></tr>
        <tr><th>Export package</th><td>manifest JSON, summary CSV, items CSV, gaps CSV, summary PDF</td></tr>
        <tr><th>Decision basis</th><td>Readiness status, evidence checklist, and open gap review</td></tr>
        <tr><th>ISMS phase</th><td>${escapeHtml(bundle.organization.ismsPhase ?? '-')}</td></tr>
        <tr><th>Certification status</th><td>${escapeHtml(bundle.organization.isoCertificationStatus ?? '-')}</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>Readiness summary / 準備状況サマリー</h2>
    <table>
      <tbody>
        <tr><th>Status</th><td>${escapeHtml(bundle.readiness.status)}</td></tr>
        <tr><th>Gap item keys</th><td>${escapeHtml(bundle.readiness.gapItems.length > 0 ? bundle.readiness.gapItems.join(', ') : 'none')}</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>Evidence checklist / 証跡チェックリスト</h2>
    <table>
      <thead>
        <tr><th>Item</th><th>Status</th><th>Count</th><th>Sources</th><th>Evidence</th></tr>
      </thead>
      <tbody>${evidenceRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Gap review / 不足確認</h2>
    <table>
      <thead>
        <tr><th>Item</th><th>Reason</th><th>Next action</th><th>Route</th></tr>
      </thead>
      <tbody>${gapRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Reviewer sign-off / 確認欄</h2>
    <div class="signoff">
      <div class="signoff-grid">
        <div><strong>Prepared by</strong><div class="line">system_operator</div></div>
        <div><strong>Reviewed by</strong><div class="line"></div></div>
        <div><strong>Review date</strong><div class="line"></div></div>
        <div><strong>Decision</strong><div class="line">Ready for audit preparation review / Needs follow-up</div></div>
        <div class="notes"><strong>Notes</strong><div class="line notes"></div></div>
      </div>
    </div>
  </section>

  <div class="extractable-text" aria-hidden="true">${hiddenText}</div>
</body>
</html>`
}

async function renderBundlePdfWithChromium(bundle: SubmissionBundle): Promise<Buffer> {
  const puppeteer = await import('puppeteer')
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'isms-submission-pdf-'))
  const cacheDir = path.join(userDataDir, 'cache')
  const crashDumpsDir = path.join(userDataDir, 'crash-dumps')
  let browser: Awaited<ReturnType<typeof puppeteer.default.launch>> | null = null

  try {
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.mkdir(crashDumpsDir, { recursive: true })
    browser = await puppeteer.default.launch({
      headless: true,
      userDataDir,
      env: {
        ...process.env,
        HOME: userDataDir,
        XDG_CACHE_HOME: cacheDir,
        TMPDIR: userDataDir,
      },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-crash-reporter',
        '--disable-crashpad',
        `--crash-dumps-dir=${crashDumpsDir}`,
      ],
    })
    const page = await browser.newPage()
    await page.setContent(buildBundlePdfHtml(bundle), { waitUntil: 'load' })
    await page.emulateMediaType('screen')
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: { top: '12mm', right: '0mm', bottom: '14mm', left: '0mm' },
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%; font-size:7pt; color:#64748b; padding:0 14mm; font-family:system-ui, sans-serif;">
          <span>ISMS Pilot audit preparation support</span>
          <span style="float:right;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
    })

    return Buffer.from(pdf)
  } finally {
    if (browser) {
      await browser.close()
    }
    await fs.rm(userDataDir, { recursive: true, force: true })
  }
}

async function buildBundlePdf(bundle: SubmissionBundle): Promise<Buffer> {
  try {
    return await renderBundlePdfWithChromium(bundle)
  } catch (error) {
    console.error('Failed to render audit preparation package PDF with Chromium', error)
    throw new Error('Failed to render audit preparation package PDF')
  }
}

const readyWhen = (
  condition: boolean,
  item: Omit<RawBundleItem, 'status'>,
  missingGap: string
): RawBundleItem => ({
  ...item,
  status: condition ? 'ready' : 'missing',
  gaps: condition ? item.gaps : [missingGap, ...item.gaps],
})

const BUNDLE_ITEM_REMEDIATION: Record<string, { nextAction: string; route: string }> = {
  isms_scope: {
    nextAction: 'ISMS適用範囲を登録し、対象拠点・部門・システム・業務プロセスを確認する',
    route: '/settings/organization',
  },
  organization_structure: {
    nextAction: '体制ロールと担当者の割当を確認する',
    route: '/settings/structure',
  },
  approved_documents: {
    nextAction: '提出候補にする文書を作成し、承認済みにする',
    route: '/documents',
  },
  information_assets: {
    nextAction: '情報資産台帳を登録またはインポートする',
    route: '/settings/assets',
  },
  risk_assessment: {
    nextAction: 'リスクと対応策を登録し、必要な対応状況を更新する',
    route: '/risks',
  },
  soa_version: {
    nextAction: '適用管理策の判断を確認し、判断版を発行する',
    route: '/settings/controls',
  },
  initial_tasks: {
    nextAction: '初回登録準備タスクを作成し、進捗を更新する',
    route: '/tasks',
  },
  education_training_evidence: {
    nextAction: '教育計画、教材、受講記録を確認し、合格または完了記録を残す',
    route: '/education',
  },
  annual_audit_plans: {
    nextAction: '年次内部監査計画を作成し、予定化または開始する',
    route: '/audit',
  },
  audit_reports: {
    nextAction: '内部監査報告書を作成し、必要な承認を完了する',
    route: '/audit/reports',
  },
  nonconformity_corrective_actions: {
    nextAction: '不適合と是正処置を更新し、解決・完了状態まで進める',
    route: '/audit/nonconformities',
  },
  follow_up_records: {
    nextAction: 'フォローアップ記録を作成し、完了または検証済みにする',
    route: '/audit',
  },
  management_reviews: {
    nextAction: 'マネジメントレビューを記録し、完了状態へ更新する',
    route: '/management-reviews',
  },
  residual_risk_acceptances: {
    nextAction: '残留リスク受容の理由、承認状態、再レビュー日を確認する',
    route: '/risks',
  },
  annual_audit_evidence: {
    nextAction: '内部監査の証跡ファイルを監査チェックリストへ添付する',
    route: '/audit',
  },
}

function addGapActions(items: RawBundleItem[]): BundleItem[] {
  return items.map((item) => {
    const remediation = BUNDLE_ITEM_REMEDIATION[item.key] ?? {
      nextAction: '関連画面で不足情報を更新する',
      route: '/home',
    }
    return {
      ...item,
      gapActions: item.gaps.map((gap) => ({
        gap,
        reason: gap,
        nextAction: remediation.nextAction,
        route: remediation.route,
      })),
    }
  })
}

async function buildBundleZip(bundle: SubmissionBundle) {
  const bundlePdf = await buildBundlePdf(bundle)
  const bundleItemsCsv = toCsv(
    ['key', 'label', 'status', 'count', 'sources', 'evidence', 'gaps', 'next_actions', 'routes'],
    bundle.items.map((item) => [
      item.key,
      item.label,
      item.status,
      item.count,
      item.sources.join('; '),
      item.evidence.join('; '),
      item.gaps.join('; '),
      item.gapActions.map((action) => action.nextAction).join('; '),
      item.gapActions.map((action) => action.route).join('; '),
    ])
  )

  const gapsCsv = toCsv(
    ['key', 'label', 'gap', 'reason', 'next_action', 'route'],
    bundle.items.flatMap((item) =>
      item.gapActions.length > 0
        ? item.gapActions.map((action) => [
            item.key,
            item.label,
            action.gap,
            action.reason,
            action.nextAction,
            action.route,
          ])
        : []
    )
  )

  const summaryCsv = toCsv(
    ['organization_id', 'organization_name', 'isms_phase', 'certification_status', 'readiness_status', 'ready_items', 'total_items', 'latest_soa_version'],
    [[
      bundle.organization.id,
      bundle.organization.name,
      bundle.organization.ismsPhase ?? '',
      bundle.organization.isoCertificationStatus ?? '',
      bundle.readiness.status,
      bundle.readiness.readyItems,
      bundle.readiness.totalItems,
      bundle.latestSoaVersion ? `v${bundle.latestSoaVersion.versionNumber}` : '',
    ]]
  )

  return createZipBuffer([
    { name: 'audit-preparation-package-manifest.json', content: `${JSON.stringify(bundle, null, 2)}\n` },
    { name: 'audit-preparation-package-summary.pdf', content: bundlePdf },
    { name: 'audit-preparation-package-summary.csv', content: summaryCsv },
    { name: 'audit-preparation-package-items.csv', content: bundleItemsCsv },
    { name: 'audit-preparation-package-gaps.csv', content: gapsCsv },
  ])
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  const format = request.nextUrl.searchParams.get('format') ?? 'json'

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  if (!['json', 'zip', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  }

  const { guard, error } = await requireServiceRole(request, {
    allowedRoles: ['org_admin', 'system_operator', 'auditor'],
    organizationId,
    actionName: 'examination.submission_bundle.viewed',
    logContext: { organizationId },
  })
  if (error || !guard) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()

  try {
    const [
      organizationRows,
      scopeRows,
      departmentRows,
      roleRows,
      assignmentRows,
      documentRows,
      assetRows,
      riskRows,
      treatmentRows,
      controlRows,
      latestSoaRows,
      taskRows,
      auditPlanRows,
      auditReportRows,
      auditEvidenceRows,
      nonconformityRows,
      correctiveActionRows,
      followUpRows,
      managementReviewRows,
      managementReviewItemRows,
      managementReviewActionRows,
      educationPlanRows,
      educationRecordRows,
      educationMaterialRows,
    ] = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1),
      db.select().from(organizationIsmsScopes).where(eq(organizationIsmsScopes.organizationId, organizationId)).limit(1),
      db.select().from(organizationDepartments).where(eq(organizationDepartments.organizationId, organizationId)),
      db.select().from(projectRoles).where(eq(projectRoles.organizationId, organizationId)),
      db.select().from(projectAssignments).where(eq(projectAssignments.organizationId, organizationId)),
      db.select().from(documents).where(eq(documents.organizationId, organizationId)),
      db.select().from(informationAssets).where(eq(informationAssets.organizationId, organizationId)),
      db.select().from(risks).where(eq(risks.organizationId, organizationId)),
      db
        .select({
          id: riskTreatments.id,
          status: riskTreatments.status,
          treatmentType: riskTreatments.treatmentType,
          residualApprovalStatus: riskTreatments.residualApprovalStatus,
          residualReviewDueDate: riskTreatments.residualReviewDueDate,
        })
        .from(riskTreatments)
        .innerJoin(risks, eq(risks.id, riskTreatments.riskId))
        .where(eq(risks.organizationId, organizationId)),
      db.select().from(isoControls).where(eq(isoControls.organizationId, organizationId)),
      db
        .select()
        .from(soaVersions)
        .where(eq(soaVersions.organizationId, organizationId))
        .orderBy(desc(soaVersions.versionNumber))
        .limit(1),
      db.select().from(tasks).where(eq(tasks.organizationId, organizationId)),
      db.select().from(auditPlans).where(eq(auditPlans.organizationId, organizationId)),
      db
        .select({
          id: auditReports.id,
          approvalStatus: auditReports.approvalStatus,
        })
        .from(auditReports)
        .innerJoin(auditPlans, eq(auditPlans.id, auditReports.auditPlanId))
        .where(eq(auditPlans.organizationId, organizationId)),
      db
        .select({ id: auditEvidence.id })
        .from(auditEvidence)
        .innerJoin(auditChecklists, eq(auditChecklists.id, auditEvidence.auditChecklistId))
        .innerJoin(auditPlans, eq(auditPlans.id, auditChecklists.auditPlanId))
        .where(eq(auditPlans.organizationId, organizationId)),
      db
        .select({
          id: nonconformities.id,
          status: nonconformities.status,
        })
        .from(nonconformities)
        .innerJoin(auditChecklists, eq(auditChecklists.id, nonconformities.auditChecklistId))
        .innerJoin(auditPlans, eq(auditPlans.id, auditChecklists.auditPlanId))
        .where(eq(auditPlans.organizationId, organizationId)),
      db
        .select({
          id: correctiveActions.id,
          status: correctiveActions.status,
        })
        .from(correctiveActions)
        .innerJoin(nonconformities, eq(nonconformities.id, correctiveActions.nonconformityId))
        .innerJoin(auditChecklists, eq(auditChecklists.id, nonconformities.auditChecklistId))
        .innerJoin(auditPlans, eq(auditPlans.id, auditChecklists.auditPlanId))
        .where(eq(auditPlans.organizationId, organizationId)),
      db.select().from(followUpRecords).where(eq(followUpRecords.organizationId, organizationId)),
      db.select().from(managementReviews).where(eq(managementReviews.organizationId, organizationId)),
      db
        .select({ id: managementReviewItems.id })
        .from(managementReviewItems)
        .innerJoin(managementReviews, eq(managementReviews.id, managementReviewItems.reviewId))
        .where(eq(managementReviews.organizationId, organizationId)),
      db
        .select({
          id: managementReviewActions.id,
          status: managementReviewActions.status,
        })
        .from(managementReviewActions)
        .innerJoin(managementReviews, eq(managementReviews.id, managementReviewActions.reviewId))
        .where(eq(managementReviews.organizationId, organizationId)),
      db.select().from(educationPlans).where(eq(educationPlans.organizationId, organizationId)),
      db
        .select({
          id: educationRecords.id,
          result: educationRecords.result,
        })
        .from(educationRecords)
        .innerJoin(educationPlans, eq(educationPlans.id, educationRecords.planId))
        .where(eq(educationPlans.organizationId, organizationId)),
      db.select().from(educationMaterials).where(eq(educationMaterials.organizationId, organizationId)),
    ])

    const organization = organizationRows[0]
    if (!organization) {
      return guard.json({ error: 'Organization not found' }, { status: 404 })
    }

    const scope = scopeRows[0] ?? null
    const scopeParts = scope
      ? [
          ['physical_locations', parseJsonArray(scope.physicalLocations).length],
          ['it_systems', parseJsonArray(scope.itSystems).length],
          ['departments', parseJsonArray(scope.departments).length],
          ['processes', parseJsonArray(scope.processes).length],
          ['exclusions', parseJsonArray(scope.exclusions).length],
        ] as const
      : []
    const hasScope = scopeParts.some(([, count]) => count > 0)

    const requiredRoles = roleRows.filter((role) => role.isRequired)
    const assignedRoleIds = new Set(assignmentRows.map((assignment) => assignment.roleId))
    const assignedRequiredRoles = requiredRoles.filter((role) => assignedRoleIds.has(role.id))

    const approvedDocuments = documentRows.filter((document) => document.status === 'approved')
    const parentTaskRows = taskRows.filter((task) => !task.parentTaskId)
    const subtaskRows = taskRows.filter((task) => Boolean(task.parentTaskId))
    const completedTasks = taskRows.filter((task) => task.status === 'done')
    const openTasks = taskRows.filter((task) => !['done', 'cancelled'].includes(task.status ?? 'todo'))
    const averageTaskProgress = taskRows.length > 0
      ? Math.round(taskRows.reduce((sum, task) => sum + (task.progress ?? 0), 0) / taskRows.length)
      : 0
    const latestSoa = latestSoaRows[0] ?? null
    const passedEducationRecords = educationRecordRows.filter((record) => record.result === 'passed')
    const educationEvidenceStatus: BundleItemStatus = educationPlanRows.length === 0 || educationRecordRows.length === 0
      ? 'missing'
      : passedEducationRecords.length > 0
        ? 'ready'
        : 'needs_review'
    const educationEvidenceItem: RawBundleItem = {
      key: 'education_training_evidence',
      label: '教育・訓練証跡',
      status: educationEvidenceStatus,
      count: educationRecordRows.length,
      sources: ['education_plans', 'education_records', 'education_materials'],
      evidence: [
        `education_plans:${educationPlanRows.length}`,
        `education_records:${educationRecordRows.length}`,
        `passed_records:${passedEducationRecords.length}`,
        `materials:${educationMaterialRows.length}`,
      ],
      gaps: educationEvidenceStatus === 'ready'
        ? []
        : educationPlanRows.length === 0
          ? ['教育計画が未作成です']
          : educationRecordRows.length === 0
            ? ['教育計画に受講記録がありません']
            : ['合格または完了確認済みの受講記録がありません'],
    }

    const initialItems: RawBundleItem[] = [
      readyWhen(
        hasScope,
        {
          key: 'isms_scope',
          label: 'ISMS適用範囲',
          count: scope ? 1 : 0,
          sources: ['organization_isms_scopes'],
          evidence: scopeParts.map(([key, count]) => `${key}:${count}`),
          gaps: [],
        },
        'ISMS適用範囲が未登録です'
      ),
      {
        key: 'organization_structure',
        label: '体制・担当者',
        status: requiredRoles.length > 0 && assignedRequiredRoles.length === requiredRoles.length ? 'ready' : 'needs_review',
        count: assignmentRows.length,
        sources: ['organization_departments', 'project_roles', 'project_assignments'],
        evidence: [
          `departments:${departmentRows.length}`,
          `required_roles:${requiredRoles.length}`,
          `assigned_required_roles:${assignedRequiredRoles.length}`,
        ],
        gaps:
          requiredRoles.length > 0 && assignedRequiredRoles.length === requiredRoles.length
            ? []
            : ['必須体制ロールの担当者割当を確認してください'],
      },
      readyWhen(
        approvedDocuments.length > 0,
        {
          key: 'approved_documents',
          label: '承認済み文書',
          count: approvedDocuments.length,
          sources: ['documents'],
          evidence: [
            `documents:${documentRows.length}`,
            `approved:${approvedDocuments.length}`,
            `draft_or_review:${documentRows.length - approvedDocuments.length}`,
          ],
          gaps: [],
        },
        '提出候補になる承認済み文書がありません'
      ),
      readyWhen(
        assetRows.length > 0,
        {
          key: 'information_assets',
          label: '情報資産台帳',
          count: assetRows.length,
          sources: ['information_assets'],
          evidence: [`assets:${assetRows.length}`],
          gaps: [],
        },
        '情報資産が未登録です'
      ),
      readyWhen(
        riskRows.length > 0 && treatmentRows.length > 0,
        {
          key: 'risk_assessment',
          label: 'リスクアセスメント・対応',
          count: riskRows.length,
          sources: ['risks', 'risk_treatments'],
          evidence: [
            `risks:${riskRows.length}`,
            `treatments:${treatmentRows.length}`,
            `completed_treatments:${treatmentRows.filter((treatment) => treatment.status === 'completed').length}`,
          ],
          gaps: [],
        },
        'リスクまたはリスク対応策が不足しています'
      ),
      readyWhen(
        Boolean(latestSoa),
        {
          key: 'soa_version',
          label: '適用管理策判断版',
          count: latestSoa ? 1 : 0,
          sources: ['soa_versions', 'iso_controls'],
          evidence: latestSoa
            ? [
                `latest_version:v${latestSoa.versionNumber}`,
                `controls:${latestSoa.controlCount}`,
                `approved_controls:${latestSoa.approvedControlCount}`,
              ]
            : [`controls:${controlRows.length}`],
          gaps: [],
        },
        '適用管理策の判断版が未発行です'
      ),
      readyWhen(
        taskRows.length > 0,
        {
          key: 'initial_tasks',
          label: '初期タスク・次アクション',
          count: taskRows.length,
          sources: ['tasks'],
          evidence: [
            `tasks:${taskRows.length}`,
            `parent_tasks:${parentTaskRows.length}`,
            `subtasks:${subtaskRows.length}`,
            `completed_tasks:${completedTasks.length}`,
            `open_tasks:${openTasks.length}`,
            `average_progress:${averageTaskProgress}`,
          ],
          gaps: [],
        },
        '初期タスクが未登録です'
      ),
      educationEvidenceItem,
    ]

    const scheduledOrLaterAuditPlans = auditPlanRows.filter((plan) =>
      ['scheduled', 'in_progress', 'completed'].includes(plan.status ?? 'planning')
    )
    const approvedAuditReports = auditReportRows.filter((report) => report.approvalStatus === 'approved')
    const resolvedNonconformities = nonconformityRows.filter((row) =>
      ['resolved', 'closed', 'verified'].includes(row.status ?? 'open')
    )
    const completedCorrectiveActions = correctiveActionRows.filter((row) =>
      ['completed', 'verified'].includes(row.status ?? 'planned')
    )
    const completedFollowUps = followUpRows.filter((row) =>
      ['completed', 'verified', 'closed'].includes(row.status ?? 'open')
    )
    const completedManagementReviews = managementReviewRows.filter((review) => review.status === 'completed')
    const approvedResidualAcceptances = treatmentRows.filter((treatment) =>
      treatment.treatmentType === 'accept' && treatment.residualApprovalStatus === 'approved'
    )
    const approvedResidualAcceptancesWithReviewDueDate = approvedResidualAcceptances.filter((treatment) =>
      Boolean(treatment.residualReviewDueDate)
    )

    const surveillanceItems: RawBundleItem[] = [
      {
        key: 'annual_audit_plans',
        label: '年次内部監査計画',
        status: auditPlanRows.length > 0 && scheduledOrLaterAuditPlans.length > 0 ? 'ready' : 'missing',
        count: auditPlanRows.length,
        sources: ['audit_plans'],
        evidence: [
          `audit_plans:${auditPlanRows.length}`,
          `scheduled_or_later:${scheduledOrLaterAuditPlans.length}`,
        ],
        gaps: auditPlanRows.length > 0 && scheduledOrLaterAuditPlans.length > 0
          ? []
          : ['年次内部監査計画が未作成、または予定化されていません'],
      },
      {
        key: 'audit_reports',
        label: '内部監査報告書',
        status: approvedAuditReports.length > 0
          ? 'ready'
          : auditReportRows.length > 0
            ? 'needs_review'
            : 'missing',
        count: auditReportRows.length,
        sources: ['audit_reports', 'approval_requests', 'approval_events'],
        evidence: [
          `audit_reports:${auditReportRows.length}`,
          `approved:${approvedAuditReports.length}`,
        ],
        gaps: approvedAuditReports.length > 0
          ? []
          : auditReportRows.length > 0
            ? ['内部監査報告書が未承認です']
            : ['内部監査報告書が未作成です'],
      },
      {
        key: 'nonconformity_corrective_actions',
        label: '不適合・是正処置',
        status: nonconformityRows.length === 0
          ? 'missing'
          : resolvedNonconformities.length === nonconformityRows.length &&
            completedCorrectiveActions.length === correctiveActionRows.length
            ? 'ready'
            : 'needs_review',
        count: nonconformityRows.length + correctiveActionRows.length,
        sources: ['nonconformities', 'corrective_actions'],
        evidence: [
          `nonconformities:${nonconformityRows.length}`,
          `resolved_or_later:${resolvedNonconformities.length}`,
          `corrective_actions:${correctiveActionRows.length}`,
          `completed_or_verified:${completedCorrectiveActions.length}`,
        ],
        gaps: nonconformityRows.length === 0
          ? ['不適合または是正処置の記録がありません']
          : resolvedNonconformities.length === nonconformityRows.length &&
            completedCorrectiveActions.length === correctiveActionRows.length
            ? []
            : ['未解決の不適合または未完了の是正処置があります'],
      },
      {
        key: 'follow_up_records',
        label: 'フォローアップ記録',
        status: followUpRows.length === 0
          ? 'missing'
          : completedFollowUps.length === followUpRows.length
            ? 'ready'
            : 'needs_review',
        count: followUpRows.length,
        sources: ['follow_up_records'],
        evidence: [
          `follow_ups:${followUpRows.length}`,
          `completed_or_verified:${completedFollowUps.length}`,
        ],
        gaps: followUpRows.length === 0
          ? ['フォローアップ記録がありません']
          : completedFollowUps.length === followUpRows.length
            ? []
            : ['未完了または未検証のフォローアップがあります'],
      },
      {
        key: 'management_reviews',
        label: 'マネジメントレビュー',
        status: managementReviewRows.length === 0
          ? 'missing'
          : completedManagementReviews.length > 0
            ? 'ready'
            : 'needs_review',
        count: managementReviewRows.length,
        sources: ['management_reviews', 'management_review_items', 'management_review_actions'],
        evidence: [
          `management_reviews:${managementReviewRows.length}`,
          `completed:${completedManagementReviews.length}`,
          `review_items:${managementReviewItemRows.length}`,
          `review_actions:${managementReviewActionRows.length}`,
        ],
        gaps: managementReviewRows.length === 0
          ? ['マネジメントレビューが未作成です']
          : completedManagementReviews.length > 0
            ? []
            : ['マネジメントレビューが未完了です'],
      },
      {
        key: 'residual_risk_acceptances',
        label: '残留リスク受容',
        status: approvedResidualAcceptancesWithReviewDueDate.length > 0
          ? 'ready'
          : treatmentRows.some((treatment) => treatment.treatmentType === 'accept')
            ? 'needs_review'
            : 'missing',
        count: treatmentRows.filter((treatment) => treatment.treatmentType === 'accept').length,
        sources: ['risk_treatments', 'approval_requests', 'approval_events'],
        evidence: [
          `accept_treatments:${treatmentRows.filter((treatment) => treatment.treatmentType === 'accept').length}`,
          `approved_acceptances:${approvedResidualAcceptances.length}`,
          `review_due_dates:${approvedResidualAcceptancesWithReviewDueDate.length}`,
        ],
        gaps: approvedResidualAcceptancesWithReviewDueDate.length > 0
          ? []
          : treatmentRows.some((treatment) => treatment.treatmentType === 'accept')
            ? approvedResidualAcceptances.length > 0
              ? ['承認済み残留リスク受容に再レビュー日が未設定です']
              : ['未承認の残留リスク受容があります']
            : ['残留リスク受容の承認記録がありません'],
      },
      {
        key: 'annual_audit_evidence',
        label: '監査証跡ファイル',
        status: auditEvidenceRows.length > 0 ? 'ready' : 'missing',
        count: auditEvidenceRows.length,
        sources: ['audit_evidence'],
        evidence: [`audit_evidence:${auditEvidenceRows.length}`],
        gaps: auditEvidenceRows.length > 0 ? [] : ['内部監査の証跡ファイルがありません'],
      },
      educationEvidenceItem,
    ]

    const items = addGapActions(organization.ismsPhase === 'surveillance' ? surveillanceItems : initialItems)

    const readyItems = items.filter((item) => item.status === 'ready').length
    const gapItems = items.filter((item) => item.status !== 'ready')
    const generatedAt = new Date().toISOString()

    const bundle: SubmissionBundle = {
      organization: {
        id: organization.id,
        name: organization.name,
        ismsPhase: organization.ismsPhase,
        isoCertificationStatus: organization.isoCertificationStatus,
      },
      generatedAt,
      reviewNotice: SUBMISSION_BUNDLE_REVIEW_NOTICE,
      readiness: {
        status: gapItems.length === 0 ? 'ready' : 'ready_with_gaps',
        readyItems,
        totalItems: items.length,
        gapItems: gapItems.map((item) => item.key),
      },
      latestSoaVersion: latestSoa
        ? {
            id: latestSoa.id,
            versionNumber: latestSoa.versionNumber,
            title: latestSoa.title,
            controlCount: latestSoa.controlCount,
            approvedControlCount: latestSoa.approvedControlCount,
            publishedAt: latestSoa.publishedAt,
          }
        : null,
      items,
    }

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: guard.userId,
      action: 'examination.submission_bundle.generated',
      resourceType: 'examination_submission_bundle',
      resourceId: latestSoa?.id ?? organizationId,
      changes: JSON.stringify({
        readiness: bundle.readiness,
        latestSoaVersionId: latestSoa?.id ?? null,
      }),
      createdAt: generatedAt,
    })

    if (format === 'zip') {
      const zipBuffer = await buildBundleZip(bundle)
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="isms-audit-preparation-package-${generatedAt.replace(/[:.]/g, '-')}.zip"`,
        },
      })
    }

    if (format === 'pdf') {
      const pdfBuffer = await buildBundlePdf(bundle)
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="isms-audit-preparation-package-${generatedAt.replace(/[:.]/g, '-')}.pdf"`,
        },
      })
    }

    return guard.json({ ok: true, bundle })
  } catch (err) {
    console.error('Failed to build audit preparation package', err)
    return guard.json({ error: 'Failed to build audit preparation package' }, { status: 500 })
  }
}
