import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { generateSQLiteDrizzleJson } from 'drizzle-kit/api'
import { invariantTriggerDefinitions } from './database-invariant-raw-definitions.mjs'

const expectedApplicationTableCount = 95
const expectedInvariantTriggerCount = 6
const manifestRelativePath = 'docs/02-project/database-source-manifest.json'
const producerRelativePath = 'scripts/database-source-manifest.mjs'
const rawDefinitionsRelativePath = 'scripts/database-invariant-raw-definitions.mjs'
const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const schemaDirectory = path.join(repoRoot, 'lib/db/drizzle/schema')

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(key => [key, stableSort(value[key])])
  )
}

function stableJson(value) {
  return JSON.stringify(stableSort(value))
}

function serializeExpected(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`
}

function withoutSnapshotIdentity(snapshot) {
  const { id: _id, prevId: _prevId, ...deterministicSnapshot } = snapshot
  return stableSort(deterministicSnapshot)
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

async function listFixedSchemaSourceFiles(directory = schemaDirectory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFixedSchemaSourceFiles(entryPath)))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

async function hashFixedFiles(filePaths) {
  const hash = createHash('sha256')
  for (const filePath of filePaths) {
    hash.update(relativePath(filePath))
    hash.update('\0')
    hash.update(await readFile(filePath))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function readDeclaredTableNames(schemaFiles) {
  const tableNames = []
  const declarationPattern = /sqliteTable\s*\(\s*['"]([^'"]+)['"]/g

  for (const filePath of schemaFiles) {
    const source = await readFile(filePath, 'utf8')
    for (const match of source.matchAll(declarationPattern)) tableNames.push(match[1])
  }

  return tableNames.sort((left, right) => left.localeCompare(right))
}

async function readFixedDependencyVersions() {
  const packageLock = JSON.parse(await readFile(path.join(repoRoot, 'package-lock.json'), 'utf8'))
  const lockedDrizzleOrm = packageLock.packages?.['node_modules/drizzle-orm']?.version
  const lockedDrizzleKit = packageLock.packages?.['node_modules/drizzle-kit']?.version
  const runtimeDrizzleOrm = JSON.parse(
    await readFile(path.join(repoRoot, 'node_modules/drizzle-orm/package.json'), 'utf8')
  ).version
  const runtimeDrizzleKit = JSON.parse(
    await readFile(path.join(repoRoot, 'node_modules/drizzle-kit/package.json'), 'utf8')
  ).version

  if (!lockedDrizzleOrm || !lockedDrizzleKit || !runtimeDrizzleOrm || !runtimeDrizzleKit) {
    throw new Error('database-source-manifest:verify:dependency-version-missing')
  }

  return {
    drizzleKit: { locked: lockedDrizzleKit, runtime: runtimeDrizzleKit },
    drizzleOrm: { locked: lockedDrizzleOrm, runtime: runtimeDrizzleOrm },
  }
}

async function loadFixedSchemaExports() {
  const loaded = await import(pathToFileURL(path.join(schemaDirectory, 'index.ts')).href)
  const exports = loaded.default ?? loaded['module.exports'] ?? loaded
  if (!exports.schema || typeof exports.schema !== 'object') {
    throw new Error('database-source-manifest:verify:combined-schema-missing')
  }
  return exports
}

function indentSql(sql) {
  return sql
    .trim()
    .split('\n')
    .map(line => `  ${line.trimEnd()}`)
    .join('\n')
}

function renderExpectedTriggerSql(definition) {
  const whenClause = definition.when ? `\nWHEN ${definition.when.trim()}` : ''
  return `CREATE TRIGGER ${definition.name}
${definition.timing} ${definition.event} ON ${definition.table}${whenClause}
BEGIN
${indentSql(definition.body)}
END;`
}

function normalizeExpectedTriggerSql(sql) {
  return sql.replace(/\s+/g, ' ').trim()
}

function buildExpectedTriggers() {
  return invariantTriggerDefinitions
    .map(definition => {
      const normalizedSql = normalizeExpectedTriggerSql(renderExpectedTriggerSql(definition))
      return {
        behaviorId: definition.behaviorId,
        body: definition.body,
        error: definition.error,
        event: definition.event,
        name: definition.name,
        normalizedSql,
        sha256: sha256(normalizedSql),
        table: definition.table,
        timing: definition.timing,
        when: definition.when,
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function buildExpectedDatabaseSourceManifest() {
  const schemaFiles = await listFixedSchemaSourceFiles()
  const declaredTableNames = await readDeclaredTableNames(schemaFiles)
  const schemaExports = await loadFixedSchemaExports()
  const namedExportSnapshot = withoutSnapshotIdentity(
    await generateSQLiteDrizzleJson(schemaExports)
  )
  const combinedSchemaSnapshot = withoutSnapshotIdentity(
    await generateSQLiteDrizzleJson(schemaExports.schema)
  )
  const schemaTableNames = Object.keys(namedExportSnapshot.tables).sort((left, right) =>
    left.localeCompare(right)
  )
  const triggers = buildExpectedTriggers()
  const producerFile = path.join(repoRoot, producerRelativePath)
  const rawDefinitionsFile = path.join(repoRoot, rawDefinitionsRelativePath)

  const expected = stableSort({
    manifestVersion: 1,
    generator: producerRelativePath,
    versions: await readFixedDependencyVersions(),
    sourceHashes: {
      generator: await hashFixedFiles([producerFile]),
      invariantDefinitions: await hashFixedFiles([rawDefinitionsFile]),
      schema: await hashFixedFiles(schemaFiles),
    },
    sourceFiles: {
      generator: producerRelativePath,
      invariantDefinitions: rawDefinitionsRelativePath,
      schema: schemaFiles.map(relativePath),
    },
    counts: {
      canonicalTables: schemaTableNames.length,
      combinedSchemaTables: Object.keys(combinedSchemaSnapshot.tables).length,
      invariantTriggers: triggers.length,
      namedExportTables: schemaTableNames.length,
      sqliteTableDeclarations: declaredTableNames.length,
    },
    declaredTableNames,
    schemaTableNames,
    schemaSnapshotSha256: sha256(stableJson(namedExportSnapshot)),
    combinedSchemaSnapshotSha256: sha256(stableJson(combinedSchemaSnapshot)),
    schemaSnapshot: namedExportSnapshot,
    invariantTriggers: triggers,
  })

  const counts = expected.counts
  if (counts.sqliteTableDeclarations !== expectedApplicationTableCount
    || counts.namedExportTables !== expectedApplicationTableCount
    || counts.combinedSchemaTables !== expectedApplicationTableCount
    || counts.canonicalTables !== expectedApplicationTableCount
    || counts.invariantTriggers !== expectedInvariantTriggerCount) {
    throw new Error('database-source-manifest:verify:source-count-drift')
  }

  return expected
}

export async function verifyDatabaseSourceManifestBytes(actualBytes) {
  const expectedBytes = serializeExpected(await buildExpectedDatabaseSourceManifest())
  return actualBytes === expectedBytes
    ? []
    : ['database-source-manifest:verify:source-mismatch']
}

export async function runDatabaseSourceManifestVerification() {
  const actualBytes = await readFile(path.join(repoRoot, manifestRelativePath), 'utf8')
  return verifyDatabaseSourceManifestBytes(actualBytes)
}
