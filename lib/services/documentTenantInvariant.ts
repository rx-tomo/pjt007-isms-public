import { and, eq } from 'drizzle-orm'
import { documentFolders } from '@/lib/db/drizzle/schema/documents'
import type { DrizzleDb } from '@/lib/db/drizzle/client'
import type {
  DocumentInsert,
  DocumentUpdate,
} from '@/lib/db/repositories/interfaces/IDocumentRepository'

export class DocumentTenantInvariantError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message)
    this.name = 'DocumentTenantInvariantError'
  }
}

export function isDocumentTenantInvariantError(
  error: unknown
): error is DocumentTenantInvariantError {
  return error instanceof DocumentTenantInvariantError
}

const CREATE_FIELDS = new Set([
  'organization_id',
  'title',
  'description',
  'category',
  'folder_id',
  'tags',
  'retention_delete_at',
  'status',
])

const UPDATE_FIELDS = new Set([
  'title',
  'description',
  'category',
  'folder_id',
  'tags',
  'retention_delete_at',
])

const DOCUMENT_TITLE_MAX_LENGTH = 200
const DOCUMENT_DESCRIPTION_MAX_LENGTH = 10_000
const DOCUMENT_CATEGORY_MAX_LENGTH = 100
const DOCUMENT_TAG_MAX_COUNT = 20
const DOCUMENT_TAG_MAX_LENGTH = 64

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DocumentTenantInvariantError(400, 'Invalid document payload')
  }
}

function assertAllowedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>
): void {
  if (Object.keys(value).some(key => !allowed.has(key))) {
    throw new DocumentTenantInvariantError(400, 'Unsupported document field')
  }
}

function parseRequiredTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DocumentTenantInvariantError(400, 'Document title is required')
  }
  const title = value.trim()
  if (title.length > DOCUMENT_TITLE_MAX_LENGTH) {
    throw new DocumentTenantInvariantError(400, 'Document title is too long')
  }
  return title
}

function parseOptionalTitle(value: unknown): string | undefined {
  if (value === undefined) return undefined
  return parseRequiredTitle(value)
}

function parseNullableString(
  value: unknown,
  field: string,
  maxLength: number
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new DocumentTenantInvariantError(400, `Invalid ${field}`)
  }
  const normalized = value.trim()
  if (normalized.length > maxLength) {
    throw new DocumentTenantInvariantError(400, `${field} is too long`)
  }
  return normalized || null
}

function parseTags(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!Array.isArray(value) || value.some(tag => typeof tag !== 'string')) {
    throw new DocumentTenantInvariantError(400, 'Invalid tags')
  }
  const tags = [...new Set(value.map(tag => tag.trim()).filter(Boolean))]
  if (
    tags.length > DOCUMENT_TAG_MAX_COUNT
    || tags.some(tag => tag.length > DOCUMENT_TAG_MAX_LENGTH)
  ) {
    throw new DocumentTenantInvariantError(400, 'Invalid tags')
  }
  return tags
}

function parseCreateStatus(value: unknown): 'draft' {
  if (value !== undefined && value !== 'draft') {
    throw new DocumentTenantInvariantError(400, 'Invalid document status')
  }
  return 'draft'
}

export function normalizeDocumentCreateInput(
  value: unknown,
  organizationId: string,
  actorId: string
): DocumentInsert {
  assertPlainObject(value)
  assertAllowedFields(value, CREATE_FIELDS)
  if (value.organization_id !== organizationId) {
    throw new DocumentTenantInvariantError(404, 'Document not found')
  }

  return {
    organization_id: organizationId,
    title: parseRequiredTitle(value.title),
    description: parseNullableString(
      value.description,
      'description',
      DOCUMENT_DESCRIPTION_MAX_LENGTH
    ) ?? null,
    category: parseNullableString(
      value.category,
      'category',
      DOCUMENT_CATEGORY_MAX_LENGTH
    ) ?? null,
    folder_id: parseNullableString(value.folder_id, 'folder_id', 128) ?? null,
    tags: parseTags(value.tags) ?? null,
    retention_delete_at: parseNullableString(
      value.retention_delete_at,
      'retention_delete_at',
      64
    ) ?? null,
    status: parseCreateStatus(value.status),
    created_by: actorId,
    updated_by: actorId,
    approved_by: null,
    approved_at: null,
    file_name: null,
    file_path: null,
    file_size: null,
    mime_type: null,
    version_number: 1,
  }
}

export function normalizeDocumentUpdateInput(value: unknown): DocumentUpdate {
  assertPlainObject(value)
  assertAllowedFields(value, UPDATE_FIELDS)

  const updates: DocumentUpdate = {}
  const title = parseOptionalTitle(value.title)
  const description = parseNullableString(
    value.description,
    'description',
    DOCUMENT_DESCRIPTION_MAX_LENGTH
  )
  const category = parseNullableString(
    value.category,
    'category',
    DOCUMENT_CATEGORY_MAX_LENGTH
  )
  const folderId = parseNullableString(value.folder_id, 'folder_id', 128)
  const tags = parseTags(value.tags)
  const retentionDeleteAt = parseNullableString(
    value.retention_delete_at,
    'retention_delete_at',
    64
  )

  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (category !== undefined) updates.category = category
  if (folderId !== undefined) updates.folder_id = folderId
  if (tags !== undefined) updates.tags = tags
  if (retentionDeleteAt !== undefined) updates.retention_delete_at = retentionDeleteAt
  return updates
}

export async function assertDocumentFolderBelongsToOrganization(
  db: DrizzleDb,
  organizationId: string,
  folderId: string | null | undefined
): Promise<void> {
  if (!folderId) return
  const [folder] = await db
    .select({ id: documentFolders.id })
    .from(documentFolders)
    .where(and(
      eq(documentFolders.id, folderId),
      eq(documentFolders.organizationId, organizationId)
    ))
    .limit(1)
  if (!folder) {
    throw new DocumentTenantInvariantError(404, 'Document folder not found')
  }
}
