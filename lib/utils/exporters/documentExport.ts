import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import puppeteer, { type Browser } from 'puppeteer'

export type DocumentExportMetadata = {
  organization: string
  version: number
  exportedAt: string
  status?: string | null
  category?: string | null
  folder?: string | null
  createdAt?: string | null
  createdBy?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
  approvedBy?: string | null
  tags?: string[]
}

export type DocumentExportHistoryItem = {
  label: string
  detail?: string | null
}

export type DocumentExportModel = {
  title: string
  description?: string | null
  bodyMarkdown?: string | null
  metadata: DocumentExportMetadata
  approvals?: DocumentExportHistoryItem[]
  versions?: DocumentExportHistoryItem[]
}

export class PdfExportUnavailableError extends Error {
  readonly code = 'PDF_EXPORT_UNAVAILABLE'

  constructor(options?: ErrorOptions) {
    super('PDF rendering is unavailable in this environment')
    this.name = 'PdfExportUnavailableError'
    if (options?.cause) this.cause = options.cause
  }
}

type PdfExportOptions = {
  resolveExecutablePath?: () => Promise<string | null>
  launchBrowser?: typeof puppeteer.launch
}

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; rows: string[][] }

const DOCX_PAGE_WIDTH_DXA = 12240
const DOCX_PAGE_HEIGHT_DXA = 15840
const DOCX_MARGIN_DXA = 1440
const DOCX_CONTENT_WIDTH_DXA = 9360
const DOCX_TABLE_INDENT_DXA = 120
const DOCX_AVAILABLE_TABLE_WIDTH_DXA = DOCX_CONTENT_WIDTH_DXA - DOCX_TABLE_INDENT_DXA
const PDF_FONT_STACK = '"Arial Unicode MS", "Arial Unicode", "Yu Gothic", "Noto Sans JP", "Hiragino Sans", Arial, sans-serif'
const MACOS_GOOGLE_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PDF_RENDER_TIMEOUT_MS = 30_000
const PDF_MAX_CONCURRENT_RENDERS = 1
let activePdfRenders = 0

export function sanitizeDocumentFileName(value: string, fallback = 'document') {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || fallback
  )
}

