#!/usr/bin/env node
// Build expected JSON fixture from a tenant sample ZIP/CSV set.
// Usage: node scripts/build-tenant-sample-fixture.js <input-zip-or-dir> <output-json>

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

function parseCsv(content) {
  const text = content.toString('utf8').trim()
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).filter(Boolean).map(line => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    return row
  })
}

// minimal CSV splitter (handles double quotes and escaped quotes)
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

async function loadFromZip(zipPath) {
  const buf = fs.readFileSync(zipPath)
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

async function loadFromDir(dirPath) {
  const data = {}
  for (const file of FILES) {
    const p = path.join(dirPath, file)
    if (!fs.existsSync(p)) continue
    const content = fs.readFileSync(p)
    data[file] = parseCsv(content)
  }
  return data
}

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    console.error('Usage: node scripts/build-tenant-sample-fixture.js <input-zip-or-dir> <output-json>')
    process.exit(1)
  }

  const absIn = path.resolve(input)
  const absOut = path.resolve(output)

  let data
  if (fs.existsSync(absIn) && fs.statSync(absIn).isFile()) {
    data = await loadFromZip(absIn)
  } else if (fs.existsSync(absIn) && fs.statSync(absIn).isDirectory()) {
    data = await loadFromDir(absIn)
  } else {
    console.error(`Input not found: ${absIn}`)
    process.exit(1)
  }

  fs.mkdirSync(path.dirname(absOut), { recursive: true })
  fs.writeFileSync(absOut, JSON.stringify(data, null, 2))
  console.log(`Wrote expected fixture to ${absOut}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
