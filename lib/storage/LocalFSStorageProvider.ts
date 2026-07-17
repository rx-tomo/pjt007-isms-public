/**
 * LocalFSStorageProvider
 *
 * Stores files on the local filesystem under `.storage/` directory.
 * Designed for local development without local filesystem storage dependency.
 *
 * Signed/public URLs are served via `/api/storage/[...path]` API route.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  StorageObjectTooLargeError,
  type IStorageProvider,
  type StorageDownloadOptions,
  type StorageUploadOptions,
  type StorageListItem,
} from './IStorageProvider'

const DEFAULT_STORAGE_ROOT = path.resolve(
  process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), '.storage')
)

export class LocalFSStorageProvider implements IStorageProvider {
  constructor(private readonly storageRoot: string = DEFAULT_STORAGE_ROOT) {}

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }

  private assertNoSymlinks(resolvedPath: string): void {
    const root = path.resolve(this.storageRoot)
    const relativePath = path.relative(root, resolvedPath)
    let currentPath = root

    for (const segment of relativePath.split(path.sep).filter(Boolean)) {
      currentPath = path.join(currentPath, segment)
      if (fs.existsSync(currentPath) && fs.lstatSync(currentPath).isSymbolicLink()) {
        throw new Error('Storage path must not traverse symbolic links')
      }
    }
  }

  private resolveBucketPath(bucket: string): string {
    if (!bucket || bucket === '.' || bucket === '..' || bucket.includes('/') || bucket.includes('\\')) {
      throw new Error('Invalid storage bucket')
    }

    const root = path.resolve(this.storageRoot)
    const bucketRoot = path.resolve(root, bucket)
    const rootWithSeparator = `${root}${path.sep}`

    if (!bucketRoot.startsWith(rootWithSeparator)) {
      throw new Error('Invalid storage bucket')
    }
    this.assertNoSymlinks(bucketRoot)
    return bucketRoot
  }

  private resolvePath(bucket: string, filePath: string): string {
    const bucketRoot = this.resolveBucketPath(bucket)
    const resolvedPath = path.resolve(bucketRoot, filePath)
    const bucketWithSeparator = `${bucketRoot}${path.sep}`

    if (resolvedPath !== bucketRoot && !resolvedPath.startsWith(bucketWithSeparator)) {
      throw new Error('Invalid storage path')
    }
    if (resolvedPath === bucketRoot) {
      throw new Error('Storage path must reference a file or directory below the bucket')
    }

    this.assertNoSymlinks(resolvedPath)
    return resolvedPath
  }

  async upload(
    bucket: string,
    filePath: string,
    file: Buffer | Blob | File,
    _options?: StorageUploadOptions
  ): Promise<{ path: string; error?: Error }> {
    try {
      const fullPath = this.resolvePath(bucket, filePath)
      this.ensureDir(path.dirname(fullPath))

      let buffer: Buffer
      if (Buffer.isBuffer(file)) {
        buffer = file
      } else if (file instanceof Blob) {
        const arrayBuffer = await file.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
      } else {
        return { path: filePath, error: new Error('Unsupported file type') }
      }

      fs.writeFileSync(fullPath, buffer)
      return { path: filePath }
    } catch (err) {
      return {
        path: filePath,
        error: err instanceof Error ? err : new Error('Upload failed')
      }
    }
  }

  async download(
    bucket: string,
    filePath: string,
    options?: StorageDownloadOptions
  ): Promise<{ data: Blob | null; error?: Error }> {
    let descriptor: number | null = null
    try {
      const fullPath = this.resolvePath(bucket, filePath)

      if (!fs.existsSync(fullPath)) {
        return { data: null, error: new Error('File not found') }
      }

      const maxBytes = options?.maxBytes
      if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 0)) {
        throw new Error('Invalid storage download limit')
      }

      descriptor = fs.openSync(
        fullPath,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)
      )
      const stats = fs.fstatSync(descriptor)
      if (!stats.isFile()) {
        throw new Error('Storage path must reference a regular file')
      }
      if (maxBytes !== undefined && stats.size > maxBytes) {
        throw new StorageObjectTooLargeError()
      }

      const buffer = Buffer.alloc(stats.size)
      let offset = 0
      while (offset < buffer.length) {
        const bytesRead = fs.readSync(descriptor, buffer, offset, buffer.length - offset, offset)
        if (bytesRead === 0) break
        offset += bytesRead
      }
      const overflowProbe = Buffer.alloc(1)
      if (fs.readSync(descriptor, overflowProbe, 0, 1, offset) > 0) {
        throw new StorageObjectTooLargeError()
      }
      const blob = new Blob([buffer.subarray(0, offset)])
      return { data: blob }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Download failed')
      }
    } finally {
      if (descriptor !== null) fs.closeSync(descriptor)
    }
  }

  async remove(
    bucket: string,
    paths: string[]
  ): Promise<{ error?: Error }> {
    try {
      for (const filePath of paths) {
        const fullPath = this.resolvePath(bucket, filePath)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      }
      return {}
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Remove failed') }
    }
  }

  async getSignedUrl(
    bucket: string,
    filePath: string,
    expiresIn: number = 3600
  ): Promise<{ signedUrl: string; error?: Error }> {
    try {
      this.resolvePath(bucket, filePath)
      const expires = Date.now() + expiresIn * 1000
      const token = crypto
        .createHmac('sha256', process.env.STORAGE_SIGNING_KEY || 'local-dev-key')
        .update(`${bucket}/${filePath}:${expires}`)
        .digest('hex')

      const signedUrl = `/api/storage/${bucket}/${filePath}?token=${token}&expires=${expires}`
      return { signedUrl }
    } catch (err) {
      return {
        signedUrl: '',
        error: err instanceof Error ? err : new Error('Failed to create signed URL')
      }
    }
  }

  getPublicUrl(bucket: string, filePath: string): string {
    this.resolvePath(bucket, filePath)
    return `/api/storage/${bucket}/${filePath}`
  }

  async list(
    bucket: string,
    dirPath?: string
  ): Promise<{ data: StorageListItem[]; error?: Error }> {
    try {
      const fullPath = dirPath
        ? this.resolvePath(bucket, dirPath)
        : this.resolveBucketPath(bucket)

      if (!fs.existsSync(fullPath)) {
        return { data: [] }
      }

      const entries = fs.readdirSync(fullPath, { withFileTypes: true })
      const items: StorageListItem[] = entries
        .filter(entry => entry.isFile())
        .map(entry => {
          const stats = fs.statSync(path.join(fullPath, entry.name))
          return { name: entry.name, size: stats.size }
        })

      return { data: items }
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err : new Error('List failed')
      }
    }
  }
}
