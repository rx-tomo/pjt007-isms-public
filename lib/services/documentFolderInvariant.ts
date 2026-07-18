import type {
  DocumentFolderCreatePayload,
  DocumentFolderUpdatePayload,
} from '@/lib/db/repositories/interfaces/IDocumentRepository'
import { DocumentTenantInvariantError } from '@/lib/services/documentTenantInvariant'

const FOLDER_NAME_MAX_LENGTH = 100
const FOLDER_ID_MAX_LENGTH = 128

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DocumentTenantInvariantError(400, 'Invalid document folder payload')
  }
}

function assertAllowedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>
): void {
  if (Object.keys(value).some(key => !allowed.has(key))) {
    throw new DocumentTenantInvariantError(400, 'Unsupported document folder field')
  }
}

function parseFolderName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new DocumentTenantInvariantError(400, 'Document folder name is required')
  }
  const name = value.trim()
  if (
    !name
    || name.length > FOLDER_NAME_MAX_LENGTH
    || name.includes('/')
    || name.includes('\\')
    || [...name].some(character => (character.codePointAt(0) ?? 0) < 0x20)
  ) {
    throw new DocumentTenantInvariantError(400, 'Invalid document folder name')
  }
  return name
}

function parseParentId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') {
    throw new DocumentTenantInvariantError(400, 'Invalid parent folder')
  }
  const parentId = value.trim()
  if (!parentId || parentId.length > FOLDER_ID_MAX_LENGTH) {
    throw new DocumentTenantInvariantError(400, 'Invalid parent folder')
  }
  return parentId
}

export function normalizeDocumentFolderCreateInput(
  value: unknown
): DocumentFolderCreatePayload {
  assertPlainObject(value)
  assertAllowedFields(value, new Set(['name', 'parentId']))
  return {
    name: parseFolderName(value.name),
    parentId: parseParentId(value.parentId),
  }
}

export function normalizeDocumentFolderUpdateInput(
  value: unknown
): DocumentFolderUpdatePayload {
  assertPlainObject(value)
  assertAllowedFields(value, new Set(['name', 'parentId']))
  const payload: DocumentFolderUpdatePayload = {}
  if (value.name !== undefined) payload.name = parseFolderName(value.name)
  if (value.parentId !== undefined) payload.parentId = parseParentId(value.parentId)
  if (Object.keys(payload).length === 0) {
    throw new DocumentTenantInvariantError(400, 'No document folder changes provided')
  }
  return payload
}
