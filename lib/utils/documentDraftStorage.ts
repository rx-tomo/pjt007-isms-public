export interface DocumentDraftPayload {
  title: string
  description: string
  category: string
  folderId: string
  content: string
  templateId?: string | null
}

export interface DocumentDraftRecord extends DocumentDraftPayload {
  id: string
  organizationId: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'isms-document-editor-draft'
const MAX_DRAFTS_PER_ORG = 5

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type DraftStore = {
  version: 2
  drafts: Record<string, DocumentDraftRecord>
}

const getStorage = (): StorageLike | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage as StorageLike
  }

  return null
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const parseStore = (raw: string): DraftStore | null => {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.version === 2 && parsed.drafts) {
      return parsed as DraftStore
    }

    // Legacy single-draft payload
    if (isRecord(parsed) && 'title' in parsed && 'content' in parsed) {
      const migratedId = crypto?.randomUUID ? crypto.randomUUID() : `legacy-${Date.now()}`
      const now = new Date().toISOString()
      const record: DocumentDraftRecord = {
        id: migratedId,
        organizationId: 'legacy',
        title: String(parsed.title ?? ''),
        description: String(parsed.description ?? ''),
        category: String(parsed.category ?? 'policy'),
        folderId: String(parsed.folderId ?? ''),
        content: String(parsed.content ?? ''),
        templateId: (parsed.templateId as string | null) ?? null,
        createdAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : now,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : now,
      }

      return {
        version: 2,
        drafts: {
          [migratedId]: record,
        },
      }
    }
  } catch (error) {
    console.error('Failed to parse document draft store', error)
  }
  return null
}

const readStore = (): DraftStore => {
  const storage = getStorage()
  if (!storage) {
    return { version: 2, drafts: {} }
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) {
    return { version: 2, drafts: {} }
  }

  const parsed = parseStore(raw)
  if (!parsed) {
    storage.removeItem(STORAGE_KEY)
    return { version: 2, drafts: {} }
  }

  if (parsed.drafts.legacy) {
    storage.removeItem(STORAGE_KEY)
  }

  return parsed
}

const writeStore = (store: DraftStore) => {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (error) {
    console.error('Failed to persist document drafts', error)
  }
}

const persistStore = (mutator: (drafts: DraftStore) => DraftStore) => {
  const current = readStore()
  const next = mutator(current)
  writeStore(next)
  return next
}

const ensureId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `draft-${Date.now()}`

const trimOrgDrafts = (drafts: DraftStore, organizationId: string) => {
  const orgDrafts = Object.values(drafts.drafts)
    .filter(draft => draft.organizationId === organizationId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

  if (orgDrafts.length <= MAX_DRAFTS_PER_ORG) {
    return
  }

  const idsToRemove = orgDrafts.slice(MAX_DRAFTS_PER_ORG).map(draft => draft.id)
  idsToRemove.forEach(id => {
    delete drafts.drafts[id]
  })
}

export const listDocumentDrafts = (organizationId: string): DocumentDraftRecord[] => {
  const store = readStore()
  return Object.values(store.drafts)
    .filter(draft => draft.organizationId === organizationId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export const loadDocumentDraft = (organizationId: string, draftId?: string): DocumentDraftRecord | null => {
  const drafts = listDocumentDrafts(organizationId)
  if (draftId) {
    return drafts.find(draft => draft.id === draftId) ?? null
  }
  return drafts[0] ?? null
}

export const saveDocumentDraft = (
  organizationId: string,
  payload: DocumentDraftPayload,
  draftId?: string
): DocumentDraftRecord => {
  const now = new Date().toISOString()
  let record: DocumentDraftRecord | null = null

  const updatedStore = persistStore(store => {
    const nextStore: DraftStore = { ...store, drafts: { ...store.drafts } }
    const id = draftId ?? ensureId()
    const existing = nextStore.drafts[id]

    record = {
      id,
      organizationId,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      folderId: payload.folderId,
      content: payload.content,
      templateId: payload.templateId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    nextStore.drafts[id] = record
    trimOrgDrafts(nextStore, organizationId)
    return nextStore
  })

  if (!record) {
    throw new Error('Failed to persist draft record')
  }

  return record
}

export const clearDocumentDraft = (organizationId: string, draftId?: string): void => {
  persistStore(store => {
    if (!draftId) {
      const nextStore: DraftStore = { ...store, drafts: { ...store.drafts } }
      Object.keys(nextStore.drafts).forEach(key => {
        if (nextStore.drafts[key].organizationId === organizationId) {
          delete nextStore.drafts[key]
        }
      })
      return nextStore
    }

    const nextStore: DraftStore = { ...store, drafts: { ...store.drafts } }
    if (nextStore.drafts[draftId]?.organizationId === organizationId) {
      delete nextStore.drafts[draftId]
    }
    return nextStore
  })
}
