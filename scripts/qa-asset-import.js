#!/usr/bin/env node
/**
 * 情報資産 CSV 取込 QA スクリプト
 */

const http = require('http')
const fs = require('fs')
const path = require('path')

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)
const ORG_ID = process.env.QA_ORGANIZATION_ID
const USER_ID = process.env.QA_USER_ID
const RETRY_LIMIT = Number(process.env.QA_SERVER_RETRY_LIMIT || 20)
const RETRY_INTERVAL = Number(process.env.QA_SERVER_RETRY_INTERVAL_MS || 1000)

if (!ORG_ID || !USER_ID) {
  console.error('❌ QA_ORGANIZATION_ID と QA_USER_ID を環境変数で指定してください')
  process.exit(1)
}

function waitForServer() {
  return new Promise((resolve) => {
    let attempts = 0

    const tryConnect = () => {
      const req = http.request(
        {
          hostname: HOST,
          port: PORT,
          path: '/',
          method: 'HEAD',
          timeout: 1000
        },
        () => resolve(true)
      )

      req.on('error', () => {
        attempts += 1
        if (attempts >= RETRY_LIMIT) {
          resolve(false)
          return
        }
        setTimeout(tryConnect, RETRY_INTERVAL)
      })

      req.on('timeout', () => {
        req.destroy()
        attempts += 1
        if (attempts >= RETRY_LIMIT) {
          resolve(false)
          return
        }
        setTimeout(tryConnect, RETRY_INTERVAL)
      })

      req.end()
    }

    tryConnect()
  })
}

function buildCsvPayload() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = `QA Asset ${timestamp}`
  const rows = [
    `${base} A,software,internal,medium,in_use,,,,Application server imported via QA`,
    `${base} B,data,restricted,high,in_use,,,,Dataset imported via QA`
  ]
  const header = 'name,asset_type,classification,criticality,status,owner_name,owner_email,location,description'
  return `${header}\n${rows.join('\n')}`
}

async function runImport(csvContent) {
  const formData = new FormData()
  formData.set('file', new Blob([csvContent], { type: 'text/csv' }), `qa-assets-${Date.now()}.csv`)
  formData.set('organizationId', ORG_ID)
  formData.set('userId', USER_ID)

  const response = await fetch(`http://${HOST}:${PORT}/api/information-assets/import`, {
    method: 'POST',
    body: formData
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || !payload.jobId) {
    const message = payload && payload.error ? payload.error : 'Import API returned an error'
    throw new Error(message)
  }

  return payload
}

function writeLog(summary, csvContent) {
  const dir = path.join(process.cwd(), 'test-results')
  fs.mkdirSync(dir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(dir, `asset-import-${timestamp}.json`)
  const logPayload = {
    timestamp,
    server: `http://${HOST}:${PORT}`,
    organizationId: ORG_ID,
    userId: USER_ID,
    jobId: summary.jobId,
    totals: {
      totalRows: summary.totalRows,
      successCount: summary.successCount,
      errorCount: summary.errorCount
    },
    errors: summary.errors || [],
    sampleCsv: csvContent
  }
  fs.writeFileSync(filePath, JSON.stringify(logPayload, null, 2))
  console.log(`📝 取込ログを ${filePath} に保存しました`)
}

async function main() {
  console.log('🚦 情報資産 CSV 取込 QA を開始します')
  console.log(`対象サーバー: http://${HOST}:${PORT}`)

  const ready = await waitForServer()
  if (!ready) {
    console.error(`❌ サーバー http://${HOST}:${PORT} に接続できませんでした`)
    process.exit(1)
  }

  const csv = buildCsvPayload()
  console.log('📄 サンプル CSV を送信します')
  const summary = await runImport(csv)

  console.log(`✅ 取込完了: jobId=${summary.jobId}, success=${summary.successCount}, errors=${summary.errorCount}`)
  if (summary.errorCount > 0) {
    console.warn('⚠️ エラー行:\n', summary.errors)
  }

  writeLog(summary, csv)
  console.log('🎉 情報資産 CSV 取込 QA が完了しました')
}

main().catch((error) => {
  console.error('❌ QA 実行中にエラーが発生しました:', error)
  process.exit(1)
})
