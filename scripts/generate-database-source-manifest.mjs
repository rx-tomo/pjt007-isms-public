import { writeFile } from 'node:fs/promises'
import {
  buildDatabaseSourceManifest,
  resolveDatabaseSourceManifestPath,
  serializeDatabaseSourceManifest,
} from './database-source-manifest.mjs'

if (!process.argv.includes('--write')) {
  throw new Error('Refusing to write without explicit --write')
}

const manifest = await buildDatabaseSourceManifest()
await writeFile(
  resolveDatabaseSourceManifestPath(),
  serializeDatabaseSourceManifest(manifest),
  'utf8'
)
console.log('Database source manifest generated')
