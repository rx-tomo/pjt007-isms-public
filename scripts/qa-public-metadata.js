#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const metadataPath = path.join(repoRoot, 'app/[locale]/metadata.ts')
const metadataSource = fs.readFileSync(metadataPath, 'utf8')

const requiredSnippets = [
  "const DEFAULT_SITE_URL = 'https://riscala-ai.com'",
  'metadataBase: new URL(siteUrl)',
  'url: canonicalUrl',
  'canonical: canonicalPath',
]

const forbiddenSnippets = [
  'riscala-isms.com',
]

const findings = []

for (const snippet of requiredSnippets) {
  if (!metadataSource.includes(snippet)) {
    findings.push(`missing required metadata snippet: ${snippet}`)
  }
}

for (const snippet of forbiddenSnippets) {
  if (metadataSource.includes(snippet)) {
    findings.push(`found stale metadata snippet: ${snippet}`)
  }
}

if (findings.length > 0) {
  console.error('Public metadata QA failed.')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Public metadata QA passed. Canonical metadata uses riscala-ai.com defaults.')