export function formatDocumentDate(value: string) {
  try {
    return new Date(value).toISOString().split('T')[0]
  } catch (error) {
    return value
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeHtml(value: string) {
  return escapeXml(value)
}

function normalizeLines(input: string[] | DocumentExportModel) {
  if (Array.isArray(input)) {
    return input
  }

  return flattenModelToLines(input)
}

function modelFromInput(input: string[] | DocumentExportModel): DocumentExportModel {
  if (!Array.isArray(input)) {
    return input
  }

  const [title, ...body] = input
  return {
    title: title || 'Document Export',
    description: '文書管理から出力された参照用文書です。',
    bodyMarkdown: body.join('\n'),
    metadata: {
      organization: 'Riscala AI for ISMS',
      version: 1,
      exportedAt: new Date().toISOString(),
      status: 'exported'
    }
  }
}

function flattenModelToLines(model: DocumentExportModel) {
  const lines = [
    `Organization: ${model.metadata.organization}`,
    `Document Version: v${model.metadata.version}`,
    `Exported At: ${model.metadata.exportedAt}`,
    '',
    `Title: ${model.title}`,
    `Status: ${model.metadata.status ?? 'unknown'}`
  ]

  if (model.metadata.category) lines.push(`Category: ${model.metadata.category}`)
  if (model.metadata.folder) lines.push(`Folder: ${model.metadata.folder}`)
  if (model.metadata.createdAt) lines.push(`Created At: ${model.metadata.createdAt}`)
  if (model.metadata.createdBy) lines.push(`Created By: ${model.metadata.createdBy}`)
  if (model.metadata.updatedAt) {
    lines.push(`Last Updated: ${model.metadata.updatedAt}${model.metadata.updatedBy ? ` by ${model.metadata.updatedBy}` : ''}`)
  }
  if (model.metadata.approvedBy) lines.push(`Approved By: ${model.metadata.approvedBy}`)
  if (model.metadata.tags && model.metadata.tags.length > 0) lines.push(`Tags: ${model.metadata.tags.join(', ')}`)

  lines.push('', 'Description:', model.description?.trim() || '(No description)')

  const body = model.bodyMarkdown?.trim()
  if (body) {
    lines.push('', 'Document Body:', ...body.split(/\r?\n/))
  }

  if (model.approvals && model.approvals.length > 0) {
    lines.push('', 'Approval Flow:')
    model.approvals.forEach(item => lines.push(`${item.label}${item.detail ? ` - ${item.detail}` : ''}`))
  }

  if (model.versions && model.versions.length > 0) {
    lines.push('', 'Version History:')
    model.versions.forEach(item => lines.push(`${item.label}${item.detail ? ` - ${item.detail}` : ''}`))
  }

  return lines
}

function parseMarkdown(markdown: string) {
  const blocks: MarkdownBlock[] = []
  const lines = markdown.split(/\r?\n/)
  let paragraph: string[] = []
  let listType: 'bullet' | 'numbered' | null = null
  let listItems: string[] = []
  let tableRows: string[][] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
      paragraph = []
    }
  }

  const flushList = () => {
    if (listType && listItems.length > 0) {
      blocks.push({ type: listType, items: listItems })
    }
    listType = null
    listItems = []
  }

  const flushTable = () => {
    if (tableRows.length > 0) {
      const usefulRows = tableRows.filter(row => !row.every(cell => /^-+$/.test(cell.trim())))
      if (usefulRows.length > 0) blocks.push({ type: 'table', rows: usefulRows })
    }
    tableRows = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      flushTable()
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      flushTable()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      continue
    }

    if (/^\|.+\|$/.test(line)) {
      flushParagraph()
      flushList()
      tableRows.push(line.split('|').slice(1, -1).map(cell => cell.trim()))
      continue
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (bullet) {
      flushParagraph()
      flushTable()
      if (listType !== 'bullet') flushList()
      listType = 'bullet'
      listItems.push(bullet[1].trim())
      continue
    }

    const numbered = /^\d+\.\s+(.+)$/.exec(line)
    if (numbered) {
      flushParagraph()
      flushTable()
      if (listType !== 'numbered') flushList()
      listType = 'numbered'
      listItems.push(numbered[1].trim())
      continue
    }

    flushList()
    flushTable()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  flushTable()

  return blocks
}

function metadataRows(model: DocumentExportModel) {
  const rows = [
    ['組織', model.metadata.organization],
    ['文書版', `v${model.metadata.version}`],
    ['出力日時', model.metadata.exportedAt],
    ['状態', model.metadata.status ?? 'unknown']
  ]

  if (model.metadata.category) rows.push(['カテゴリ', model.metadata.category])
  if (model.metadata.folder) rows.push(['フォルダ', model.metadata.folder])
  if (model.metadata.createdAt) rows.push(['作成日', model.metadata.createdAt])
  if (model.metadata.createdBy) rows.push(['作成者', model.metadata.createdBy])
  if (model.metadata.updatedAt) rows.push(['最終更新', model.metadata.updatedAt])
  if (model.metadata.updatedBy) rows.push(['更新者', model.metadata.updatedBy])
  if (model.metadata.approvedBy) rows.push(['承認者', model.metadata.approvedBy])
  if (model.metadata.tags?.length) rows.push(['タグ', model.metadata.tags.join(', ')])

  return rows
}

function summaryRows(model: DocumentExportModel) {
  return [
    ['文書ステータス', model.metadata.status ?? 'unknown'],
    ['適用範囲', model.metadata.folder || model.metadata.category || '全社ISMS運用'],
    ['管理責任者', model.metadata.updatedBy || model.metadata.createdBy || model.metadata.approvedBy || 'ISMS管理責任者'],
    ['次回見直し', '年次レビューまたは重要変更時に見直し']
  ]
}

function historyRows(items: DocumentExportHistoryItem[]) {
  return items.map(item => [item.label, item.detail ?? ''])
}

function blocksForModel(model: DocumentExportModel) {
  return parseMarkdown(model.bodyMarkdown?.trim() || model.description?.trim() || '本文未登録')
}

function htmlTable(rows: string[][], className = '') {
  const [header, ...body] = rows
  const headerHtml = header
    ? `<thead><tr>${header.map(cell => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
    : ''
  const bodyHtml = body.length
    ? `<tbody>${body.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
    : ''

  return `<table class="${className}">${headerHtml}${bodyHtml}</table>`
}

function renderMarkdownBlocksHtml(blocks: MarkdownBlock[]) {
  return blocks.map(block => {
    if (block.type === 'heading') {
      const level = Math.min(Math.max(block.level + 1, 2), 4)
      return `<h${level}>${escapeHtml(block.text)}</h${level}>`
    }
    if (block.type === 'paragraph') {
      return `<p>${escapeHtml(block.text)}</p>`
    }
    if (block.type === 'bullet') {
      return `<ul>${block.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    }
    if (block.type === 'numbered') {
      return `<ol>${block.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
    }
    return htmlTable(block.rows, 'content-table')
  }).join('\n')
}

export function renderDocumentExportHtml(input: string[] | DocumentExportModel) {
  const model = modelFromInput(input)
  const metadata = metadataRows(model)
  const summary = summaryRows(model)
  const approvals = model.approvals?.length ? historyRows(model.approvals) : []
  const versions = model.versions?.length ? historyRows(model.versions) : []
  const exportedDate = formatDocumentDate(model.metadata.exportedAt)

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(model.title)}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #172033;
      font-family: ${PDF_FONT_STACK};
      font-size: 10.5pt;
      line-height: 1.72;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .masthead {
      border-bottom: 3px solid #2563a7;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .kicker {
      color: #475569;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    h1 {
      margin: 4px 0 6px;
      color: #0f2742;
      font-size: 22pt;
      line-height: 1.25;
    }
    .subtitle {
      margin: 0;
      color: #475569;
      font-size: 10pt;
    }
    .status-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 16px 0 18px;
    }
    .status-card {
      border: 1px solid #d7dee8;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
      min-height: 52px;
    }
    .status-card dt {
      margin: 0 0 3px;
      color: #64748b;
      font-size: 7.8pt;
      font-weight: 700;
    }
    .status-card dd {
      margin: 0;
      color: #172033;
      font-size: 9.5pt;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    h2 {
      break-after: avoid;
      margin: 22px 0 8px;
      color: #2563a7;
      font-size: 15pt;
      line-height: 1.35;
      border-left: 4px solid #2563a7;
      padding-left: 10px;
    }
    h3 {
      break-after: avoid;
      margin: 16px 0 6px;
      color: #1f4d78;
      font-size: 12pt;
    }
    h4 {
      break-after: avoid;
      margin: 14px 0 5px;
      color: #334155;
      font-size: 10.5pt;
    }
    p {
      margin: 0 0 8px;
      orphans: 3;
      widows: 3;
    }
    ul, ol {
      margin: 0 0 10px 22px;
      padding: 0;
    }
    li {
      margin: 0 0 4px;
      padding-left: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px;
      break-inside: avoid;
      font-size: 9.3pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th {
      background: #eef4fb;
      color: #1f4d78;
      font-weight: 700;
      text-align: left;
    }
    tr:nth-child(even) td {
      background: #fbfdff;
    }
    .metadata-table th {
      width: 28%;
      background: #f2f4f7;
      color: #334155;
    }
    .metadata-table td {
      width: 72%;
    }
    .section {
      break-inside: avoid;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <section class="masthead">
    <div class="kicker">Riscala AI for ISMS - Document Export</div>
    <h1>${escapeHtml(model.title)}</h1>
    <p class="subtitle">${escapeHtml(model.metadata.organization)} / v${escapeHtml(String(model.metadata.version))} / ${escapeHtml(exportedDate)}</p>
  </section>

  <dl class="status-row">
    ${summary.map(([label, value]) => `<div class="status-card"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
  </dl>

  <section class="section">
    <h2>文書情報</h2>
    ${htmlTable([['項目', '内容'], ...metadata], 'metadata-table')}
  </section>

  <section>
    <h2>本文</h2>
    ${renderMarkdownBlocksHtml(blocksForModel(model))}
  </section>

  ${approvals.length ? `<section><h2>承認フロー</h2>${htmlTable([['ステップ', '詳細'], ...approvals], 'content-table')}</section>` : ''}
  ${versions.length ? `<section><h2>版履歴</h2>${htmlTable([['版', '変更内容'], ...versions], 'content-table')}</section>` : ''}
</body>
</html>`
}

function pdfHeaderTemplate(model: DocumentExportModel) {
  return `<div style="font-family:${PDF_FONT_STACK}; font-size:8px; color:#64748b; width:100%; padding:0 18mm; display:flex; justify-content:space-between;">
    <span>${escapeHtml(model.metadata.organization)}</span>
    <span>${escapeHtml(model.title)}</span>
  </div>`
}

function pdfFooterTemplate() {
  return `<div style="font-family:${PDF_FONT_STACK}; font-size:8px; color:#64748b; width:100%; padding:0 18mm; display:flex; justify-content:flex-end;">
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`
}

export async function createPdfExport(
  input: string[] | DocumentExportModel,
  options: PdfExportOptions = {}
) {
  const model = modelFromInput(input)
  const html = renderDocumentExportHtml(model)
  const executablePath = await (options.resolveExecutablePath ?? resolvePuppeteerExecutablePath)()
  if (!executablePath) {
    throw new PdfExportUnavailableError()
  }

  if (activePdfRenders >= PDF_MAX_CONCURRENT_RENDERS) {
    throw new PdfExportUnavailableError()
  }

  activePdfRenders += 1
  let userDataDir: string | null = null
  let browser: Browser | null = null
  try {
    userDataDir = await mkdtemp(path.join(tmpdir(), 'riscala-doc-export-chrome-'))
    browser = await (options.launchBrowser ?? puppeteer.launch)({
      headless: true,
      userDataDir,
      executablePath,
      timeout: 10_000,
      protocolTimeout: PDF_RENDER_TIMEOUT_MS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-crash-reporter',
        '--disable-breakpad',
        '--disable-crashpad',
        '--disable-features=Crashpad',
        '--font-render-hinting=none',
        `--user-data-dir=${userDataDir}`,
        `--crash-dumps-dir=${path.join(userDataDir, 'crashpad')}`,
        '--no-first-run',
        '--no-default-browser-check'
      ],
      env: {
        ...process.env,
        HOME: userDataDir,
        XDG_CONFIG_HOME: userDataDir,
        CHROME_CONFIG_HOME: userDataDir
      }
    })

    const page = await browser.newPage()
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: PDF_RENDER_TIMEOUT_MS })
      await page.evaluateHandle('document.fonts.ready')
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        tagged: false,
        margin: {
          top: '20mm',
          right: '18mm',
          bottom: '18mm',
          left: '18mm'
        },
        headerTemplate: pdfHeaderTemplate(model),
        footerTemplate: pdfFooterTemplate(),
        timeout: PDF_RENDER_TIMEOUT_MS
      })

      return Buffer.from(pdf)
    } finally {
      await page.close().catch(() => undefined)
    }
  } catch (error) {
    if (error instanceof PdfExportUnavailableError) throw error
    throw new PdfExportUnavailableError({ cause: error })
  } finally {
    await browser?.close().catch(() => undefined)
    if (userDataDir) {
      await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined)
    }
    activePdfRenders -= 1
  }
}

