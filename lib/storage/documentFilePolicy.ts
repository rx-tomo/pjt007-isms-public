import JSZip from 'jszip'
import {
  validateTaskAttachment,
  type TaskAttachmentValidationResult,
} from './taskAttachmentPolicy'
import { STORAGE_MAX_FILE_SIZE } from './storageLimits'

const LEGACY_OFFICE_EXTENSIONS = new Set(['.doc', '.xls'])

export function validateDocumentFile(
  fileName: string,
  mimeType: string
): TaskAttachmentValidationResult {
  const validation = validateTaskAttachment(fileName, mimeType)
  if (validation.ok && LEGACY_OFFICE_EXTENSIONS.has(validation.extension)) {
    return { ok: false, reason: 'unsupported_file_type' }
  }
  return validation
}

const BINARY_SIGNATURES: Partial<Record<string, readonly number[]>> = {
  '.pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  '.png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  '.jpg': [0xff, 0xd8, 0xff],
  '.jpeg': [0xff, 0xd8, 0xff],
  '.gif': [0x47, 0x49, 0x46, 0x38],
}

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const
const ZIP_MAX_ENTRIES = 1_024
const ZIP_MAX_ENTRY_UNCOMPRESSED_BYTES = STORAGE_MAX_FILE_SIZE
const ZIP_MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv'])

function startsWithSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.length >= signature.length
    && signature.every((value, index) => bytes[index] === value)
}

function hasKnownBinarySignature(bytes: Uint8Array): boolean {
  return startsWithSignature(bytes, OLE_SIGNATURE) || Object.values(BINARY_SIGNATURES).some(signature => (
    signature ? startsWithSignature(bytes, signature) : false
  ))
}

function readZipEntryCount(bytes: Uint8Array): number | null {
  const minimumOffset = Math.max(0, bytes.length - 65_557)
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      bytes[offset] === 0x50
      && bytes[offset + 1] === 0x4b
      && bytes[offset + 2] === 0x05
      && bytes[offset + 3] === 0x06
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset)
      const diskNumber = view.getUint16(4, true)
      const directoryDisk = view.getUint16(6, true)
      const diskEntries = view.getUint16(8, true)
      const totalEntries = view.getUint16(10, true)
      const directorySize = view.getUint32(12, true)
      const directoryOffset = view.getUint32(16, true)
      const commentLength = view.getUint16(20, true)
      if (
        diskNumber !== 0
        || directoryDisk !== 0
        || diskEntries !== totalEntries
        || totalEntries === 0xffff
        || directorySize === 0xffffffff
        || directoryOffset === 0xffffffff
        || offset + 22 + commentLength !== bytes.length
        || directoryOffset + directorySize > offset
      ) {
        return null
      }
      return totalEntries
    }
  }
  return null
}

function hasSafeZipShape(bytes: Uint8Array): boolean {
  const entryCount = readZipEntryCount(bytes)
  return entryCount !== null && entryCount > 0 && entryCount <= ZIP_MAX_ENTRIES
}

function hasSafeZipExpansion(zip: JSZip): boolean {
  const entries = Object.values(zip.files)
  if (entries.length === 0 || entries.length > ZIP_MAX_ENTRIES) return false

  let totalUncompressedBytes = 0
  for (const entry of entries) {
    if (entry.dir) continue
    const metadata = entry as unknown as {
      _data?: { uncompressedSize?: number }
      unsafeOriginalName?: string
    }
    const size = metadata._data?.uncompressedSize
    const originalName = metadata.unsafeOriginalName ?? entry.name
    if (
      !Number.isSafeInteger(size)
      || (size ?? -1) < 0
      || (size ?? 0) > ZIP_MAX_ENTRY_UNCOMPRESSED_BYTES
      || originalName.length > 512
      || originalName.split('/').some(segment => segment === '..')
    ) {
      return false
    }
    totalUncompressedBytes += size ?? 0
    if (totalUncompressedBytes > ZIP_MAX_TOTAL_UNCOMPRESSED_BYTES) return false
  }
  return true
}

