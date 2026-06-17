import type { RiskWithRelations } from '@/lib/services/risk'

export interface AggregatedRiskRow {
  category: string
  status: string
  count: number
}

const OPEN_STATUSES = new Set(['identified', 'analyzing'])
const TREATING_STATUSES = new Set(['treating', 'monitoring'])

export function aggregateRisks(risks: RiskWithRelations[]): AggregatedRiskRow[] {
  const summary = new Map<string, number>()

  risks.forEach(risk => {
    const category = risk.category?.name ?? 'Uncategorized'
    const status = risk.status ?? 'unknown'
    const key = `${category}::${status}`
    summary.set(key, (summary.get(key) ?? 0) + 1)
  })

  return Array.from(summary.entries())
    .map(([key, count]) => {
      const [category, status] = key.split('::')
      return { category, status, count }
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.status.localeCompare(b.status))
}

export function summarizeRiskTotals(rows: AggregatedRiskRow[]) {
  const total = rows.reduce((acc, row) => acc + row.count, 0)
  const open = rows.filter(row => OPEN_STATUSES.has(row.status)).reduce((acc, row) => acc + row.count, 0)
  const treating = rows.filter(row => TREATING_STATUSES.has(row.status)).reduce((acc, row) => acc + row.count, 0)
  return { total, open, treating }
}

export function createRiskGapPdf(lines: string[]) {
  const header = '%PDF-1.4\n'
  const contentLines = ['BT', '/F1 12 Tf', '14 TL', '1 0 0 1 50 760 Tm']

  lines.forEach((line, index) => {
    const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') || ' '
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

  const append = (content: string) => {
    positions.push(pdf.length)
    pdf += content + '\n'
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

  return new Blob([pdf], { type: 'application/pdf' })
}

export function sanitizeRiskGapFileName(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'risk-gap-analysis'
  )
}