async function resolvePuppeteerExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return accessibleExecutablePath(process.env.PUPPETEER_EXECUTABLE_PATH)
  }

  if (process.platform === 'darwin') {
    return accessibleExecutablePath(MACOS_GOOGLE_CHROME_PATH)
  }

  try {
    return accessibleExecutablePath(puppeteer.executablePath())
  } catch {
    return null
  }
}

async function accessibleExecutablePath(candidate: string) {
  try {
    await access(candidate)
    return candidate
  } catch {
    return null
  }
}

function docxRun(text: string, options?: { bold?: boolean; size?: number; color?: string }) {
  const props = [
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/>',
    options?.bold ? '<w:b/>' : '',
    options?.size ? `<w:sz w:val="${options.size}"/>` : '',
    options?.color ? `<w:color w:val="${options.color}"/>` : ''
  ].filter(Boolean).join('')

  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function paragraphProps(style?: string, options?: {
  before?: number
  after?: number
  line?: number
  keepNext?: boolean
  numId?: number
}) {
  const parts = [
    style ? `<w:pStyle w:val="${style}"/>` : '',
    options?.keepNext ? '<w:keepNext/>' : '',
    options?.numId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${options.numId}"/></w:numPr>` : '',
    `<w:spacing w:before="${options?.before ?? 0}" w:after="${options?.after ?? 120}" w:line="${options?.line ?? 264}" w:lineRule="auto"/>`
  ].filter(Boolean).join('')

  return `<w:pPr>${parts}</w:pPr>`
}

function docxParagraph(text: string, style?: string, options?: {
  bold?: boolean
  size?: number
  color?: string
  before?: number
  after?: number
  line?: number
  keepNext?: boolean
  numId?: number
}) {
  return `<w:p>${paragraphProps(style, options)}${docxRun(text, options)}</w:p>`
}

function docxTable(rows: string[][], options?: { columnWidths?: number[]; header?: boolean }) {
  const columnCount = Math.max(...rows.map(row => row.length), 1)
  const widths = options?.columnWidths?.length === columnCount
    ? options.columnWidths
    : Array.from({ length: columnCount }, () => Math.floor(DOCX_AVAILABLE_TABLE_WIDTH_DXA / columnCount))
  const tableRows = rows.map((row, rowIndex) => {
    const cells = widths.map((width, cellIndex) => {
      const cell = row[cellIndex] ?? ''
      const isHeader = (options?.header ?? true) && rowIndex === 0
      const shading = isHeader ? '<w:shd w:fill="F2F4F7"/>' : ''
      return `<w:tc>
        <w:tcPr>
          <w:tcW w:w="${width}" w:type="dxa"/>
          <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar>
          <w:vAlign w:val="center"/>
          ${shading}
        </w:tcPr>
        ${docxParagraph(cell, undefined, { bold: isHeader, color: isHeader ? '1F4D78' : undefined, after: 60, line: 260 })}
      </w:tc>`
    }).join('')
    const rowProps = rowIndex === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ''
    return `<w:tr>${rowProps}${cells}</w:tr>`
  }).join('')

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${DOCX_AVAILABLE_TABLE_WIDTH_DXA}" w:type="dxa"/>
      <w:tblInd w:w="${DOCX_TABLE_INDENT_DXA}" w:type="dxa"/>
      <w:tblLayout w:type="fixed"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>
    ${tableRows}
  </w:tbl>`
}

function buildDocxBody(input: string[] | DocumentExportModel) {
  if (Array.isArray(input)) {
    return input.map(line => line ? docxParagraph(line) : '<w:p/>').join('\n')
  }

  const parts: string[] = [
    docxParagraph('Riscala AI for ISMS - Document Export', 'Subtitle', { color: '64748B', after: 80, line: 260 }),
    docxParagraph(input.title, 'Title', { bold: true, size: 44, color: '0F2742', after: 80, line: 300 }),
    docxParagraph(`${input.metadata.organization} / v${input.metadata.version} / ${formatDocumentDate(input.metadata.exportedAt)}`, 'Subtitle', { color: '475569', after: 180, line: 260 }),
    docxTable(summaryRows(input), { columnWidths: [2100, 7120], header: false }),
    docxParagraph('文書情報', 'Heading1', { bold: true, color: '2E74B5', size: 32, before: 320, after: 160, keepNext: true }),
    docxTable([['項目', '内容'], ...metadataRows(input)], { columnWidths: [2100, 7120] }),
    docxParagraph('本文', 'Heading1', { bold: true, color: '2E74B5', size: 32, before: 320, after: 160, keepNext: true })
  ]

  for (const block of blocksForModel(input)) {
    if (block.type === 'heading') {
      parts.push(docxParagraph(block.text, block.level <= 2 ? 'Heading2' : 'Heading3', {
        bold: true,
        color: block.level <= 2 ? '2E74B5' : '1F4D78',
        size: block.level <= 2 ? 26 : 24,
        before: block.level <= 2 ? 240 : 160,
        after: block.level <= 2 ? 120 : 80,
        keepNext: true
      }))
    } else if (block.type === 'paragraph') {
      parts.push(docxParagraph(block.text))
    } else if (block.type === 'bullet') {
      block.items.forEach(item => parts.push(docxParagraph(item, 'ListParagraph', { numId: 1, after: 120, line: 280 })))
    } else if (block.type === 'numbered') {
      block.items.forEach(item => parts.push(docxParagraph(item, 'ListParagraph', { numId: 2, after: 120, line: 280 })))
    } else {
      parts.push(docxTable(block.rows))
    }
  }

  if (input.approvals && input.approvals.length > 0) {
    parts.push(docxParagraph('承認フロー', 'Heading1', { bold: true, color: '2E74B5', size: 32, before: 320, after: 160, keepNext: true }))
    parts.push(docxTable([['ステップ', '詳細'], ...historyRows(input.approvals)], { columnWidths: [3000, 6220] }))
  }

  if (input.versions && input.versions.length > 0) {
    parts.push(docxParagraph('版履歴', 'Heading1', { bold: true, color: '2E74B5', size: 32, before: 320, after: 160, keepNext: true }))
    parts.push(docxTable([['版', '変更内容'], ...historyRows(input.versions)], { columnWidths: [2200, 7020] }))
  }

  return parts.join('\n')
}

export async function createDocxExport(input: string[] | DocumentExportModel) {
  const zip = new JSZip()
  const model = modelFromInput(input)
  const body = buildDocxBody(input)
  const now = new Date().toISOString()

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="120" w:line="264" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="22"/><w:color w:val="172033"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="0" w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="44"/><w:color w:val="0F2742"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:before="0" w:after="120" w:line="260" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="160" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="24"/><w:color w:val="1F4D78"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:pPr><w:spacing w:before="0" w:after="160" w:line="280" w:lineRule="auto"/><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="22"/><w:color w:val="172033"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:pPr><w:spacing w:before="80" w:after="80" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic" w:cs="Calibri"/><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr></w:style>
</w:styles>`

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic"/></w:rPr></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic"/></w:rPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId2"/>
      <w:footerReference w:type="default" r:id="rId3"/>
      <w:pgSz w:w="${DOCX_PAGE_WIDTH_DXA}" w:h="${DOCX_PAGE_HEIGHT_DXA}"/>
      <w:pgMar w:top="${DOCX_MARGIN_DXA}" w:right="${DOCX_MARGIN_DXA}" w:bottom="${DOCX_MARGIN_DXA}" w:left="${DOCX_MARGIN_DXA}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

  const documentRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>${paragraphProps(undefined, { after: 0, line: 240 })}${docxRun(`${model.metadata.organization} | ${model.title}`, { size: 16, color: '64748B' })}</w:p>
</w:hdr>`

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${docxRun('Page ', { size: 16, color: '64748B' })}<w:fldSimple w:instr="PAGE">${docxRun('1', { size: 16, color: '64748B' })}</w:fldSimple>${docxRun(' / ', { size: 16, color: '64748B' })}<w:fldSimple w:instr="NUMPAGES">${docxRun('1', { size: 16, color: '64748B' })}</w:fldSimple></w:p>
</w:ftr>`

  const coreXml = `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(model.title)}</dc:title>
  <dc:creator>Riscala AI for ISMS</dc:creator>
  <cp:lastModifiedBy>Riscala AI for ISMS</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
  <cp:revision>1</cp:revision>
</cp:coreProperties>`

  const appXml = `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Riscala AI for ISMS</Application>
  <Company>Riscala AI for ISMS</Company>
</Properties>`

  zip.file('[Content_Types].xml', contentTypes)
  zip.folder('_rels')?.file('.rels', rootRels)
  const wordFolder = zip.folder('word')
  wordFolder?.file('document.xml', documentXml)
  wordFolder?.file('styles.xml', stylesXml)
  wordFolder?.file('numbering.xml', numberingXml)
  wordFolder?.file('header1.xml', headerXml)
  wordFolder?.file('footer1.xml', footerXml)
  wordFolder?.folder('_rels')?.file('document.xml.rels', documentRels)
  const docPropsFolder = zip.folder('docProps')
  docPropsFolder?.file('core.xml', coreXml)
  docPropsFolder?.file('app.xml', appXml)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export function createExcelExport(input: string[] | DocumentExportModel) {
  const lines = normalizeLines(input)
  const rowXml = lines
    .map(line => `<Row><Cell><Data ss:Type="String">${escapeXml(line)}</Data></Cell></Row>`)
    .join('\n')

  const xml = `<?xml version="1.0"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n` +
    `<Worksheet ss:Name="Document Export">\n` +
    `<Table>${rowXml}</Table>\n` +
    `</Worksheet>\n` +
    `</Workbook>`

  return Buffer.from(xml, 'utf8')
}