function decodeStrictUtf8(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    for (const character of text) {
      const codePoint = character.codePointAt(0) ?? 0
      if (
        codePoint <= 0x08
        || codePoint === 0x0b
        || codePoint === 0x0c
        || (codePoint >= 0x0e && codePoint <= 0x1f)
        || codePoint === 0x7f
      ) {
        return null
      }
    }
    return text
  } catch {
    return null
  }
}

async function hasOoxmlPackageContent(
  zip: JSZip,
  mainPartPath: 'word/document.xml' | 'xl/workbook.xml',
  rootElement: 'document' | 'workbook'
): Promise<boolean> {
  const contentTypesEntry = zip.file('[Content_Types].xml')
  const mainPartEntry = zip.file(mainPartPath)
  if (!contentTypesEntry || !mainPartEntry) return false

  const [contentTypesBytes, mainPartBytes] = await Promise.all([
    contentTypesEntry.async('uint8array'),
    mainPartEntry.async('uint8array'),
  ])
  const contentTypes = decodeStrictUtf8(contentTypesBytes)
  const mainPart = decodeStrictUtf8(mainPartBytes)
  if (!contentTypes || !mainPart || !/<(?:[A-Za-z_][\w.-]*:)?Types(?:\s|\/?>)/.test(contentTypes)) {
    return false
  }
  return new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${rootElement}(?:\\s|/?>)`).test(mainPart)
}

export async function validateDocumentFileContent(
  file: Blob,
  extension: string
): Promise<boolean> {
  if (extension !== extension.toLowerCase() || !/^\.[a-z0-9]{1,8}$/.test(extension)) {
    return false
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length > STORAGE_MAX_FILE_SIZE) return false
  if (LEGACY_OFFICE_EXTENSIONS.has(extension)) return false
  const signature = BINARY_SIGNATURES[extension]
  if (signature) {
    if (!startsWithSignature(bytes, signature)) return false
    if (extension === '.gif') {
      return bytes.length >= 6
        && (bytes[4] === 0x37 || bytes[4] === 0x39)
        && bytes[5] === 0x61
    }
    return true
  }

  if (extension === '.zip' || extension === '.docx' || extension === '.xlsx') {
    if (!hasSafeZipShape(bytes)) return false
    try {
      const zip = await JSZip.loadAsync(bytes)
      if (!hasSafeZipExpansion(zip)) return false
      if (extension === '.zip') return true
      return extension === '.docx'
        ? hasOoxmlPackageContent(zip, 'word/document.xml', 'document')
        : hasOoxmlPackageContent(zip, 'xl/workbook.xml', 'workbook')
    } catch {
      return false
    }
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return !hasKnownBinarySignature(bytes) && decodeStrictUtf8(bytes) !== null
  }
  if (extension === '.json') {
    const text = decodeStrictUtf8(bytes)
    if (text === null) return false
    try {
      JSON.parse(text)
      return true
    } catch {
      return false
    }
  }
  return false
}

export function isGenericDocumentStoragePathDenied(
  pathSegments: readonly string[] | null | undefined
): boolean {
  return pathSegments?.[0] === 'documents'
}

export function createDocumentStoragePath(
  organizationId: string,
  documentId: string,
  extension: string,
  generateId: () => string = () => globalThis.crypto.randomUUID()
): string {
  if (!/^\.[a-z0-9]{1,8}$/.test(extension)) {
    throw new Error('Invalid document file extension')
  }
  return `${organizationId}/documents/${documentId}/${generateId()}${extension}`
}

export function isDocumentStoragePath(
  filePath: string,
  organizationId: string,
  documentId: string
): boolean {
  const prefix = `${organizationId}/documents/${documentId}/`
  if (!filePath.startsWith(prefix)) return false
  const fileName = filePath.slice(prefix.length)
  return Boolean(
    fileName
    && fileName !== '.'
    && fileName !== '..'
    && !fileName.includes('/')
    && !fileName.includes('\\')
    && /^[a-zA-Z0-9._-]+$/.test(fileName)
  )
}
