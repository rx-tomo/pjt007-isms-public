#!/usr/bin/env node
/**
 * Detects translation keys used in source code that are missing from messages/en.json or messages/ja.json.
 *
 * Scans for patterns like t('namespace.key') / t("namespace.key") / t(`namespace.key`).
 */
const fs = require('fs')
const path = require('path')

const SRC_DIRS = ['app', 'components', 'lib']
const enPath = path.join(process.cwd(), 'messages/en.json')
const jaPath = path.join(process.cwd(), 'messages/ja.json')

const loadJson = file => JSON.parse(fs.readFileSync(file, 'utf-8'))

const flattenKeys = (value, prefix = '') => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k))
  }
  return prefix ? [prefix] : []
}

const toKeySet = obj => new Set(flattenKeys(obj))

const collectFiles = dir => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(full)
    if (!entry.name.match(/\.(ts|tsx|js|jsx)$/)) return []
    return [full]
  })
}

const keyRegex = /t\(\s*["'`]([^"'`]+)["'`]/g

const KEY_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/
const ALLOWED_NAMESPACES = new Set([
  'common',
  'auth',
  'home',
  'audit',
  'devLogin',
  'settings',
  'notifications',
  'tasks',
  'documents',
  'risks',
  'superAdmin',
  'plans',
  'profile',
  'controls',
  'organization',
  'subscription',
  'assets',
  'roleDashboards',
  'reports',
  'requirements',
  'nonconformities'
])

const collectUsedKeys = files => {
  const keys = new Set()
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8')
    let m
    while ((m = keyRegex.exec(content)) !== null) {
        const candidate = m[1].trim()
        const root = candidate.split('.')[0]
        if (KEY_PATTERN.test(candidate) && ALLOWED_NAMESPACES.has(root)) {
          keys.add(candidate)
        }
    }
  })
  return keys
}

const en = toKeySet(loadJson(enPath))
const ja = toKeySet(loadJson(jaPath))
const sourceFiles = SRC_DIRS.flatMap(collectFiles)
const used = collectUsedKeys(sourceFiles)

const missingInEn = [...used].filter(k => !en.has(k))
const missingInJa = [...used].filter(k => !ja.has(k))

const report = (label, arr) => {
  if (!arr.length) {
    console.log(`✅ ${label}: none`)
  } else {
    console.log(`❌ ${label}:`)
    arr.sort().forEach(k => console.log(`  - ${k}`))
  }
}

console.log('🧭 i18n usage check (source → messages)')
report('Missing in en.json', missingInEn)
console.log('')
report('Missing in ja.json', missingInJa)

const exitCode = missingInEn.length || missingInJa.length ? 1 : 0
process.exit(exitCode)
