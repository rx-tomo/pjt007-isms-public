#!/usr/bin/env node
/**
 * UC-05 リスクアセスメント Excel エクスポート QA
 */

const http = require('http')

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)
const RETRY_LIMIT = Number(process.env.QA_SERVER_RETRY_LIMIT || 20)
const RETRY_INTERVAL = Number(process.env.QA_SERVER_RETRY_INTERVAL_MS || 1000)
const ORGANIZATION_ID =
  process.env.QA_RISKS_ORG_ID || '22222222-2222-4222-8222-222222222222'

function waitForServer() {
  return new Promise(resolve => {
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
        () => {
          resolve(true)
        }
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

function requestExport(params, accept = 'application/vnd.ms-excel') {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({ organizationId: ORGANIZATION_ID, ...params })
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: `/api/risks/export?${query.toString()}`,
        method: 'GET',
        headers: {
          Accept: accept
        }
      },
      res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks)
          resolve({ statusCode: res.statusCode, headers: res.headers, body })
        })
      }
    )

    req.on('error', reject)
    req.end()
  })
}

async function main() {
  console.log('🚦 UC-05 リスクエクスポート QA を開始します')
  console.log(`対象サーバー: http://${HOST}:${PORT}`)

  const ready = await waitForServer()
  if (!ready) {
    console.error(`❌ サーバー http://${HOST}:${PORT} に接続できません。開発サーバーを起動してから再実行してください。`)
    process.exit(1)
  }

  const exportWithFilters = await requestExport({ status: 'analyzing', search: 'アクセス' })

  if (exportWithFilters.statusCode !== 200) {
    console.error(`❌ エクスポート API が失敗しました (status: ${exportWithFilters.statusCode})`)
    process.exit(1)
  }

  const contentType = exportWithFilters.headers['content-type'] || ''
  if (!contentType.includes('application/vnd.ms-excel')) {
    console.error('❌ コンテンツタイプが想定外です:', contentType)
    process.exit(1)
  }

  const xml = exportWithFilters.body.toString('utf8')
  if (!xml.includes('外部委託先のアクセス権管理不備')) {
    console.error('❌ フィルタ適用後のエクスポートに期待したリスクが含まれていません')
    process.exit(1)
  }

  const exportWithMatrix = await requestExport({ matrixImpact: '4', matrixLikelihood: '3' })
  if (exportWithMatrix.statusCode !== 200) {
    console.error(`❌ マトリクス条件付きエクスポート API が失敗しました (status: ${exportWithMatrix.statusCode})`)
    process.exit(1)
  }

  const matrixXml = exportWithMatrix.body.toString('utf8')
  if (!matrixXml.includes('外部委託先のアクセス権管理不備')) {
    console.error('❌ マトリクス条件付きエクスポートに期待したリスクが含まれていません')
    process.exit(1)
  }
  if (matrixXml.includes('クラウドサービス障害')) {
    console.error('❌ マトリクス条件外のリスクがエクスポートに含まれています')
    process.exit(1)
  }

  const exportNoMatch = await requestExport({ search: 'this-keyword-should-not-match' })
  if (exportNoMatch.statusCode !== 200) {
    console.error(`❌ エクスポート API (no match) が失敗しました (status: ${exportNoMatch.statusCode})`)
    process.exit(1)
  }

  const xmlNoMatch = exportNoMatch.body.toString('utf8')
  if (xmlNoMatch.includes('外部委託先のアクセス権管理不備')) {
    console.error('❌ 存在しない検索語でリスクが返却されました')
    process.exit(1)
  }

  const pdfExport = await requestExport({ status: 'monitoring', format: 'pdf' }, 'application/pdf')
  if (pdfExport.statusCode !== 200) {
    console.error(`❌ PDF エクスポート API が失敗しました (status: ${pdfExport.statusCode})`)
    process.exit(1)
  }

  const pdfContentType = pdfExport.headers['content-type'] || ''
  if (!pdfContentType.includes('application/pdf')) {
    console.error('❌ PDF エクスポートの Content-Type が想定外です:', pdfContentType)
    process.exit(1)
  }

  const pdfSignature = pdfExport.body.subarray(0, 4).toString('utf8')
  if (!pdfSignature.includes('%PDF')) {
    console.error('❌ PDF エクスポートのファイルシグネチャが不正です')
    process.exit(1)
  }

  const matrixPdfExport = await requestExport(
    { matrixImpact: '1', matrixLikelihood: '5', format: 'pdf' },
    'application/pdf'
  )
  if (matrixPdfExport.statusCode !== 200) {
    console.error(`❌ マトリクス条件付きPDFエクスポート API が失敗しました (status: ${matrixPdfExport.statusCode})`)
    process.exit(1)
  }

  const matrixPdfContentType = matrixPdfExport.headers['content-type'] || ''
  if (!matrixPdfContentType.includes('application/pdf')) {
    console.error('❌ マトリクス条件付きPDFエクスポートの Content-Type が想定外です:', matrixPdfContentType)
    process.exit(1)
  }

  const matrixPdfBody = matrixPdfExport.body.toString('utf8')
  if (!matrixPdfBody.includes('マトリクス: 影響度 1')) {
    console.error('❌ マトリクス条件付きPDFにフィルター条件が含まれていません')
    process.exit(1)
  }

  console.log('✅ リスク Excel エクスポート API はフィルタ条件に基づき正常に動作しています')
  console.log('✅ リスク PDF エクスポート API も Content-Type とシグネチャを満たしています')
  console.log('✅ マトリクス条件付きリスクエクスポートも正常に動作しています')
}

main().catch(error => {
  console.error('❌ 想定外のエラーが発生しました:', error)
  process.exit(1)
})
