/**
 * IStorageProvider
 *
 * Abstraction layer for file storage operations.
 * Implementations: LocalFSStorageProvider
 */

export interface StorageUploadOptions {
  contentType?: string
  cacheControl?: string
  upsert?: boolean
}

export interface StorageListItem {
  name: string
  size: number
}

export interface IStorageProvider {
  upload(
    bucket: string,
    path: string,
    file: Buffer | Blob | File,
    options?: StorageUploadOptions
  ): Promise<{ path: string; error?: Error }>

  download(
    bucket: string,
    path: string
  ): Promise<{ data: Blob | null; error?: Error }>

  remove(
    bucket: string,
    paths: string[]
  ): Promise<{ error?: Error }>

  getSignedUrl(
    bucket: string,
    path: string,
    expiresIn?: number
  ): Promise<{ signedUrl: string; error?: Error }>

  getPublicUrl(
    bucket: string,
    path: string
  ): string

  list(
    bucket: string,
    path?: string
  ): Promise<{ data: StorageListItem[]; error?: Error }>
}
