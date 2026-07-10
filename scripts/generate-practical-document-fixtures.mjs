#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = process.argv[2]
if (!sourceRoot || !fs.existsSync(sourceRoot)) {
  throw new Error('Usage: node scripts/generate-practical-document-fixtures.mjs <seed-document-root>')
}

const manifestPath = path.join(process.cwd(), 'lib', 'fixtures', 'practical-document-bodies.json')
const publicRoot = path.join(process.cwd(), 'public', 'demo-documents')
const files = []

function collectMarkdownFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectMarkdownFiles(fullPath)
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath)
  }
}

collectMarkdownFiles(path.resolve(sourceRoot))
files.sort()

const fixtures = Object.fromEntries(files.map(filePath => {
  const documentId = path.basename(filePath, '.md')
  const body = fs.readFileSync(filePath, 'utf8')
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || documentId
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-').trim() || documentId
  return [documentId, {
    fileName: `${safeTitle}.md`,
    virtualPath: `demo-seed/${documentId}.md`,
    mimeType: 'text/markdown;charset=utf-8',
    size: Buffer.byteLength(body, 'utf8'),
    body
  }]
}))

fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
fs.mkdirSync(publicRoot, { recursive: true })
fs.writeFileSync(manifestPath, `${JSON.stringify(fixtures, null, 2)}\n`)

for (const [documentId, fixture] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(publicRoot, `${documentId}.md`), fixture.body)
}

console.log(`Generated ${files.length} practical document fixtures.`)
