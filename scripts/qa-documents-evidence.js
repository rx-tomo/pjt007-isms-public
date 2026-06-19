#!/usr/bin/env node
/**
 * 文書アップロード QA 用の証跡収集スクリプト
 * - documents / document_versions / audit_logs / .storage の最新状態を取得
 * - documents.file_size から組織ストレージ使用量を概算
 * - 出力は JSON（--output でファイル保存可能）
 *
 * 使い方の例:
 *  1. アップロード前: `npm run qa:documents:evidence -- --organization <ORG_ID> --label before --output docs/05-quality/evidence/doc-upload-<ts>-before.json`
 *  2. アップロード後: `npm run qa:documents:evidence -- --document <DOC_ID> --label after --output docs/05-quality/evidence/doc-upload-<ts>-after.json`
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@libsql/client')

const MAX_ORG_STORAGE_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) {
    return null
  }
  if (index + 1 >= process.argv.length) {
    return null
  }
  return process.argv[index + 1]
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) {
    return null
  }
  if (bytes === 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(2)} ${units[i]}`
}

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL || `file:${process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'local.db')}`

  const documentIdArg = getArg('--document') || getArg('-d') || process.env.DOCUMENT_ID || null
  const organizationIdArg = getArg('--organization') || getArg('-o') || process.env.ORGANIZATION_ID || null
  const outputPath = getArg('--output') || process.env.QA_EVIDENCE_OUT || null
  const label = getArg('--label') || process.env.QA_EVIDENCE_LABEL || null
  const limitArg = getArg('--limit') || process.env.QA_EVIDENCE_LIMIT || '5'
  const limit = Number.isNaN(Number(limitArg)) ? 5 : Number(limitArg)

  if (!documentIdArg && !organizationIdArg) {
    console.warn('document / organization が指定されていないため、直近更新された文書を対象にします。')
  }

  const client = createClient({
    url: dbUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  try {
    const document = await fetchDocument(client, { documentIdArg, organizationIdArg })
    const organizationId = document.organization_id

    const [storageUsage, documentVersions, auditLogs, storageObjects] = await Promise.all([
      fetchStorageUsage(client, organizationId),
      fetchDocumentVersions(client, document.id, limit),
      fetchAuditLogs(client, document.id, limit),
      fetchStorageObjects(document, documentVersions, limit)
    ])

    const summary = {
      generated_at: new Date().toISOString(),
      label: label || null,
      target: {
        organization_id: organizationId,
        document_id: document.id,
        document_title: document.title,
        version_number: document.version_number,
        status: document.status
      },
      storage_usage: {
        current_bytes: storageUsage,
        formatted: formatBytes(Number(storageUsage)),
        max_bytes: MAX_ORG_STORAGE_BYTES,
        max_formatted: formatBytes(MAX_ORG_STORAGE_BYTES),
        utilization_percent: Number(((Number(storageUsage) / MAX_ORG_STORAGE_BYTES) * 100).toFixed(2))
      },
      document_snapshot: {
        file_name: document.file_name,
        file_path: document.file_path,
        file_size: document.file_size,
        file_size_formatted: formatBytes(document.file_size),
        updated_at: document.updated_at,
        approved_at: document.approved_at
      },
      latest_versions: documentVersions,
      audit_logs: auditLogs,
      storage_objects: storageObjects
    }

    const serialized = JSON.stringify(summary, null, 2)
    console.log(serialized)

    if (outputPath) {
      const resolved = path.resolve(outputPath)
      fs.mkdirSync(path.dirname(resolved), { recursive: true })
      fs.writeFileSync(resolved, serialized)
      console.log(`\n📁 証跡を ${resolved} に保存しました`)
    }
  } catch (error) {
    console.error('証跡収集中にエラーが発生しました:', error.message)
    process.exitCode = 1
  } finally {
    client.close()
  }
}

async function fetchDocument(client, { documentIdArg, organizationIdArg }) {
  const conditions = []
  const values = []

  if (documentIdArg) {
    conditions.push('d.id = ?')
    values.push(documentIdArg)
  } else if (organizationIdArg) {
    conditions.push('d.organization_id = ?')
    values.push(organizationIdArg)
  }

  const whereClause = conditions.length ? `where ${conditions.join(' AND ')}` : ''
  const query = `
    select d.id,
           d.organization_id,
           d.title,
           d.file_name,
           d.file_path,
           d.file_size,
           d.version_number,
           d.status,
           d.created_at,
           d.updated_at,
           d.approved_at
    from documents d
    ${whereClause}
    order by d.updated_at desc
    limit 1;
  `

  const result = await client.execute({ sql: query, args: values })
  if (result.rows.length === 0) {
    throw new Error('対象の文書が見つかりませんでした。document_id / organization_id を確認してください。')
  }
  return result.rows[0]
}

async function fetchStorageUsage(client, organizationId) {
  const result = await client.execute({
    sql: 'select coalesce(sum(file_size), 0) as usage_bytes from documents where organization_id = ?',
    args: [organizationId],
  })
  return result.rows[0]?.usage_bytes ?? 0
}

async function fetchDocumentVersions(client, documentId, limit) {
  const result = await client.execute({
    sql:
    `select version_number,
            file_name,
            file_path,
            file_size,
            created_by,
            created_at
       from document_versions
      where document_id = ?
      order by version_number desc
      limit ?`,
    args: [documentId, limit],
  })

  return result.rows.map(row => ({
    version_number: row.version_number,
    file_name: row.file_name,
    file_path: row.file_path,
    file_size: row.file_size,
    file_size_formatted: formatBytes(row.file_size),
    created_by: row.created_by,
    created_at: row.created_at
  }))
}

async function fetchAuditLogs(client, documentId, limit) {
  const result = await client.execute({
    sql:
    `select action,
            scope,
            user_id,
            created_at,
            changes
       from audit_logs
      where resource_type = 'document'
        and resource_id = ?
      order by created_at desc
      limit ?`,
    args: [documentId, limit],
  })

  return result.rows
}

async function fetchStorageObjects(document, documentVersions, limit) {
  const candidates = [
    document.file_path,
    ...documentVersions.map((version) => version.file_path),
  ].filter(Boolean).slice(0, limit)

  return candidates.map((filePath) => {
    const resolved = path.resolve(process.cwd(), '.storage', filePath)
    const exists = fs.existsSync(resolved)
    const stat = exists ? fs.statSync(resolved) : null
    return {
      path: filePath,
      exists,
      size: stat?.size ?? null,
      updated_at: stat?.mtime?.toISOString() ?? null,
    }
  })
}

main()
