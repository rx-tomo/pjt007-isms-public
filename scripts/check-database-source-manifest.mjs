import { pathToFileURL } from 'node:url'
import { runDatabaseSourceManifestVerification } from './database-source-verifier.mjs'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const errors = await runDatabaseSourceManifestVerification()
    if (errors.length) {
      console.error('database-source-manifest:verify:failed')
      process.exitCode = 1
    } else {
      console.log('database-source-manifest:verified')
    }
  } catch {
    console.error('database-source-manifest:verify:failed')
    process.exitCode = 1
  }
}
