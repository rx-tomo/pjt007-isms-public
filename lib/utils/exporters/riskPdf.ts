import type { RiskExportRecord } from '@/lib/utils/exporters/riskExcel'

interface RiskPdfFilters {
  status?: string | null
  category?: string | null
  department?: string | null
  assessmentPeriod?: string | null
  matrix?: string | null
  search?: string | null
}

interface RiskPdfPayload {
  organizationName: string
  generatedAt: string
  filters: RiskPdfFilters
  records: RiskExportRecord[]
}

const STATUS_LABELS: Record<string, string> = {
  identified: '特定済み',
  analyzing: '分析中',
  treating: '対応中',
  monitoring: '監視中',
  closed: '対応完了'
}

function escapePdfText(value: string) {
  return (value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function buildFiltersLine(filters: RiskPdfFilters) {
  const segments: string[] = []
  if (filters.assessmentPeriod) {
    segments.push(`期間: ${filters.assessmentPeriod}`)
  }
  if (filters.status) {
    segments.push(`ステータス: ${STATUS_LABELS[filters.status] ?? filters.status}`)
  }
  if (filters.category) {
    segments.push(`カテゴリ: ${filters.category}`)
  }
  if (filters.department) {
    segments.push(`部門: ${filters.department}`)
  }
  if (filters.matrix) {
    segments.push(`マトリクス: ${filters.matrix}`)
  }
  if (filters.search) {
    segments.push(`検索語: ${filters.search}`)
  }
  return segments.length ? `フィルター: ${segments.join(' / ')}` : 'フィルター: なし'
}

function appendLine(lines: string[], content = '') {
  lines.push(content)
}

export function createRiskReportPdf(payload: RiskPdfPayload) {
  const lines: string[] = []
  const orgName = payload.organizationName || 'ISMS Manager'
  appendLine(lines, `${orgName} リスクレポート`)
  appendLine(lines, `生成日時: ${payload.generatedAt}`)
  appendLine(lines, buildFiltersLine(payload.filters))
  appendLine(lines, `対象リスク数: ${payload.records.length}`)

  if (payload.records.length === 0) {
    appendLine(lines, '')
    appendLine(lines, '該当するリスクはありません。')
  } else {
    payload.records.forEach((record, index) => {
      appendLine(lines, '')
      appendLine(lines, `${index + 1}. ${record.title}`)
      appendLine(lines, `   ステータス: ${STATUS_LABELS[record.status] ?? record.status}`)
      if (record.category) {
        appendLine(lines, `   カテゴリ: ${record.category}`)
      }
      if (record.assessmentPeriod) {
        appendLine(lines, `   期間: ${record.assessmentPeriod}`)
      }
      if (record.score != null) {
        appendLine(lines, `   スコア: ${record.score}`)
      }
      appendLine(
        lines,
        `   影響度/発生可能性: ${record.impact ?? 'N/A'} / ${record.likelihood ?? 'N/A'}`
      )
      if (record.ownerName) {
        const ownerLine = record.ownerEmail
          ? `${record.ownerName} <${record.ownerEmail}>`
          : record.ownerName
        appendLine(lines, `   管理責任者: ${ownerLine}`)
      }
      if (record.identifiedDate || record.updatedAt) {
        appendLine(lines, `   日付: 特定 ${record.identifiedDate ?? '-'} / 更新 ${record.updatedAt ?? '-'}`)
      }
      if (record.assets.length) {
        appendLine(lines, '   関連資産:')
        record.assets.forEach(asset => appendLine(lines, `     - ${asset}`))
      }
      if (record.treatments.length) {
        appendLine(lines, '   対応策:')
        record.treatments.forEach(treatment => appendLine(lines, `     - ${treatment}`))
      }
      if (record.controls.length) {
        appendLine(lines, '   管理策リンク:')
        record.controls.forEach(control => appendLine(lines, `     - ${control}`))
      }
    })
  }

  const header = '%PDF-1.4\n'
  const contentLines = ['BT', '/F1 11 Tf', '14 TL', '1 0 0 1 50 760 Tm']

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

  const appendObject = (block: string) => {
    positions.push(pdf.length)
    pdf += block + '\n'
  }

  appendObject('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
  appendObject('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj')
  appendObject(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj'
  )
  appendObject(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`)
  appendObject('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj')

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

export function buildRiskReportFileName(organizationName: string) {
  const base = (organizationName || 'risk-report')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'risk-report'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${base}-risks-${date}`
}
