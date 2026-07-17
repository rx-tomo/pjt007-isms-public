import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { generateSQLiteDrizzleJson } from 'drizzle-kit/api'
import {
  hashInvariantSql,
  invariantTriggerDefinitions,
  normalizeInvariantSql,
  renderInvariantTriggerSql,
} from './database-invariant-definitions.mjs'

export const databaseSourceManifestPath = 'docs/02-project/database-source-manifest.json'
export const expectedApplicationTableCount = 94
export const expectedInvariantTriggerCount = 6

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

function withoutSnapshotIdentity(snapshot) {
  const { id: _id, prevId: _prevId, ...deterministicSnapshot } = snapshot
  return stableSort(deterministicSnapshot)
}

async function listSchemaSourceFiles(directory = schemaDirectory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listSchemaSourceFiles(entryPath)))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

async function hashFiles(filePaths) {
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

async function readDependencyVersions() {
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
    throw new Error('Locked Drizzle ORM/Kit versions are missing from package-lock.json')
  }
  if (lockedDrizzleOrm !== runtimeDrizzleOrm || lockedDrizzleKit !== runtimeDrizzleKit) {
    throw new Error('Installed Drizzle ORM/Kit versions differ from package-lock.json')
  }

  return {
    drizzleKit: { locked: lockedDrizzleKit, runtime: runtimeDrizzleKit },
    drizzleOrm: { locked: lockedDrizzleOrm, runtime: runtimeDrizzleOrm },
  }
}

async function loadSchemaExports() {
  const loaded = await import(
    pathToFileURL(path.join(schemaDirectory, 'index.ts')).href
  )
  const exports = loaded.default ?? loaded['module.exports'] ?? loaded

  if (!exports.schema || typeof exports.schema !== 'object') {
    throw new Error('Combined Drizzle schema export is missing')
  }

  return exports
}

function sameStringSet(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function isRelativeRepoPath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !path.isAbsolute(value)
    && !value.split('/').includes('..')
    && !/^[A-Za-z]:[\\/]/.test(value)
}

async function assertSourceManifest(manifest) {
  if (!manifest || manifest.manifestVersion !== 1) {
    throw new Error('Database source manifest version is invalid')
  }
  if (!manifest.schemaSnapshot || typeof manifest.schemaSnapshot.tables !== 'object') {
    throw new Error('Canonical full schema snapshot is missing')
  }
  if ('id' in manifest.schemaSnapshot || 'prevId' in manifest.schemaSnapshot) {
    throw new Error('Random snapshot identity must not be stored')
  }

  const { counts } = manifest
  if (!counts || typeof counts !== 'object') throw new Error('Schema counts are missing')
  const countValues = [
    counts.sqliteTableDeclarations,
    counts.namedExportTables,
    counts.combinedSchemaTables,
    counts.canonicalTables,
  ]

  if (countValues.some(count => count !== expectedApplicationTableCount)) {
    throw new Error(`Application schema parity must be ${expectedApplicationTableCount}: ${countValues.join('/')}`)
  }
  if (counts.invariantTriggers !== expectedInvariantTriggerCount) {
    throw new Error(`Invariant trigger count must be ${expectedInvariantTriggerCount}`)
  }
  const snapshotTableNames = Object.keys(manifest.schemaSnapshot.tables).sort((left, right) =>
    left.localeCompare(right)
  )
  if (!sameStringSet(manifest.declaredTableNames, manifest.schemaTableNames)) {
    throw new Error('sqliteTable declarations and canonical schema table names differ')
  }
  if (!sameStringSet(snapshotTableNames, manifest.schemaTableNames)) {
    throw new Error('Canonical schema table names and full snapshot differ')
  }
  const calculatedSnapshotHash = sha256(stableJson(manifest.schemaSnapshot))
  if (manifest.schemaSnapshotSha256 !== calculatedSnapshotHash) {
    throw new Error('Canonical full schema snapshot hash is invalid')
  }
  if (manifest.schemaSnapshotSha256 !== manifest.combinedSchemaSnapshotSha256) {
    throw new Error('Named exports and combined schema snapshots differ')
  }

  for (const key of ['generator', 'invariantDefinitions', 'schema']) {
    if (!isSha256(manifest.sourceHashes?.[key])) {
      throw new Error(`Source hash is invalid: ${key}`)
    }
  }
  const sourcePaths = [
    manifest.generator,
    manifest.sourceFiles?.generator,
    manifest.sourceFiles?.invariantDefinitions,
    ...(manifest.sourceFiles?.schema ?? []),
  ]
  if (!sourcePaths.length || sourcePaths.some(value => !isRelativeRepoPath(value))) {
    throw new Error('Source file paths must be non-empty repo-relative paths')
  }
  if (manifest.generator !== manifest.sourceFiles.generator) {
    throw new Error('Generator path and sourceFiles.generator differ')
  }

  const expectedSchemaFiles = (await listSchemaSourceFiles()).map(relativePath)
  if (!sameStringSet(manifest.sourceFiles.schema, expectedSchemaFiles)) {
    throw new Error('Schema source file inventory is incomplete')
  }
  const expectedGeneratorPath = relativePath(fileURLToPath(import.meta.url))
  const expectedInvariantPath = 'scripts/database-invariant-raw-definitions.mjs'
  if (manifest.sourceFiles.generator !== expectedGeneratorPath
    || manifest.sourceFiles.invariantDefinitions !== expectedInvariantPath) {
    throw new Error('Canonical source file identity differs')
  }
  const expectedSourceHashes = {
    generator: await hashFiles([path.join(repoRoot, expectedGeneratorPath)]),
    invariantDefinitions: await hashFiles([path.join(repoRoot, expectedInvariantPath)]),
    schema: await hashFiles(expectedSchemaFiles.map(file => path.join(repoRoot, file))),
  }
  if (stableJson(manifest.sourceHashes) !== stableJson(expectedSourceHashes)) {
    throw new Error('Canonical source hashes differ from repository source')
  }

  const expectedVersions = await readDependencyVersions()
  if (stableJson(manifest.versions) !== stableJson(expectedVersions)) {
    throw new Error('Canonical dependency versions differ from runtime/lock state')
  }
  for (const dependency of ['drizzleKit', 'drizzleOrm']) {
    const version = manifest.versions?.[dependency]
    if (!version || typeof version.locked !== 'string' || version.locked !== version.runtime) {
      throw new Error(`Locked/runtime dependency version differs: ${dependency}`)
    }
  }

  if (!Array.isArray(manifest.invariantTriggers)
    || manifest.invariantTriggers.length !== expectedInvariantTriggerCount) {
    throw new Error('Canonical invariant trigger definitions are incomplete')
  }
  const triggerNames = new Set()
  const behaviorIds = new Set()
  for (const trigger of manifest.invariantTriggers) {
    const requiredStrings = [
      'behaviorId', 'body', 'error', 'event', 'name', 'normalizedSql', 'sha256', 'table', 'timing',
    ]
    if (requiredStrings.some(key => typeof trigger[key] !== 'string' || !trigger[key])) {
      throw new Error('Canonical invariant trigger field is missing')
    }
    if (trigger.when !== null && (typeof trigger.when !== 'string' || !trigger.when)) {
      throw new Error(`Canonical invariant trigger WHEN is invalid: ${trigger.name}`)
    }
    if (triggerNames.has(trigger.name) || behaviorIds.has(trigger.behaviorId)) {
      throw new Error('Canonical invariant trigger identity is duplicated')
    }
    triggerNames.add(trigger.name)
    behaviorIds.add(trigger.behaviorId)
    const renderedSql = renderInvariantTriggerSql(trigger)
    if (trigger.normalizedSql !== normalizeInvariantSql(renderedSql)) {
      throw new Error(`Canonical invariant trigger SQL is invalid: ${trigger.name}`)
    }
    if (!isSha256(trigger.sha256) || trigger.sha256 !== hashInvariantSql(renderedSql)) {
      throw new Error(`Canonical invariant trigger hash is invalid: ${trigger.name}`)
    }
    if (!trigger.body.includes(trigger.error)) {
      throw new Error(`Canonical invariant trigger error/body differ: ${trigger.name}`)
    }
  }
  const definedTriggerNames = invariantTriggerDefinitions
    .map(definition => definition.name)
    .sort((left, right) => left.localeCompare(right))
  if (!sameStringSet([...triggerNames].sort((left, right) => left.localeCompare(right)), definedTriggerNames)) {
    throw new Error('Canonical trigger set differs from source definitions')
  }
}

