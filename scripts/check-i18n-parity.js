#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const jaPath = path.join(process.cwd(), 'messages/ja.json')
const enPath = path.join(process.cwd(), 'messages/en.json')

const loadJson = filePath => {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

const flattenKeys = (value, prefix = '') => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key
      return flattenKeys(child, nextPrefix)
    })
  }

  return prefix ? [prefix] : []
}

const ja = loadJson(jaPath)
const en = loadJson(enPath)

const jaKeys = new Set(flattenKeys(ja))
const enKeys = new Set(flattenKeys(en))

// 既知の欠落キーを一時的に許容するallowlist。
// 現状はja/enのキーが完全一致しているため空。差分が発生した場合は
// 意図的な段階リリースなど正当な理由があるキーのみここに追加する。
const KNOWN_MISSING_JA = new Set([])

const KNOWN_MISSING_EN = new Set([])

const missingInJa = [...enKeys].filter(key => !jaKeys.has(key) && !KNOWN_MISSING_JA.has(key))
const missingInEn = [...jaKeys].filter(key => !enKeys.has(key) && !KNOWN_MISSING_EN.has(key))

const knownJaGaps = [...KNOWN_MISSING_JA].filter(key => !jaKeys.has(key))
const knownEnGaps = [...KNOWN_MISSING_EN].filter(key => !enKeys.has(key))

const report = () => {
  console.log('🧭 i18n parity check\n')
  if (knownJaGaps.length) {
    console.log('ℹ️  Known missing ja.json keys (tracked debt):')
    knownJaGaps.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }
  if (knownEnGaps.length) {
    console.log('ℹ️  Known missing en.json keys (tracked debt):')
    knownEnGaps.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }
  if (missingInJa.length === 0 && missingInEn.length === 0) {
    console.log('✅ en/ja message files contain the same key set (aside from the tracked debt above).')
    return true
  }

  if (missingInJa.length > 0) {
    console.log('❌ Keys missing in ja.json:')
    missingInJa.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }

  if (missingInEn.length > 0) {
    console.log('❌ Keys missing in en.json:')
    missingInEn.sort().forEach(key => console.log(`  - ${key}`))
    console.log('')
  }

  return false
}

const success = report()
process.exit(success ? 0 : 1)
