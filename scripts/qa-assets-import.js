#!/usr/bin/env node
/**
 * 情報資産 CSV エクスポート/インポート round-trip QA スクリプト
 *
 * 手順:
 * 1. エクスポート API で現在の資産を CSV 取得
 * 2. CSV の一行を編集（description を変更）
 * 3. upsert モードでインポート
 * 4. 変更が反映されているか確認
 */

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)
const PROTOCOL = process.env.QA_PROTOCOL || 'http'
const BASE_URL = `${PROTOCOL}://${HOST}:${PORT}`
const QA_ROLE = process.env.QA_ASSETS_ROLE || 'org_admin'

const httpModule = PROTOCOL === 'https' ? https : http
const RESULTS_DIR = path.join(__dirname, '..', 'test-results')
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
const resultPath = path.join(RESULTS_DIR, `assets-csv-roundtrip-${timestamp}.json`)

function writeResult(summary) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  fs.writeFileSync(resultPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    ...summary
  }, null, 2))
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const data = Buffer.concat(chunks)
        resolve({ status: res.statusCode, headers: res.headers, body: data })
      })
    })
    req.on('error', reject)
    if (body) {
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        req.write(body)
      } else {
        req.write(JSON.stringify(body))
      }
    }
    req.end()
  })
}

async function devLogin(role = 'system_operator') {
  console.log(`[DevLogin] Logging in as ${role}...`)
  const res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/dev/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { role }
  )
  if (res.status !== 200) {
    throw new Error(`DevLogin failed with status ${res.status}`)
  }
  const setCookie = res.headers['set-cookie'] || []
  const cookies = setCookie.map((c) => c.split(';')[0]).join('; ')
  console.log(`[DevLogin] OK`)
  return cookies
}

async function getProfile(cookies) {
  const res = await request({
    hostname: HOST,
    port: PORT,
    path: '/api/auth/profile',
    method: 'GET',
    headers: { Cookie: cookies }
  })
  if (res.status !== 200) {
    throw new Error(`Profile fetch failed with status ${res.status}`)
  }
  const payload = JSON.parse(res.body.toString())
  if (!payload.profile) {
    throw new Error('Profile response did not include profile')
  }
  return payload.profile
}

async function exportAssets(cookies, organizationId) {
  console.log('[Export] Fetching assets CSV...')
  const res = await request({
    hostname: HOST,
    port: PORT,
    path: `/api/information-assets/export?organizationId=${organizationId}`,
    method: 'GET',
    headers: { Cookie: cookies }
  })
  if (res.status !== 200) {
    throw new Error(`Export failed with status ${res.status}`)
  }
  console.log('[Export] OK')
  return res.body.toString('utf-8')
}

async function createAsset(cookies, organizationId, userId) {
  const name = `QA CSV Roundtrip Asset ${Date.now()}`
  console.log(`[Setup] Creating temporary asset: ${name}`)
  const res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/information-assets',
      method: 'POST',
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json'
      }
    },
    {
      asset: {
        organization_id: organizationId,
        name,
        asset_type: 'data',
        classification: 'internal',
        criticality: 'medium',
        owner_id: userId,
        location: 'QA workspace',
        status: 'in_use',
        description: 'Temporary asset for CSV round-trip QA'
      }
    }
  )

  if (res.status !== 201) {
    throw new Error(`Temporary asset creation failed with status ${res.status}: ${res.body.toString()}`)
  }

  const asset = JSON.parse(res.body.toString())
  console.log(`[Setup] OK asset_id=${asset.id}`)
  return asset
}

async function deleteAsset(cookies, assetId) {
  console.log(`[Cleanup] Deleting temporary asset: ${assetId}`)
  const res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: `/api/information-assets?id=${encodeURIComponent(assetId)}`,
      method: 'DELETE',
      headers: { Cookie: cookies }
    }
  )

  if (res.status !== 200 && res.status !== 404) {
    throw new Error(`Temporary asset deletion failed with status ${res.status}: ${res.body.toString()}`)
  }

  console.log('[Cleanup] Temporary asset deleted')
  return true
}

function parseCsv(csv) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) {
    return { headers: [], rows: [] }
  }
  const headers = lines[0].replace(/^\uFEFF/, '').split(',')
  const rows = lines.slice(1).map((line) => {
    const values = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current)
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || ''
    })
    return obj
  })
  return { headers, rows }
}

function buildCsv(headers, rows) {
  const escapeValue = (val) => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }
  const lines = [headers.join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((h) => escapeValue(row[h])).join(','))
  })
  return `\uFEFF${lines.join('\n')}`
}