export async function buildDatabaseSourceManifest() {
  const schemaFiles = await listSchemaSourceFiles()
  const declaredTableNames = await readDeclaredTableNames(schemaFiles)
  const schemaExports = await loadSchemaExports()
  const namedExportSnapshot = withoutSnapshotIdentity(
    await generateSQLiteDrizzleJson(schemaExports)
  )
  const combinedSchemaSnapshot = withoutSnapshotIdentity(
    await generateSQLiteDrizzleJson(schemaExports.schema)
  )
  const schemaTableNames = Object.keys(namedExportSnapshot.tables).sort((left, right) =>
    left.localeCompare(right)
  )
  const sourceManifestFile = fileURLToPath(import.meta.url)
  const invariantDefinitionsFile = path.join(repoRoot, 'scripts/database-invariant-raw-definitions.mjs')
  const triggers = invariantTriggerDefinitions
    .map(definition => {
      const sql = renderInvariantTriggerSql(definition)
      return {
        behaviorId: definition.behaviorId,
        body: definition.body,
        error: definition.error,
        event: definition.event,
        name: definition.name,
        normalizedSql: normalizeInvariantSql(sql),
        sha256: hashInvariantSql(sql),
        table: definition.table,
        timing: definition.timing,
        when: definition.when,
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))

  const manifest = stableSort({
    manifestVersion: 1,
    generator: relativePath(sourceManifestFile),
    versions: await readDependencyVersions(),
    sourceHashes: {
      generator: await hashFiles([sourceManifestFile]),
      invariantDefinitions: await hashFiles([invariantDefinitionsFile]),
      schema: await hashFiles(schemaFiles),
    },
    sourceFiles: {
      generator: relativePath(sourceManifestFile),
      invariantDefinitions: relativePath(invariantDefinitionsFile),
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

  await assertSourceManifest(manifest)
  return manifest
}

export function serializeDatabaseSourceManifest(manifest) {
  return `${JSON.stringify(stableSort(manifest), null, 2)}\n`
}

export function resolveDatabaseSourceManifestPath() {
  return path.join(repoRoot, databaseSourceManifestPath)
}

export { assertSourceManifest }
