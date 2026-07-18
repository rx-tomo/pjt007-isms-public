import * as fs from 'fs'
import * as path from 'path'

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
}

export function getStorageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export function resolveStorageRoutePath(pathSegments: string[], storageRoot: string): string | null {
  const root = path.resolve(storageRoot)
  const resolvedPath = path.resolve(root, ...pathSegments)
  const rootWithSeparator = `${root}${path.sep}`
  if (resolvedPath === root || !resolvedPath.startsWith(rootWithSeparator)) return null

  if (fs.existsSync(resolvedPath)) {
    const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root
    const realPath = fs.realpathSync(resolvedPath)
    const realRootWithSeparator = `${realRoot}${path.sep}`
    if (!realPath.startsWith(realRootWithSeparator)) return null
  }
  return resolvedPath
}

function createAsciiFileNameFallback(value: string): string {
  const extension = path.extname(value).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 9)
  const baseName = path.basename(value, path.extname(value))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '')
    .slice(0, 100)
  return `${baseName || 'download'}${extension}`
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ))
}

export function createStorageDownloadHeaders(
  filePath: string,
  downloadFileName: string = path.basename(filePath)
): Record<string, string> {
  const fileName = path.basename(downloadFileName).replace(/[\r\n\u0000]/g, '_') || 'download'
  const asciiFallback = createAsciiFileNameFallback(fileName)
  return {
    'Content-Type': getStorageMimeType(filePath),
    'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRfc5987Value(fileName)}`,
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  }
}
