import { isDocumentStoragePath } from '@/lib/storage/documentFilePolicy'

export function projectDocumentStoragePath(
  filePath: string | null | undefined,
  organizationId: string,
  documentId: string
): string | null {
  return filePath && isDocumentStoragePath(filePath, organizationId, documentId)
    ? filePath
    : null
}

export function projectDocumentTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 100)
}
