import { TextDecoder } from 'util'

export type ParsedCsvRow = Record<string, string>

const decoder = new TextDecoder('utf-8')

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}

function splitCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }

  values.push(current)
  return values.map(v => v.trim())
}

export function normalizeHeader(value: string): string {
  return stripBom(value).trim().toLowerCase()
}

export function parseCsvToObjects(content: ArrayBuffer | string, requiredHeaders: string[]): ParsedCsvRow[] {
  const text = typeof content === 'string' ? content : decoder.decode(content)
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader)

  for (const header of requiredHeaders) {
    if (!headers.includes(normalizeHeader(header))) {
      throw new Error(`CSV header must include "${header}"`)
    }
  }

  const rows: ParsedCsvRow[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i])
    if (values.every(v => v.length === 0)) continue
    const obj: ParsedCsvRow = {}
    headers.forEach((header, index) => {
      obj[header] = values[index]?.replace(/^\uFEFF/, '').trim() ?? ''
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
