'use client'

import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  DocumentService,
  type DocumentFolder,
  type DocumentTemplate
} from '@/lib/services/document'
import { UserService } from '@/lib/services/user'
import RichTextEditor from '@/components/documents/RichTextEditor'
import {
  clearDocumentDraft,
  listDocumentDrafts,
  saveDocumentDraft,
  type DocumentDraftPayload,
  type DocumentDraftRecord
} from '@/lib/utils/documentDraftStorage'

const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 500
const MAX_CONTENT_LENGTH = 4000

interface DocumentFormState {
  title: string
  description: string
  category: string
  content: string
  folderId: string
}

type SubmitAction = 'draft' | 'in_review'

interface ToastState {
  type: 'success' | 'error'
  message: string
}

export default function NewDocumentPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('documents')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState<DocumentFormState>({
    title: '',
    description: '',
    category: 'policy',
    content: '',
    folderId: ''
  })
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [draftCandidate, setDraftCandidate] = useState<DocumentDraftRecord | null>(null)
  const [draftOptions, setDraftOptions] = useState<DocumentDraftRecord[]>([])
  const [draftSelectionId, setDraftSelectionId] = useState<string | null>(null)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const selectedTemplate = useMemo(
    () => templates.find(template => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  )

  const documentService = useMemo(() => new DocumentService(), [])
  const userService = useMemo(() => new UserService(), [])
  const previewLabels = useMemo(
    () => ({
      edit: t('editor.preview.edit'),
      live: t('editor.preview.live'),
      preview: t('editor.preview.preview')
    }),
    [t]
  )
  const draftTimer = useRef<NodeJS.Timeout | null>(null)
  const templateParam = searchParams.get('templateId')

  const refreshDrafts = useCallback(
    (orgId: string, preferredId?: string) => {
      const drafts = listDocumentDrafts(orgId)
      setDraftOptions(drafts)
      if (drafts.length === 0) {
        setDraftCandidate(null)
        setDraftSelectionId(null)
        return
      }

      const targetId = preferredId ?? drafts[0].id
      const nextCandidate = drafts.find(draft => draft.id === targetId) ?? drafts[0]
      setDraftSelectionId(nextCandidate.id)
      setDraftCandidate(nextCandidate)
    },
    []
  )

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true)
    setTemplateError(null)

    try {
      const rows = await documentService.getTemplates(locale === 'en' ? 'en' : 'ja')
      setTemplates(rows)
    } catch (error) {
      console.error('Failed to load document templates', error)
      setTemplateError(t('editor.templateLoadError'))
    } finally {
      setTemplateLoading(false)
    }
  }, [documentService, locale, t])

  const applyTemplate = useCallback((template: DocumentTemplate) => {
    setSelectedTemplateId(template.id)
    setFormData(prev => ({
      ...prev,
      title: template.name,
      description: template.description ?? prev.description,
      category: template.category ?? prev.category,
      content: template.content_template ?? prev.content
    }))
  }, [])

  const loadInitialData = useCallback(async () => {
    setIsLoading(true)
    setToast(null)

    try {
      const profile = await userService.getUserProfile()

      if (!profile?.organization_id) {
        setToast({ type: 'error', message: t('errors.organizationMissing') })
        return
      }

      setOrganizationId(profile.organization_id)
      refreshDrafts(profile.organization_id)

      const folderList = await documentService.getFolders(profile.organization_id)
      setFolders(folderList)
    } catch (error) {
      console.error('Failed to load initial data', error)
      setToast({ type: 'error', message: t('errors.loadFailed') })
    } finally {
      setIsLoading(false)
    }
  }, [documentService, refreshDrafts, t, userService])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!templateParam || templates.length === 0) return
    if (selectedTemplateId === templateParam) return

    const matched = templates.find(template => template.id === templateParam)
    if (matched) {
      applyTemplate(matched)
    }
  }, [templateParam, templates, applyTemplate, selectedTemplateId])

  useEffect(() => {
    if (!organizationId) return
    const isBlank = !formData.title && !formData.description && !formData.content
    if (isBlank) return

    if (draftTimer.current) {
      clearTimeout(draftTimer.current)
    }

    draftTimer.current = setTimeout(() => {
      const record = saveDocumentDraft(organizationId, {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        folderId: formData.folderId,
        content: formData.content,
        templateId: selectedTemplateId ?? null
      }, currentDraftId ?? undefined)
      setCurrentDraftId(record.id)
      refreshDrafts(organizationId, record.id)
    }, 800)

    return () => {
      if (draftTimer.current) {
        clearTimeout(draftTimer.current)
      }
    }
  }, [currentDraftId, formData, organizationId, refreshDrafts, selectedTemplateId])

  const handleChange = <K extends keyof DocumentFormState>(field: K, value: DocumentFormState[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleContentChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      content: value.slice(0, MAX_CONTENT_LENGTH)
    }))
  }

  const handleRestoreDraft = () => {
    if (!draftSelectionId || !organizationId) return
    const selectedDraft = draftOptions.find(draft => draft.id === draftSelectionId)
    if (!selectedDraft) return

    setFormData({
      title: selectedDraft.title,
      description: selectedDraft.description,
      category: selectedDraft.category,
      content: selectedDraft.content,
      folderId: selectedDraft.folderId
    })
    setSelectedTemplateId(selectedDraft.templateId ?? null)
    setCurrentDraftId(selectedDraft.id)
    clearDocumentDraft(organizationId, selectedDraft.id)
    refreshDrafts(organizationId)
  }

  const handleDiscardDraft = () => {
    if (!organizationId || !draftSelectionId) return
    clearDocumentDraft(organizationId, draftSelectionId)
    if (currentDraftId === draftSelectionId) {
      setCurrentDraftId(null)
    }
    refreshDrafts(organizationId)
  }

  const handleClearTemplateSelection = () => {
    setSelectedTemplateId(null)
  }

  const handleSubmit = async (
    event: React.MouseEvent<HTMLButtonElement>,
    action: SubmitAction
  ) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!organizationId) {
      setToast({ type: 'error', message: t('errors.organizationMissing') })
      return
    }

    if (!formData.title.trim()) {
      setToast({ type: 'error', message: t('errors.titleRequired') })
      return
    }

    if (!formData.content.trim()) {
      setToast({ type: 'error', message: t('errors.contentRequired') })
      return
    }

    if (
      formData.title.length > MAX_TITLE_LENGTH ||
      formData.description.length > MAX_DESCRIPTION_LENGTH ||
      formData.content.length > MAX_CONTENT_LENGTH
    ) {
      setToast({ type: 'error', message: t('errors.validationFailed') })
      return
    }

    setIsSubmitting(true)
    setToast(null)

    try {
      await documentService.createDocumentFromContent(organizationId, {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        folderId: formData.folderId || null,
        status: action,
        content: formData.content,
        language: locale === 'en' ? 'en' : 'ja'
      })

      const successMessage =
        action === 'draft' ? t('messages.draftSaved') : t('messages.submittedForReview')

      setToast({ type: 'success', message: successMessage })

      clearDocumentDraft(organizationId)
      refreshDrafts(organizationId)
      setCurrentDraftId(null)

      setTimeout(() => {
        router.push(`/${locale}/documents`)
      }, 1200)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.createFailed')
      setToast({ type: 'error', message })
      setIsSubmitting(false)
    }
  }

  const remainingTitle = MAX_TITLE_LENGTH - formData.title.length
  const remainingDescription = MAX_DESCRIPTION_LENGTH - formData.description.length
  const remainingContent = MAX_CONTENT_LENGTH - formData.content.length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-2">{t('editor.title')}</h1>
        <p className="text-text-secondary">{t('create_new')}</p>
      </div>

      {toast && (
        <div
          role="status"
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      {draftCandidate && (
        <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p>
              {t('editor.draftBanner', {
                updatedAt: draftCandidate.updatedAt
                  ? new Date(draftCandidate.updatedAt).toLocaleString()
                  : t('editor.draftBannerTimestampMissing')
              })}
            </p>
            <div className="flex items-center gap-2">
              {draftOptions.length > 1 && (
                <label className="flex flex-col text-xs text-yellow-900">
                  {t('editor.draftSelectionLabel')}
                  <select
                    className="mt-1 rounded border border-yellow-500 bg-surface px-2 py-1 text-xs"
                    value={draftSelectionId ?? ''}
                    onChange={event => {
                      const nextId = event.target.value
                      setDraftSelectionId(nextId)
                      const nextDraft = draftOptions.find(draft => draft.id === nextId)
                      setDraftCandidate(nextDraft ?? null)
                    }}
                  >
                    {draftOptions.map(draft => (
                      <option key={draft.id} value={draft.id}>
                        {draft.title || t('editor.draftUntitledFallback')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-md border border-yellow-500 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-800 transition hover:bg-yellow-200"
              >
                {t('editor.draftActions.restore')}
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-md border border-transparent bg-yellow-800/10 px-3 py-1 text-xs font-semibold text-yellow-900 transition hover:bg-yellow-900/10"
              >
                {t('editor.draftActions.discard')}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t('editor.templatePanelTitle')}
            </p>
            <p className="text-xs text-text-muted">
              {t('editor.templatePanelDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={loadTemplates}
            className="text-xs font-medium text-indigo-600 transition hover:text-indigo-800"
          >
            {t('editor.templateRefresh')}
          </button>
        </div>

        <div className="mt-4">
          {templateLoading ? (
            <p className="text-xs text-text-muted">{t('editor.templateLoading')}</p>
          ) : templateError ? (
            <p className="text-xs text-red-500">{templateError}</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-text-muted">{t('editor.templateEmpty')}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map(template => (
                <article
                  key={template.id}
                  className={`flex flex-col gap-3 rounded-lg border p-4 transition ${
                    selectedTemplateId === template.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <h3 className="text-base font-semibold text-text-primary">{template.name}</h3>
                    {template.category && (
                      <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-text-secondary">
                        {t(
                          `filter.${template.category}` as const
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {template.description || t('editor.templateDescriptionFallback')}
                  </p>
                  <button
                    type="button"
                    onClick={() => applyTemplate(template)}
                    disabled={selectedTemplateId === template.id}
                    className="mt-auto inline-flex items-center justify-center rounded-md border border-indigo-600 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white disabled:cursor-not-allowed disabled:border-border disabled:text-text-muted"
                  >
                    {selectedTemplateId === template.id
                      ? t('editor.templateSelected')
                      : t('editor.templateLoad')}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedTemplate && (
        <div className="mb-4 flex flex-wrap items-center justify-between rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800">
          <p>
            {t('editor.templateSelectedMessage', { name: selectedTemplate.name })}
          </p>
          <button
            type="button"
            onClick={handleClearTemplateSelection}
            className="text-xs font-semibold text-indigo-700 underline"
          >
            {t('editor.templateClear')}
          </button>
        </div>
      )}

      <form className="bg-surface rounded-lg shadow p-6" aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-text-secondary mb-2">
              {t('editor.document_title')}
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(event) => handleChange('title', event.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              required
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-text-muted" aria-live="polite">
              {t('form.remaining', { count: remainingTitle })}
            </p>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.category')}
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(event) => handleChange('category', event.target.value)}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="policy">{t('filter.policy')}</option>
              <option value="procedure">{t('filter.procedure')}</option>
              <option value="template">{t('filter.template')}</option>
              <option value="record">{t('filter.record')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="folder" className="block text-sm font-medium text-text-secondary mb-2">
              {t('form.folder')}
            </label>
            <select
              id="folder"
              value={formData.folderId}
              onChange={(event) => handleChange('folderId', event.target.value)}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('form.folderPlaceholder')}</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            {isLoading && (
              <p className="mt-1 text-xs text-text-muted" aria-live="polite">
                {t('form.loadingFolders')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-2">
              {t('editor.description')}
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(event) => handleChange('description', event.target.value)}
              rows={3}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-text-muted" aria-live="polite">
              {t('form.remaining', { count: remainingDescription })}
            </p>
          </div>

          <RichTextEditor
            id="content"
            label={t('editor.content')}
            value={formData.content}
            onChange={handleContentChange}
            placeholder={t('form.contentPlaceholder')}
            helperText={t('editor.helper')}
            remainingText={t('form.remaining', { count: remainingContent })}
            disabled={isSubmitting}
            previewLabels={previewLabels}
          />
        </fieldset>

        <div className="mt-6 flex gap-3 justify-end">
          <Link
            href={`/${locale}/documents`}
            className="px-4 py-2 border border-border rounded-md hover:bg-surface-elevated transition-colors"
          >
            {t('editor.cancel')}
          </Link>
          <button
            type="button"
            onClick={(event) => handleSubmit(event, 'draft')}
            disabled={isSubmitting}
            className="px-4 py-2 border border-border rounded-md hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            {isSubmitting ? t('form.saving') : t('editor.save_draft')}
          </button>
          <button
            type="button"
            onClick={(event) => handleSubmit(event, 'in_review')}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? t('form.submitting') : t('editor.submit_review')}
          </button>
        </div>
      </form>
    </div>
  )
}
