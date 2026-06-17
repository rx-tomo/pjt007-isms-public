type CsvValue = string | number | boolean | null | undefined

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)
  if (stringValue.includes(',') || stringValue.includes('\"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const headerLine = headers.map(header => escapeCsvValue(header)).join(',')
  const dataLines = rows.map(row => row.map(value => escapeCsvValue(value)).join(','))
  return [headerLine, ...dataLines].join('\n')
}
