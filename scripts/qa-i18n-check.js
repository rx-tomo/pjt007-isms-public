#!/usr/bin/env node
// Simple i18n consistency checker for messages/ja.json vs messages/en.json
// Reports: missing keys in en, missing keys in ja, and keys whose values still look like raw i18n keys (e.g., contain a dot and no spaces)

const fs = require('fs')
const path = require('path')

const ja = JSON.parse(fs.readFileSync(path.join('messages', 'ja.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join('messages', 'en.json'), 'utf8'))

function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else {
      out[key] = v
    }
  }
  return out
}

const jaFlat = flatten(ja)
const enFlat = flatten(en)

const missingInEn = Object.keys(jaFlat).filter(k => !(k in enFlat))
const missingInJa = Object.keys(enFlat).filter(k => !(k in jaFlat))

function looksLikeKey(val) {
  if (typeof val !== 'string') return false
  // i18nキー形状（例: incidents.form.saving）のみ検出する。
  // 旧ヒューリスティック（ドット含む・空白なし）は省略記号「登録中...」「Saving...」や
  // 版数「v2.1」を誤検知していた（GAP-007）。各セグメントが英小文字始まりの識別子で
  // ドット区切りが2セグメント以上の場合のみキーとみなす。
  return val.length < 80 && /^[a-z][a-zA-Z0-9_-]*(\.[a-z][a-zA-Z0-9_-]*)+$/.test(val)
}

const keyLikeJa = Object.entries(jaFlat).filter(([, v]) => looksLikeKey(v)).map(([k]) => k)
const keyLikeEn = Object.entries(enFlat).filter(([, v]) => looksLikeKey(v)).map(([k]) => k)

function report(label, items) {
  if (!items.length) {
    console.log(`✅ ${label}: none`)
  } else {
    console.log(`❌ ${label}: ${items.length}`)
    items.slice(0, 50).forEach(k => console.log('  -', k))
    if (items.length > 50) console.log(`  ...and ${items.length - 50} more`)
  }
}

console.log('messages/ja.json vs en.json consistency check')
report('Missing in en', missingInEn)
report('Missing in ja', missingInJa)
report('Values that look like raw keys (ja)', keyLikeJa)
report('Values that look like raw keys (en)', keyLikeEn)

if (missingInEn.length || missingInJa.length || keyLikeJa.length || keyLikeEn.length) {
  process.exitCode = 1
}
