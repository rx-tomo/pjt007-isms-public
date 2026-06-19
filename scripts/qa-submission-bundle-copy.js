#!/usr/bin/env node
/**
 * qa-submission-bundle-copy.js
 *
 * 審査準備パッケージ出力（ZIP/PDF/manifest JSON/CSV）の内部用語漏れを検証する QA スクリプト。
 * PRFAQ-BL-13 の出力側拡張。
 *
 * 前提: 開発サーバー（ポート3007）が稼働中であること。
 *
 * 特殊ケース:
 *   - ファイル名・URL パス（submission-bundle 等）は対象外。自然言語コピーのみ対象。
 *   - 'auditType' フィールドの値 'surveillance' は正規 ISO 用語 → 禁止対象外。
 *   - 'Surveillance cycle' 等の内部フェーズラベルのみ禁止。
 *   - PDF テキスト抽出長が閾値未満の場合は FAIL（将来圧縮化された場合の素通り防止）。
 */

const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { bannedTerms } = require('./lib/banned-terms')

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)
const RETRY_LIMIT = Number(process.env.QA_SERVER_RETRY_LIMIT || 20)
const RETRY_INTERVAL = Number(process.env.QA_SERVER_RETRY_INTERVAL_MS || 1000)
const ORGANIZATION_ID =
  process.env.QA_BUNDLE_ORG_ID || '70000000-0000-4000-8000-000000000001'
const OPERATOR_EMAIL = 'operator.practical@isms-practical.local'

// PDF テキスト抽出長の下限。これより短い場合は圧縮等で走査が空振りしていると判断して FAIL。
const PDF_TEXT_MIN_LENGTH = 500

// ---- ユーティリティ --------------------------------------------------------

/** サーバーが応答するまで待つ */
function waitForServer() {
  return new Promise((resolve) => {
    let attempts = 0

    const tryConnect = () => {
      const req = http.request(
        { hostname: HOST, port: PORT, path: '/api/dev/login', method: 'HEAD', timeout: 1000 },
        () => resolve(true)
      )
      req.on('error', () => {
        attempts += 1
        if (attempts >= RETRY_LIMIT) { resolve(false); return }
        setTimeout(tryConnect, RETRY_INTERVAL)
      })
      req.on('timeout', () => {
        req.destroy()
        attempts += 1
        if (attempts >= RETRY_LIMIT) { resolve(false); return }
        setTimeout(tryConnect, RETRY_INTERVAL)
      })
      req.end()
    }

    tryConnect()
  })
}

/**
 * dev ログイン（/api/dev/login）を実行してセッション Cookie 文字列を返す。
 * 認証成功しなかった場合は null を返す。
 */
async function devLogin() {
  const body = JSON.stringify({
    role: 'system_operator',
    organizationId: ORGANIZATION_ID,
    email: OPERATOR_EMAIL,
  })

  const loginResponse = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/dev/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
      },
      (response) => {
        const chunks = []
        response.on('data', (c) => chunks.push(c))
        response.on('end', () => resolve({
          statusCode: response.statusCode,
          setCookie: response.headers['set-cookie'] || [],
        }))
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  if (loginResponse.statusCode !== 200) {
    return null
  }

  // セッション Cookie を単一文字列に結合（name=value 部分のみ）
  const cookies = loginResponse.setCookie
    .map((c) => c.split(';')[0])
    .join('; ')

  return cookies || null
}

/**
 * HTTP GET リクエスト（認証 Cookie 付き）を送り Buffer を返す。
 */
