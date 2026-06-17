#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')

const textFiles = [
  'messages/ja.json',
  'messages/en.json',
  'messages/zh.json',
  'docs/01-business/pr-faq-workshop/pr-faq-public.md',
]

const sourceRoots = [
  'app',
  'components',
]

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])

const { bannedTerms } = require('./lib/banned-terms')

const findings = []

function walk(dir) {
  const absoluteDir = path.join(repoRoot, dir)
  if (!fs.existsSync(absoluteDir)) return []

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      files.push(...walk(relative))
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(relative)
    }
  }

  return files
}

function lineAndColumn(content, index) {
  const before = content.slice(0, index)
  const lines = before.split('\n')
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  }
}

function scanFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath)
  const content = fs.readFileSync(absolutePath, 'utf8')

  for (const banned of bannedTerms) {
    let index = content.indexOf(banned.term)
    while (index !== -1) {
      const location = lineAndColumn(content, index)
      findings.push({
        file: relativePath,
        line: location.line,
        column: location.column,
        term: banned.term,
        reason: banned.reason,
      })
      index = content.indexOf(banned.term, index + banned.term.length)
    }
  }
}

function main() {
  const files = [
    ...textFiles,
    ...sourceRoots.flatMap(walk),
  ]

  for (const file of files) {
    scanFile(file)
  }

  if (findings.length > 0) {
    console.error('Public copy boundary check failed.')
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line}:${finding.column} ${finding.term} (${finding.reason})`)
    }
    process.exit(1)
  }

  console.log(`Public copy boundary check passed. Scanned ${files.length} files.`)
}

main()