async function importAssets(cookies, organizationId, userId, csvBuffer, mode = 'upsert') {
  console.log(`[Import] Uploading CSV with mode=${mode}...`)

  const boundary = `----FormBoundary${Date.now()}`
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="organizationId"\r\n\r\n${organizationId}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="userId"\r\n\r\n${userId}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\n${mode}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n`
  ]
  const head = Buffer.from(parts.join('\r\n') + '\r\n', 'utf-8')
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
  const body = Buffer.concat([head, Buffer.from(csvBuffer, 'utf-8'), tail])

  const res = await request(
    {
      hostname: HOST,
      port: PORT,
      path: '/api/information-assets/import',
      method: 'POST',
      headers: {
        Cookie: cookies,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    },
    body
  )
  const result = JSON.parse(res.body.toString())
  console.log('[Import] Result:', result)
  return { status: res.status, result }
}

async function main() {
  console.log('========================================')
  console.log('情報資産 CSV round-trip QA')
  console.log(`対象サーバー: ${BASE_URL}`)
  console.log('========================================\n')

  try {
    // 1. DevLogin して Cookie 取得
    const cookies = await devLogin(QA_ROLE)

    // 2. プロフィール取得
    const profile = await getProfile(cookies)
    if (!profile.organization_id) {
      throw new Error('Organization not found in profile')
    }
    console.log(`[Profile] organization_id=${profile.organization_id}, user_id=${profile.id}\n`)

    // 3. 既存資産をエクスポート
    let temporaryAssetId = null
    let csvString = await exportAssets(cookies, profile.organization_id)
    let { headers, rows } = parseCsv(csvString)
    console.log(`[Export] ${rows.length} assets found\n`)

    if (rows.length === 0) {
      const temporaryAsset = await createAsset(cookies, profile.organization_id, profile.id)
      temporaryAssetId = temporaryAsset.id
      csvString = await exportAssets(cookies, profile.organization_id)
      ;({ headers, rows } = parseCsv(csvString))
      console.log(`[Export] ${rows.length} assets found after setup\n`)
    } else if (rows[0].name?.startsWith('QA CSV Roundtrip Asset ')) {
      temporaryAssetId = rows[0].id
      console.log(`[Setup] Reusing existing temporary QA asset and marking it for cleanup: ${temporaryAssetId}\n`)
    }

    // 4. 1件目の資産の description を変更
    const originalDesc = rows[0].description || ''
    const timestamp = new Date().toISOString()
    const newDesc = `[QA Test ${timestamp}] ${originalDesc}`.slice(0, 200)
    rows[0].description = newDesc
    console.log(`[Modify] Changing description of "${rows[0].name}" to: ${newDesc}\n`)

    // 5. upsert モードでインポート
    const modifiedCsv = buildCsv(headers, rows)
    const importResult = await importAssets(cookies, profile.organization_id, profile.id, modifiedCsv, 'upsert')

    if (importResult.status !== 200) {
      throw new Error(`Import failed with status ${importResult.status}`)
    }

    if (importResult.result.errorCount > 0) {
      console.log('⚠️ インポートでエラーが発生しました:')
      console.log(JSON.stringify(importResult.result.errors, null, 2))
    }

    // 6. 再エクスポートして変更が反映されているか確認
    const verifyCSV = await exportAssets(cookies, profile.organization_id)
    const { rows: verifyRows } = parseCsv(verifyCSV)
    const updated = verifyRows.find((r) => r.id === rows[0].id)

    if (!updated) {
      throw new Error(`Asset ${rows[0].id} not found after import`)
    }

    if (updated.description !== newDesc) {
      throw new Error(`Description mismatch: expected "${newDesc}", got "${updated.description}"`)
    }

    console.log('\n✅ round-trip テスト成功！')
    console.log(`  - 更新された資産: ${updated.name}`)
    console.log(`  - 新しい description: ${updated.description}`)

    // 7. 元に戻す
    console.log('\n[Cleanup] Restoring original description...')
    rows[0].description = originalDesc
    const restoreCsv = buildCsv(headers, rows)
    const restoreResult = await importAssets(cookies, profile.organization_id, profile.id, restoreCsv, 'upsert')
    console.log('[Cleanup] OK\n')

    const temporaryAssetDeleted = temporaryAssetId ? await deleteAsset(cookies, temporaryAssetId) : null

    writeResult({
      status: 'passed',
      organizationId: profile.organization_id,
      userId: profile.id,
      exportedRows: rows.length,
      createdTemporaryAsset: Boolean(temporaryAssetId),
      temporaryAssetDeleted,
      updatedAssetId: updated.id,
      updatedAssetName: updated.name,
      importJobId: importResult.result.jobId,
      importSuccessCount: importResult.result.successCount,
      importErrorCount: importResult.result.errorCount,
      restoreJobId: restoreResult.result.jobId,
      restoredDescription: originalDesc
    })

    console.log('========================================')
    console.log('🎉 情報資産 CSV round-trip QA が成功しました')
    console.log(`証跡: ${path.relative(path.join(__dirname, '..'), resultPath)}`)
    console.log('========================================')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ QA 失敗:', error.message)
    writeResult({
      status: 'failed',
      error: error.message
    })
    console.error(`証跡: ${path.relative(path.join(__dirname, '..'), resultPath)}`)
    process.exit(1)
  }
}

main()
