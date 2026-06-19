#!/usr/bin/env node
// Compare expected tenant fixture JSON with an exported ZIP (or JSON) from organization-data export.
// Usage: node scripts/compare-tenant-export.js <expected.json> <export.zip|json> [diff-output.json]

const fs = require('fs')
const path = require('path')
const JSZip = require('jszip')

const FILES = [
  'isms_scope.csv',
  'departments.csv',
  'project_roles.csv',
  'project_assignments.csv',
  'users.csv',
  'iso_controls.csv',
  'information_assets.csv'
]

const SORT_KEYS = {
  'isms_scope.csv': null,
  'departments.csv': ['name'],
  'project_roles.csv': ['key'],
  'project_assignments.csv': ['role_key', 'email'],
  'users.csv': ['email'],
  'iso_controls.csv': ['control_code', 'title'],
  'information_assets.csv': ['name']
}

function parseCsv(content) {
  const text = content.toString('utf8').trim()
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).filter(Boolean).map(line => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => {
      // 前後スペースを除去し、null を空文字に統一
      row[h] = (cols[i] ?? '').trim()
    })
    return row
  })
}

function splitCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

async function loadExport(inputPath) {
  const abs = path.resolve(inputPath)
  if (!fs.existsSync(abs)) {
    throw new Error(`export file not found: ${abs}`)
  }
  if (abs.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(abs, 'utf8'))
  }
  const buf = fs.readFileSync(abs)
  const zip = await JSZip.loadAsync(buf)
  const data = {}
  for (const file of FILES) {
    const entry = zip.file(file)
    if (!entry) continue
    const content = await entry.async('nodebuffer')
    data[file] = parseCsv(content)
  }
  return data
}

function diffRecords(expected, actual) {
  const diff = {}
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
  keys.forEach(key => {
    const expRows = normalizeRows(key, expected[key] || [])
    const actRows = normalizeRows(key, actual[key] || [])
    if (JSON.stringify(expRows) !== JSON.stringify(actRows)) {
      diff[key] = { expected: expRows, actual: actRows }
    }
  })
  return diff
}

function normalizeRows(file, rows) {
  const sortKeys = SORT_KEYS[file]
  if (!rows || rows.length === 0) return rows

  // スコープはセミコロン後のスペース差分を吸収するため分割→トリム→再結合
  if (file === 'isms_scope.csv') {
    rows = rows.map(r => {
      const norm = { ...r }
      const fields = ['physical_locations', 'it_systems', 'departments', 'processes', 'exclusions']
      fields.forEach(f => {
        norm[f] = (norm[f] || '')
          .split(';')
          .map(s => s.trim())
          .filter(Boolean)
          .join(';')
      })
      return norm
    })
  }

  const sorted = sortKeys
    ? [...rows].sort((a, b) => {
        for (const k of sortKeys) {
          const av = (a[k] ?? '').toString()
          const bv = (b[k] ?? '').toString()
          if (av === bv) continue
          return av.localeCompare(bv)
        }
        return 0
      })
    : rows
  return sorted
}

async function main() {
  const [expectedPath, exportPath, diffPath] = process.argv.slice(2)
  if (!expectedPath || !exportPath) {
    console.error('Usage: node scripts/compare-tenant-export.js <expected.json> <export.zip|json> [diff-output.json]')
    process.exit(1)
  }

  const expected = expectedPath.endsWith('.zip')
    ? await loadExport(expectedPath)
    : JSON.parse(fs.readFileSync(path.resolve(expectedPath), 'utf8'))
  const actual = await loadExport(exportPath)
  const diff = diffRecords(expected, actual)

  if (diffPath) {
    const absDiff = path.resolve(diffPath)
    fs.mkdirSync(path.dirname(absDiff), { recursive: true })
    fs.writeFileSync(absDiff, JSON.stringify(diff, null, 2))
    console.log(`Diff written to ${absDiff}`)
  }

  if (Object.keys(diff).length === 0) {
    console.log('✅ export matches expected fixture')
    return
  }

  console.error('❌ differences found:')
  for (const [key, value] of Object.entries(diff)) {
    console.error(`- ${key}: expected ${value.expected.length} rows, actual ${value.actual.length} rows`)
  }
  process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
