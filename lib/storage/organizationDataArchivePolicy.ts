import JSZip from 'jszip'
import { STORAGE_MAX_FILE_SIZE } from './storageLimits'
import {
  hasSafeZipExpansion,
  hasSafeZipShape,
} from './documentFilePolicy'

export const ORGANIZATION_DATA_MAX_COMPRESSED_BYTES = Math.min(
  STORAGE_MAX_FILE_SIZE,
  10 * 1024 * 1024
)
export const ORGANIZATION_DATA_MAX_ENTRIES = 32
export const ORGANIZATION_DATA_MAX_ENTRY_UNCOMPRESSED_BYTES = 5 * 1024 * 1024
export const ORGANIZATION_DATA_MAX_TOTAL_UNCOMPRESSED_BYTES = 20 * 1024 * 1024

export const ORGANIZATION_DATA_CSV_LIMITS = {
  strictColumnCount: true,
  strictQuoteSyntax: true,
  maxRows: 10_000,
  maxColumns: 64,
  maxTotalCells: 200_000,
  maxCellLength: 16_384,
} as const

export class OrganizationDataArchivePolicyError extends Error {
  constructor(message = 'Invalid or oversized organization data archive') {
    super(message)
    this.name = 'OrganizationDataArchivePolicyError'
  }
}

export type OrganizationDataArchiveReadBudget = {
  totalUncompressedBytes: number
}

export function createOrganizationDataArchiveReadBudget(): OrganizationDataArchiveReadBudget {
  return { totalUncompressedBytes: 0 }
}

export async function loadOrganizationDataArchive(file: Blob): Promise<JSZip> {
  if (file.size <= 0 || file.size > ORGANIZATION_DATA_MAX_COMPRESSED_BYTES) {
    throw new OrganizationDataArchivePolicyError()
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasSafeZipShape(bytes, ORGANIZATION_DATA_MAX_ENTRIES)) {
    throw new OrganizationDataArchivePolicyError()
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    throw new OrganizationDataArchivePolicyError()
  }

  if (!hasSafeZipExpansion(zip, {
    maxEntries: ORGANIZATION_DATA_MAX_ENTRIES,
    maxEntryUncompressedBytes: ORGANIZATION_DATA_MAX_ENTRY_UNCOMPRESSED_BYTES,
    maxTotalUncompressedBytes: ORGANIZATION_DATA_MAX_TOTAL_UNCOMPRESSED_BYTES,
  })) {
    throw new OrganizationDataArchivePolicyError()
  }

  return zip
}

export async function readOrganizationDataArchiveEntry(
  zip: JSZip,
  filename: string,
  budget: OrganizationDataArchiveReadBudget
): Promise<ArrayBuffer | null> {
  const entry = zip.file(filename)
  if (!entry) return null

  const chunks: Uint8Array[] = []
  let entryBytes = 0
  const stream = entry.nodeStream('nodebuffer') as NodeJS.ReadableStream
    & AsyncIterable<Buffer>
    & { destroy(error?: Error): void }

  try {
    for await (const chunk of stream) {
      entryBytes += chunk.byteLength
      budget.totalUncompressedBytes += chunk.byteLength
      if (
        entryBytes > ORGANIZATION_DATA_MAX_ENTRY_UNCOMPRESSED_BYTES
        || budget.totalUncompressedBytes > ORGANIZATION_DATA_MAX_TOTAL_UNCOMPRESSED_BYTES
      ) {
        stream.destroy(new OrganizationDataArchivePolicyError())
        throw new OrganizationDataArchivePolicyError()
      }
      chunks.push(new Uint8Array(chunk))
    }
  } catch (error) {
    if (error instanceof OrganizationDataArchivePolicyError) throw error
    throw new OrganizationDataArchivePolicyError()
  }

  const output = new Uint8Array(entryBytes)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output.buffer
}