function fetchWithCookie(path, cookieHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path,
        method: 'GET',
        headers: { Cookie: cookieHeader },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

// ---- ZIP パーサー ----------------------------------------------------------

/**
 * ZIP バッファからすべてのファイルエントリを抽出する（stored/非圧縮のみ対応）。
 * 返り値: { name: string, data: Buffer }[]
 *
 * ZIP ローカルファイルヘッダー仕様（PKZIP Application Note）:
 *   offset 0  : signature 0x04034b50 (4 bytes)
 *   offset 4  : version needed (2)
 *   offset 6  : general purpose bit flag (2)
 *   offset 8  : compression method (2) — 0 = stored
 *   offset 10 : last mod time (2)
 *   offset 12 : last mod date (2)
 *   offset 14 : crc-32 (4)
 *   offset 18 : compressed size (4)
 *   offset 22 : uncompressed size (4)
 *   offset 26 : file name length (2)
 *   offset 28 : extra field length (2)
 *   offset 30 : file name (n)
 *   offset 30+n : extra field (m)
 *   offset 30+n+m : file data
 */
function parseZipEntries(zipBuffer) {
  const LOCAL_HEADER_SIG = 0x04034b50
  const entries = []
  let offset = 0

  while (offset + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset)
    if (sig !== LOCAL_HEADER_SIG) break

    const compressionMethod = zipBuffer.readUInt16LE(offset + 8)
    const compressedSize = zipBuffer.readUInt32LE(offset + 18)
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26)
    const extraFieldLength = zipBuffer.readUInt16LE(offset + 28)

    const nameStart = offset + 30
    const name = zipBuffer.slice(nameStart, nameStart + fileNameLength).toString('utf8')

    const dataStart = nameStart + fileNameLength + extraFieldLength
    const dataEnd = dataStart + compressedSize
    const data = zipBuffer.slice(dataStart, dataEnd)

    entries.push({ name, data, compressionMethod })

    offset = dataEnd
  }

  return entries
}

// ---- PDF テキスト抽出 ------------------------------------------------------

/**
 * PDF バッファから可読テキストを抽出する。
 *
 * このプロジェクトの PDF は buildSimplePdf() が生成するインライン非圧縮テキストストリームで、
 * escapePdfText による ( ) \ のエスケープのみが適用されている。
 * バッファを UTF-8 文字列化して PDF テキスト演算子 (text) Tj の括弧内を取り出す。
 *
 * escapePdfText の逆変換:
 *   \\( → (
 *   \\) → )
 *   \\\\ → \
 */
function extractPdfText(pdfBuffer) {
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'submission-bundle-pdf-'))
    const pdfPath = path.join(tmpDir, 'bundle.pdf')
    fs.writeFileSync(pdfPath, pdfBuffer)
    const text = execFileSync('pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8' })
    fs.rmSync(tmpDir, { recursive: true, force: true })
    return text
  } catch {
    // Poppler がない環境では、旧手書きPDFの非圧縮テキスト抽出にフォールバックする。
  }

  const raw = pdfBuffer.toString('utf8')
  const result = []

  // テキストオブジェクト (text) Tj のパターンを抽出
  // ネストした括弧を無視するシンプルなマッチ（プロジェクト PDF は入れ子なし）
  const regex = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g
  let match
  while ((match = regex.exec(raw)) !== null) {
    const escaped = match[1]
    const unescaped = escaped
      .replace(/\\\\/g, '\x00BACKSLASH\x00')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\x00BACKSLASH\x00/g, '\\')
    result.push(unescaped)
  }

  return result.join('\n')
}

function inspectPdfStructure(sourceName, pdfBuffer) {
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'submission-bundle-pdf-'))
    const pdfPath = path.join(tmpDir, 'bundle.pdf')
    fs.writeFileSync(pdfPath, pdfBuffer)
    const fontOutput = execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' })
    const pageInfo = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' })
    fs.rmSync(tmpDir, { recursive: true, force: true })

    const pageMatch = pageInfo.match(/^Pages:\s+(\d+)/m)
    const pageCount = pageMatch ? Number(pageMatch[1]) : 0
    if (pageCount < 1) {
      console.error(`${sourceName} のページ数を確認できませんでした。`)
      process.exit(1)
    }
    if (!/\syes\s+(yes|no)\s+(yes|no)/.test(fontOutput)) {
      console.error(`${sourceName} に埋め込みフォントが確認できませんでした。`)
      console.error(fontOutput)
      process.exit(1)
    }
    return { pageCount }
  } catch {
    console.warn(`${sourceName} の pdfinfo/pdffonts 検査をスキップしました（Poppler が未導入の可能性）。`)
    return { pageCount: null }
  }
}

