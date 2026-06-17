import JSZip from 'jszip'

export function sanitizeDocumentFileName(value: string, fallback = 'document') {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]+/g, '-')
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

function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function createPdfExport(lines: string[]) {
  const sanitizedLines = lines.map(line => escapePdfText(line))
  const streamCommands: string[] = ['BT', '/F1 12 Tf', '12 TL', '1 0 0 1 50 760 Tm']
  sanitizedLines.forEach((line, index) => {
    if (index === 0) {
      streamCommands.push(`(${line || ' '}) Tj`)
    } else {
      streamCommands.push('T*')
      streamCommands.push(`(${line || ' '}) Tj`)
    }
  })
  streamCommands.push('ET')
  const streamContent = streamCommands.join('\n')
  const streamBuffer = Buffer.from(streamContent, 'utf8')

  const header = '%PDF-1.4\n'
  const offsets: number[] = [0]
  let buffer = header

  const pushObject = (obj: string) => {
    offsets.push(buffer.length)
    buffer += obj + '\n'
  }

  pushObject('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
  pushObject('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj')
  pushObject(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj'
  )
  pushObject(`4 0 obj\n<< /Length ${streamBuffer.length} >>\nstream\n${streamContent}\nendstream\nendobj`)
  pushObject('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj')

  const xrefStart = buffer.length
  let xref = 'xref\n'
  xref += `0 ${offsets.length}\n`
  xref += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`
  }

  buffer += xref
  buffer += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return Buffer.from(buffer, 'utf8')
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildDocxParagraphs(lines: string[]) {
  return lines
    .map(line => {
      if (line === '') {
        return '<w:p/>'
      }
      return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    })
    .join('\n')
}

export async function createDocxExport(lines: string[]) {
  const zip = new JSZip()
  const paragraphs = buildDocxParagraphs(lines)
  const now = new Date().toISOString()

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n  <w:body>\n    ${paragraphs}\n    <w:sectPr>\n      <w:pgSz w:w="12240" w:h="15840"/>\n      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>\n    </w:sectPr>\n  </w:body>\n</w:document>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>\n  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>\n</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>\n  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>\n</Relationships>`

  const documentRels = `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`

  const coreXml = `<?xml version="1.0" encoding="UTF-8"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <dc:title>Document Export</dc:title>\n  <dc:creator>ISMS Manager</dc:creator>\n  <cp:lastModifiedBy>ISMS Manager</cp:lastModifiedBy>\n  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>\n  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>\n  <cp:revision>1</cp:revision>\n</cp:coreProperties>`

  const appXml = `<?xml version="1.0" encoding="UTF-8"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">\n  <Application>ISMS Manager</Application>\n  <DocSecurity>0</DocSecurity>\n  <ScaleCrop>false</ScaleCrop>\n  <HeadingPairs>\n    <vt:vector size="2" baseType="variant">\n      <vt:variant>\n        <vt:lpstr>Strings</vt:lpstr>\n      </vt:variant>\n      <vt:variant>\n        <vt:i4>2</vt:i4>\n      </vt:variant>\n    </vt:vector>\n  </HeadingPairs>\n  <TitlesOfParts>\n    <vt:vector size="1" baseType="lpstr">\n      <vt:lpstr>Document Export</vt:lpstr>\n    </vt:vector>\n  </TitlesOfParts>\n  <Company>ISMS Manager</Company>\n  <LinksUpToDate>false</LinksUpToDate>\n  <SharedDoc>false</SharedDoc>\n</Properties>`

  zip.file('[Content_Types].xml', contentTypes)
  zip.folder('_rels')?.file('.rels', rootRels)

  const wordFolder = zip.folder('word')
  wordFolder?.file('document.xml', documentXml)
  wordFolder?.folder('_rels')?.file('document.xml.rels', documentRels)

  const docPropsFolder = zip.folder('docProps')
  docPropsFolder?.file('core.xml', coreXml)
  docPropsFolder?.file('app.xml', appXml)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export function createExcelExport(lines: string[]) {
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
