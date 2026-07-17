export type ParsedCsvRow = Record<string, string>

export type CsvParseOptions = {
  strictColumnCount?: boolean
  strictQuoteSyntax?: boolean
  maxRows?: number
  maxColumns?: number
  maxTotalCells?: number
  maxCellLength?: number
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}

function parseCsvRecords(text: string, options: CsvParseOptions): string[][] {
  const records: string[][] = []
  let values: string[] = []
  let current = ''
  let inQuotes = false
  let quoteClosed = false
  let recordHasContent = false
  let totalCells = 0

  const markRecordContent = () => {
    if (recordHasContent) return
    if (options.maxRows !== undefined && records.length >= options.maxRows + 1) {
      throw new Error(`CSV exceeds maximum row count of ${options.maxRows}`)
    }
    recordHasContent = true
  }

  const decodeCell = () => {
    const value = stripBom(current)
    if (options.maxCellLength !== undefined && value.length > options.maxCellLength) {
      throw new Error(`CSV exceeds maximum cell length of ${options.maxCellLength}`)
    }
    return value.trim()
  }

  const finishCell = () => {
    if (options.maxColumns !== undefined && values.length >= options.maxColumns) {
      throw new Error(`CSV exceeds maximum column count of ${options.maxColumns}`)
    }
    if (options.maxTotalCells !== undefined && totalCells >= options.maxTotalCells) {
      throw new Error(`CSV exceeds maximum total cell count of ${options.maxTotalCells}`)
    }
    values.push(decodeCell())
    totalCells += 1
    current = ''
    quoteClosed = false
  }

  const ensureAnotherCellAllowed = () => {
    if (options.maxColumns !== undefined && values.length >= options.maxColumns) {
      throw new Error(`CSV exceeds maximum column count of ${options.maxColumns}`)
    }
    if (options.maxTotalCells !== undefined && totalCells >= options.maxTotalCells) {
      throw new Error(`CSV exceeds maximum total cell count of ${options.maxTotalCells}`)
    }
  }

  const finishRecord = () => {
    if (recordHasContent) {
      finishCell()
      records.push(values)
    } else if (options.maxCellLength !== undefined) {
      decodeCell()
    }
    values = []
    current = ''
    recordHasContent = false
    quoteClosed = false
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (options.strictQuoteSyntax && quoteClosed) {
      if (char === ',') {
        markRecordContent()
        finishCell()
        ensureAnotherCellAllowed()
        continue
      }
      if (char === '\r' || char === '\n') {
        finishRecord()
        if (char === '\r' && text[i + 1] === '\n') i += 1
        continue
      }
      throw new Error('CSV contains characters after a closing quote')
    }

    if (char === '"') {
      markRecordContent()
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (options.strictQuoteSyntax) {
        if (inQuotes) {
          inQuotes = false
          quoteClosed = true
        } else {
          const isBomPrefixedFirstCell = (
            records.length === 0
            && values.length === 0
            && current === '\uFEFF'
          )
          if (current.length > 0 && !isBomPrefixedFirstCell) {
            throw new Error('CSV quote must start at the beginning of a cell')
          }
          inQuotes = true
        }
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      markRecordContent()
      finishCell()
      ensureAnotherCellAllowed()
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      finishRecord()
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1
      }
    } else {
      if (char.trim().length > 0) {
        markRecordContent()
      }
      current += char
    }
  }

  if (inQuotes) {
    throw new Error('CSV contains an unclosed quoted cell')
  }

  finishRecord()
  return records
}

export function normalizeHeader(value: string): string {
  return stripBom(value).trim().toLowerCase()
}

export function parseCsvToObjects(
  content: ArrayBuffer | string,
  requiredHeaders: string[],
  options: CsvParseOptions = {}
): ParsedCsvRow[] {
  const text = typeof content === 'string'
    ? content
    : new TextDecoder('utf-8').decode(content)
  const records = parseCsvRecords(text, options)

  if (records.length === 0) {
    return []
  }

  const headers = records[0].map(normalizeHeader)
  const uniqueHeaders = new Set<string>()

  for (const header of headers) {
    if (uniqueHeaders.has(header)) {
      throw new Error(`CSV header contains duplicate normalized header "${header}"`)
    }
    uniqueHeaders.add(header)
  }

  for (const header of requiredHeaders) {
    if (!headers.includes(normalizeHeader(header))) {
      throw new Error(`CSV header must include "${header}"`)
    }
  }

  const rows: ParsedCsvRow[] = []

  for (let i = 1; i < records.length; i += 1) {
    const values = records[i]
    if (values.every(v => v.length === 0)) continue
    if (options.strictColumnCount && values.length !== headers.length) {
      throw new Error(
        `CSV row ${i + 1} has column count ${values.length}; expected ${headers.length}`
      )
    }
    if (options.maxRows !== undefined && rows.length >= options.maxRows) {
      throw new Error(`CSV exceeds maximum row count of ${options.maxRows}`)
    }
    const obj: ParsedCsvRow = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? ''
    })
    rows.push(obj)
  }

  return rows
}

/**
 * セミコロン or カンマ区切り文字列を配列へ変換。空文字は空配列。
 */
export function splitList(value: string | undefined | null): string[] {
  if (!value) return []
  return value
    .split(/[;,]/)
    .map(item => item.trim())
    .filter(Boolean)
}
