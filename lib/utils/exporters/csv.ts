type CsvValue = string | number | boolean | null | undefined

const SPREADSHEET_FORMULA_PREFIX = /^\s*[=+\-@\t\r\n]/u

function neutralizeSpreadsheetFormula(value: string): string {
  return SPREADSHEET_FORMULA_PREFIX.test(value) ? `'${value}` : value
}

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = typeof value === 'string'
    ? neutralizeSpreadsheetFormula(value)
    : String(value)
  if (
    stringValue.includes(',')
    || stringValue.includes('\"')
    || stringValue.includes('\n')
    || stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const headerLine = headers.map(header => escapeCsvValue(header)).join(',')
  const dataLines = rows.map(row => row.map(value => escapeCsvValue(value)).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export { neutralizeSpreadsheetFormula }
