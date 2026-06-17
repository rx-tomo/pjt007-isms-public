import type { AuditPlan, AuditReport } from '@/lib/services/audit'

interface AuditReportPdfPayload {
  organizationName: string
  plan: Pick<AuditPlan, 'title' | 'audit_type' | 'status' | 'planned_start_date' | 'planned_end_date' | 'actual_start_date' | 'actual_end_date'> & {
    leadAuditorName?: string | null
  }
  report: Pick<AuditReport, 'executive_summary' | 'scope' | 'methodology' | 'positive_findings' | 'improvement_opportunities' | 'conclusion' | 'report_date' | 'approved_by'>
  checklistStats: {
    total: number
    completed: number
  }
  evidenceCount: number
  nonconformityCount: number
}

function escapePdfText(value: string) {
  return (value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function createAuditReportPdf(payload: AuditReportPdfPayload): string {
  const lines: string[] = []
  lines.push(`${payload.organizationName} - 監査報告書`)
  lines.push('')
  lines.push(`監査タイトル: ${payload.plan.title}`)
  lines.push(`監査種別: ${payload.plan.audit_type ?? '不明'}`)
  lines.push(`ステータス: ${payload.plan.status}`)
  if (payload.plan.leadAuditorName) {
    lines.push(`主任監査員: ${payload.plan.leadAuditorName}`)
  }
  lines.push(`計画期間: ${(payload.plan.planned_start_date ?? '未設定')} 〜 ${(payload.plan.planned_end_date ?? '未設定')}`)
  if (payload.plan.actual_start_date || payload.plan.actual_end_date) {
    lines.push(`実施期間: ${(payload.plan.actual_start_date ?? 'N/A')} 〜 ${(payload.plan.actual_end_date ?? 'N/A')}`)
  }
  lines.push('')
  lines.push('--- 報告概要 ---')
  lines.push(`報告日: ${payload.report.report_date ?? '未設定'}`)
  const approverRaw = payload.report.approved_by
  let approverDisplay = '未設定'

  if (typeof approverRaw === 'string') {
    const trimmed = approverRaw.trim()
    const lowered = trimmed.toLowerCase()

    if (trimmed && lowered !== 'null' && lowered !== 'undefined') {
      approverDisplay = trimmed
    }
  }

  lines.push(`承認者: ${approverDisplay}`)
  lines.push('')
  lines.push('【エグゼクティブサマリー】')
  lines.push(payload.report.executive_summary || '記載なし')
  lines.push('')
  lines.push('【監査範囲】')
  lines.push(payload.report.scope || '記載なし')
  lines.push('')
  lines.push('【監査方法】')
  lines.push(payload.report.methodology || '記載なし')
  lines.push('')
  lines.push('【優良事例】')
  lines.push(payload.report.positive_findings || '記載なし')
  lines.push('')
  lines.push('【改善機会】')
  lines.push(payload.report.improvement_opportunities || '記載なし')
  lines.push('')
  lines.push('【結論】')
  lines.push(payload.report.conclusion || '記載なし')
  lines.push('')
  lines.push('--- サマリー ---')
  lines.push(`監査チェックリスト: 完了 ${payload.checklistStats.completed} / 総数 ${payload.checklistStats.total}`)
  lines.push(`登録された証跡ファイル数: ${payload.evidenceCount}`)
  lines.push(`記録された不適合件数: ${payload.nonconformityCount}`)

  const header = '%PDF-1.4\n'
  const contentLines = ['BT', '/F1 12 Tf', '14 TL', '1 0 0 1 50 760 Tm']

  lines.forEach((line, index) => {
    const safe = escapePdfText(line)
    if (index === 0) {
      contentLines.push(`(${safe}) Tj`)
    } else {
      contentLines.push('T*')
      contentLines.push(`(${safe}) Tj`)
    }
  })

  contentLines.push('ET')
  const stream = contentLines.join('\n')

  const positions: number[] = [0]
  let pdf = header

  const append = (block: string) => {
    positions.push(pdf.length)
    pdf += block + '\n'
  }

  append('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
  append('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj')
  append('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj')
  append(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`)
  append('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj')

  const xrefStart = pdf.length
  let xref = 'xref\n'
  xref += `0 ${positions.length}\n`
  xref += '0000000000 65535 f \n'
  for (let i = 1; i < positions.length; i++) {
    xref += `${positions[i].toString().padStart(10, '0')} 00000 n \n`
  }

  pdf += xref
  pdf += `trailer\n<< /Size ${positions.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return pdf
}

export function buildAuditReportFileName(title: string, reportDate?: string | null) {
  const base = (title || 'audit-report')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'audit-report'
  const date = reportDate ? reportDate.replace(/[^0-9]/g, '') : ''
  return date ? `${base}-${date}` : base
}
