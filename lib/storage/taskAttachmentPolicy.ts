import { STORAGE_MAX_FILE_SIZE } from './storageLimits'

const TASK_ATTACHMENT_MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
  '.json': ['application/json'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
}

export type TaskAttachmentValidationResult =
  | { ok: true; extension: string; displayName: string; mimeType: string }
  | { ok: false; reason: 'invalid_file_name' | 'unsupported_file_type' }

export const TASK_ATTACHMENT_MULTIPART_OVERHEAD_BYTES = 1024 * 1024

export function getTaskAttachmentMaxFileSize(): number {
  const configured = Number(process.env.TASK_ATTACHMENT_MAX_FILE_SIZE_BYTES)
  if (Number.isSafeInteger(configured) && configured > 0) {
    return Math.min(configured, STORAGE_MAX_FILE_SIZE)
  }
  return STORAGE_MAX_FILE_SIZE
}

export function isTaskAttachmentSizeAllowed(fileSize: number): boolean {
  return Number.isSafeInteger(fileSize)
    && fileSize >= 0
    && fileSize <= getTaskAttachmentMaxFileSize()
}

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase()
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex > -1 ? normalized.slice(dotIndex) : ''
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';', 1)[0].trim()
}

export function normalizeTaskAttachmentDisplayName(fileName: string): string | null {
  const segments = fileName.replace(/\\/g, '/').split('/')
  const baseName = segments.at(-1)?.replace(/[\u0000-\u001f\u007f]/g, '').trim() ?? ''
  if (!baseName || baseName === '.' || baseName === '..') return null
  return baseName.slice(0, 180)
}

export function validateTaskAttachment(
  fileName: string,
  mimeType: string
): TaskAttachmentValidationResult {
  const displayName = normalizeTaskAttachmentDisplayName(fileName)
  if (!displayName) return { ok: false, reason: 'invalid_file_name' }

  const extension = getFileExtension(displayName)
  const allowedMimeTypes = TASK_ATTACHMENT_MIME_BY_EXTENSION[extension]
  const normalizedMimeType = normalizeMimeType(mimeType)
  if (!allowedMimeTypes || !allowedMimeTypes.includes(normalizedMimeType)) {
    return { ok: false, reason: 'unsupported_file_type' }
  }

  return {
    ok: true,
    extension,
    displayName,
    mimeType: normalizedMimeType,
  }
}

export function createTaskAttachmentStoragePath(
  organizationId: string,
  taskId: string,
  extension: string,
  generateId: () => string = () => globalThis.crypto.randomUUID()
): string {
  if (!organizationId || !taskId || [organizationId, taskId].some(value => (
    value.includes('/') || value.includes('\\') || value === '.' || value === '..'
  ))) {
    throw new Error('Invalid task attachment owner')
  }
  if (!/^\.[a-z0-9]{1,8}$/.test(extension)) {
    throw new Error('Invalid task attachment extension')
  }
  return `${organizationId}/tasks/${taskId}/${generateId()}${extension}`
}

export function isTaskAttachmentStoragePath(
  filePath: string,
  organizationId: string,
  taskId: string
): boolean {
  const prefix = `${organizationId}/tasks/${taskId}/`
  if (!filePath.startsWith(prefix)) return false
  const fileName = filePath.slice(prefix.length)
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.[a-z0-9]{1,8}$/.test(fileName)
}
