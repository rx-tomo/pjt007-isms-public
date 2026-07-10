import fixtures from './practical-document-bodies.json'

export type PracticalDocumentFixture = {
  fileName: string
  virtualPath: string
  mimeType: string
  size: number
  body: string
}

const practicalDocumentFixtures = fixtures as Record<string, PracticalDocumentFixture>

export function getPracticalDocumentFixture(documentId: string) {
  return practicalDocumentFixtures[documentId] ?? null
}

export function hydratePracticalDocumentFile<T extends {
  id: string
  file_name?: string | null
  file_path?: string | null
  file_size?: number | null
  mime_type?: string | null
}>(document: T): T {
  if (document.file_path) return document
  const fixture = getPracticalDocumentFixture(document.id)
  if (!fixture) return document

  return {
    ...document,
    file_name: document.file_name ?? fixture.fileName,
    file_path: fixture.virtualPath,
    file_size: document.file_size ?? fixture.size,
    mime_type: document.mime_type ?? fixture.mimeType
  }
}
