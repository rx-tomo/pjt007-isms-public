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
import type { IStorageProvider, StorageUploadOptions, StorageListItem } from './IStorageProvider'

const STORAGE_ROOT = path.join(process.cwd(), '.storage')

export class LocalFSStorageProvider implements IStorageProvider {
  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }

  private resolvePath(bucket: string, filePath: string): string {
    return path.join(STORAGE_ROOT, bucket, filePath)
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
    filePath: string
  ): Promise<{ data: Blob | null; error?: Error }> {
    try {
      const fullPath = this.resolvePath(bucket, filePath)

      if (!fs.existsSync(fullPath)) {
        return { data: null, error: new Error('File not found') }
      }

      const buffer = fs.readFileSync(fullPath)
      const blob = new Blob([buffer])
      return { data: blob }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Download failed')
      }
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
    return `/api/storage/${bucket}/${filePath}`
  }

  async list(
    bucket: string,
    dirPath?: string
  ): Promise<{ data: StorageListItem[]; error?: Error }> {
    try {
      const fullPath = dirPath
        ? this.resolvePath(bucket, dirPath)
        : path.join(STORAGE_ROOT, bucket)

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