// ---- 禁止用語スキャン -------------------------------------------------------

/**
 * テキストに禁止用語が含まれていないかスキャンする。
 * 検出された問題を findings 配列に追加する（破壊的変更）。
 *
 * @param {string} sourceName - ログ出力に使うソース名
 * @param {string} text - スキャン対象テキスト
 * @param {{ sourceName: string, term: string, reason: string, context: string }[]} findings
 */
function scanText(sourceName, text, findings) {
  for (const banned of bannedTerms) {
    let idx = text.indexOf(banned.term)
    while (idx !== -1) {
      const ctxStart = Math.max(0, idx - 40)
      const ctxEnd = Math.min(text.length, idx + banned.term.length + 40)
      findings.push({
        sourceName,
        term: banned.term,
        reason: banned.reason,
        context: text.slice(ctxStart, ctxEnd).replace(/\n/g, ' '),
      })
      idx = text.indexOf(banned.term, idx + banned.term.length)
    }
  }
}

// ---- メイン ----------------------------------------------------------------

async function main() {
  console.log('\n=== 審査準備パッケージ 公開コピー境界 QA ===')
  console.log(`対象サーバー: http://${HOST}:${PORT}`)
  console.log(`対象組織 ID:  ${ORGANIZATION_ID}`)

  // 1. サーバー疎通確認
  const ready = await waitForServer()
  if (!ready) {
    console.error(`\nサーバー http://${HOST}:${PORT} に接続できません。開発サーバーを起動してから再実行してください。`)
    process.exit(1)
  }

  // 2. dev ログイン
  console.log('\n[1/5] dev ログイン中...')
  const cookieHeader = await devLogin()
  if (!cookieHeader) {
    console.error('dev ログインに失敗しました。E2E_MODE / NEXT_PUBLIC_E2E_MODE が有効になっているか確認してください。')
    process.exit(1)
  }
  console.log('      ログイン成功')

  const findings = []

  // 3. JSON 応答（manifest）スキャン
  console.log('\n[2/5] JSON manifest スキャン中...')
  const jsonRes = await fetchWithCookie(
    `/api/examination/submission-bundle?organizationId=${ORGANIZATION_ID}&format=json`,
    cookieHeader
  )
  if (jsonRes.statusCode !== 200) {
    console.error(`JSON API が失敗しました (status: ${jsonRes.statusCode})`)
    console.error(jsonRes.body.toString('utf8').slice(0, 500))
    process.exit(1)
  }
  const jsonText = jsonRes.body.toString('utf8')
  scanText('manifest JSON', jsonText, findings)
  console.log(`      ${jsonText.length} バイト — 禁止用語検出: ${findings.length}`)

  // 4. PDF 応答スキャン
  console.log('\n[3/5] PDF スキャン中...')
  const pdfRes = await fetchWithCookie(
    `/api/examination/submission-bundle?organizationId=${ORGANIZATION_ID}&format=pdf`,
    cookieHeader
  )
  if (pdfRes.statusCode !== 200) {
    console.error(`PDF API が失敗しました (status: ${pdfRes.statusCode})`)
    process.exit(1)
  }
  const pdfSig = pdfRes.body.subarray(0, 4).toString('utf8')
  if (pdfSig !== '%PDF') {
    console.error(`PDF シグネチャ不正: ${pdfSig}`)
    process.exit(1)
  }
  const pdfStructure = inspectPdfStructure('PDF', pdfRes.body)
  const pdfText = extractPdfText(pdfRes.body)
  if (pdfText.length < PDF_TEXT_MIN_LENGTH) {
    console.error(
      `PDF テキスト抽出長 (${pdfText.length}) が閾値 (${PDF_TEXT_MIN_LENGTH}) 未満です。` +
      '圧縮方式の変更等により Tj 演算子が存在しない可能性があります。スクリプトの更新が必要です。'
    )
    process.exit(1)
  }
  const pdfFindingsBefore = findings.length
  scanText('PDF', pdfText, findings)
  console.log(`      PDF テキスト抽出: ${pdfText.length} 文字 / pages: ${pdfStructure.pageCount ?? 'n/a'} — 禁止用語検出: ${findings.length - pdfFindingsBefore}`)

  // 5. ZIP 内の全エントリをスキャン
  console.log('\n[4/5] ZIP 内エントリスキャン中...')
  const zipRes = await fetchWithCookie(
    `/api/examination/submission-bundle?organizationId=${ORGANIZATION_ID}&format=zip`,
    cookieHeader
  )
  if (zipRes.statusCode !== 200) {
    console.error(`ZIP API が失敗しました (status: ${zipRes.statusCode})`)
    process.exit(1)
  }
  const zipSig = zipRes.body.readUInt32LE(0)
  if (zipSig !== 0x04034b50) {
    console.error(`ZIP シグネチャ不正: 0x${zipSig.toString(16)}`)
    process.exit(1)
  }

  const entries = parseZipEntries(zipRes.body)
  if (entries.length === 0) {
    console.error('ZIP エントリが抽出できませんでした。')
    process.exit(1)
  }
  console.log(`      ZIP エントリ数: ${entries.length}`)

  for (const entry of entries) {
    const ext = entry.name.split('.').pop().toLowerCase()
    const entryFindingsBefore = findings.length

    if (ext === 'json' || ext === 'csv') {
      // UTF-8 テキストとして直接スキャン
      const text = entry.data.toString('utf8')
      scanText(`ZIP:${entry.name}`, text, findings)
      console.log(`        ${entry.name} (${text.length}B) — 検出: ${findings.length - entryFindingsBefore}`)
    } else if (ext === 'pdf') {
      // PDF テキスト抽出後スキャン
      const pdfEntryStructure = inspectPdfStructure(`ZIP:${entry.name}`, entry.data)
      const pdfEntryText = extractPdfText(entry.data)
      if (pdfEntryText.length < PDF_TEXT_MIN_LENGTH) {
        console.error(
          `  ZIP 内 PDF (${entry.name}) のテキスト抽出長 (${pdfEntryText.length}) が閾値未満です。`
        )
        process.exit(1)
      }
      scanText(`ZIP:${entry.name}`, pdfEntryText, findings)
      console.log(`        ${entry.name} PDF抽出 (${pdfEntryText.length}文字 / pages: ${pdfEntryStructure.pageCount ?? 'n/a'}) — 検出: ${findings.length - entryFindingsBefore}`)
    } else {
      console.log(`        ${entry.name} (スキャン対象外: ${ext})`)
    }
  }

  // 6. 結果サマリー
  console.log('\n[5/5] 結果サマリー')
  if (findings.length > 0) {
    console.error('\n審査準備パッケージ 公開コピー境界チェック FAIL')
    console.error(`禁止用語が ${findings.length} 件検出されました:`)
    for (const f of findings) {
      console.error(`  [${f.sourceName}] "${f.term}" (${f.reason})`)
      console.error(`    context: ...${f.context}...`)
    }
    process.exit(1)
  }

  console.log('\n審査準備パッケージ 公開コピー境界チェック PASS')
  console.log(`スキャン済み: JSON manifest / PDF / ZIP (${entries.length} エントリ) — 禁止用語検出ゼロ`)
}

main().catch((error) => {
  console.error('想定外のエラーが発生しました:', error)
  process.exit(1)
})
