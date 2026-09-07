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

const requiredPublicFiles = ['LICENSE', 'SECURITY.md', 'CONTRIBUTING.md']
const publicDocRoots = ['docs/01-business', 'docs/06-operations']
const excludedPublicPaths = [
  'docs/01-business/spec-dsl',
  'docs/01-business/pr-faq-workshop/pr-faq-internal.md',
  'docs/01-business/pr-faq-workshop/backlog.md',
  'docs/01-business/pr-faq-workshop/unknowns.md',
  'docs/01-business/pr-faq-workshop/role-actor-usability-review-2026-06-09.md',
  'docs/01-business/business-requirements-open-questions.md',
  'docs/01-business/requirements.md',
  'docs/01-business/pr-faq-workshop/riscala-ai-2.0.md',
  'config/projects_v2.toml',
  'docs/README.md',
  'scripts/projects_v2',
]
const forbiddenPublicReferences = [
  /(?:^|[\\/])riscala-ai-2\.0(?:\.md)?/i,
  /pr-faq-internal\.md/i,
  /(?:^|[\\/])docs\/02-project(?:[\\/]|$)/i,
  /(?:^|[\\/])docs\/(?:03-architecture|04-development|05-quality|07-design-system|10-improvement-plan)(?:[\\/]|$)/i,
  /(?:^|[\\/])docs\/(?:handoff|archive)(?:[\\/]|$)/i,
  /(?:^|[\\/])config\/projects_v2\.toml(?:$|[`)'"\s])/i,
  /(?:^|[\\/])scripts\/projects_v2(?:[\\/]|$)/i,
  /target[_ -]?only/i,
]

function isExcluded(relativePath) {
  const normalized = relativePath.split(path.sep).join('/')
  return excludedPublicPaths.some((excluded) => normalized === excluded || normalized.startsWith(`${excluded}/`))
}

function publicMarkdownFiles() {
  return publicDocRoots.flatMap((root) =>
    walkMarkdown(root).filter((file) => !isExcluded(file)),
  )
}

function scanPublicBoundary() {
  for (const file of requiredPublicFiles) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      findings.push({ file, line: 1, column: 1, term: 'required public file missing', reason: 'public snapshot baseline' })
    }
  }

  const docs = publicMarkdownFiles()
  for (const relativePath of docs) {
    const absolutePath = path.join(repoRoot, relativePath)
    const content = fs.readFileSync(absolutePath, 'utf8')

    for (const forbidden of forbiddenPublicReferences) {
      const match = forbidden.exec(content)
      if (match) {
        const location = lineAndColumn(content, match.index)
        findings.push({ file: relativePath, line: location.line, column: location.column, term: match[0], reason: 'internal or target-only reference' })
      }
    }

    const markdownLinks = /\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g
    let link
    while ((link = markdownLinks.exec(content)) !== null) {
      const target = link[1]
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue
      const targetPath = target.split('#', 1)[0].split('?', 1)[0]
      if (!targetPath) continue
      const resolved = path.normalize(path.join(path.dirname(absolutePath), targetPath))
      if (!resolved.startsWith(`${repoRoot}${path.sep}`) || !fs.existsSync(resolved)) {
        const location = lineAndColumn(content, link.index)
        findings.push({ file: relativePath, line: location.line, column: location.column, term: target, reason: 'public relative Markdown link target missing' })
      }
    }
  }
}

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

function walkMarkdown(dir) {
  const absoluteDir = path.join(repoRoot, dir)
  if (!fs.existsSync(absoluteDir)) return []

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      files.push(...walkMarkdown(relative))
    } else if (path.extname(entry.name) === '.md') {
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
  scanPublicBoundary()

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
