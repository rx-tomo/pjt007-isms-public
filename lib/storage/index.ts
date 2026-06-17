/**
 * Storage Provider Factory
 *
 * Returns the appropriate IStorageProvider based on STORAGE_MODE env variable.
 * - 'local' (default): LocalFSStorageProvider
 */
import type { IStorageProvider } from './IStorageProvider'

export type { IStorageProvider, StorageUploadOptions, StorageListItem } from './IStorageProvider'

let cachedProvider: IStorageProvider | null = null

export function getStorageProvider(): IStorageProvider {
  if (cachedProvider) return cachedProvider

  const { LocalFSStorageProvider } = require('./LocalFSStorageProvider')
  cachedProvider = new LocalFSStorageProvider()

  return cachedProvider!
}
