const WORKBOOK_XML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  '<?mso-application progid="Excel.Sheet"?>\n' +
  '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">\n'

interface RiskExportRecord {
  id: string
  title: string
  status: string
  assessmentPeriod?: string | null
  category?: string | null
  score: number | null
  impact: number | null
  likelihood: number | null
  ownerName?: string | null
  ownerEmail?: string | null
  assets: string[]
  treatments: string[]
  controls: string[]
  identifiedDate?: string | null
  updatedAt?: string | null
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildCell(content: string, type: 'String' | 'Number' = 'String'): string {
  if (type === 'Number') {
    return `<Cell><Data ss:Type="Number">${content}</Data></Cell>`
  }

  return `<Cell><Data ss:Type="String">${escapeXml(content)}</Data></Cell>`
}

function buildRow(cells: string[]): string {
  return `<Row>${cells.join('')}</Row>`
}

export function buildRiskExcelXml(records: RiskExportRecord[]): string {
  const header = [
    'ID',
    'Title',
    'Status',
    'Assessment Period',
    'Category',
    'Score',
    'Impact',
    'Likelihood',
    'Owner',
    'Owner Email',
    'Linked Assets',
    'Treatments',
    'Controls',
    'Identified Date',
    'Last Updated'
  ]

  const rows = [buildRow(header.map(cell => buildCell(cell)))]

  records.forEach(record => {
    const ownerDisplay = record.ownerName || ''
    const scoreContent = record.score != null ? String(record.score) : ''
    const impactContent = record.impact != null ? String(record.impact) : ''
    const likelihoodContent = record.likelihood != null ? String(record.likelihood) : ''

    rows.push(
      buildRow([
        buildCell(record.id),
        buildCell(record.title),
        buildCell(record.status),
        buildCell(record.assessmentPeriod || ''),
        buildCell(record.category || ''),
        scoreContent ? buildCell(scoreContent, 'Number') : buildCell(''),
        impactContent ? buildCell(impactContent, 'Number') : buildCell(''),
        likelihoodContent ? buildCell(likelihoodContent, 'Number') : buildCell(''),
        buildCell(ownerDisplay),
        buildCell(record.ownerEmail || ''),
        buildCell(record.assets.join('\n')),
        buildCell(record.treatments.join('\n')),
        buildCell(record.controls.join('\n')),
        buildCell(record.identifiedDate || ''),
        buildCell(record.updatedAt || '')
      ])
    )
  })

  const worksheet =
    '<Worksheet ss:Name="Risks">\n' +
    '<Table>\n' +
    rows.join('\n') +
    '\n</Table>\n' +
    '</Worksheet>\n'

  return WORKBOOK_XML_HEADER + worksheet + '</Workbook>'
}

export function createRiskExcelBuffer(records: RiskExportRecord[]): Buffer {
  const xml = buildRiskExcelXml(records)
  return Buffer.from(xml, 'utf8')
}

export type { RiskExportRecord }
