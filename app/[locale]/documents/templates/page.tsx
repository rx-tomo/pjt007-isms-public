'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DocumentService,
  type DocumentFolder,
  type DocumentTemplate
} from '@/lib/services/document'
import { UserService } from '@/lib/services/user'

type CategoryFilter = 'all' | 'policy' | 'procedure' | 'form' | 'checklist'

interface TemplateFormState {
  title: string
  folderId: string
}

interface ToastState {
  type: 'success' | 'error'
  message: string
}

interface TemplateErrorState {
  message: string
}

export default function TemplatesPage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('documents.templates')
  const tDocuments = useTranslations('documents.errors')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const documentService = useMemo(() => new DocumentService(), [])
  const userService = useMemo(() => new UserService(), [])

  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [formError, setFormError] = useState<TemplateErrorState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [formState, setFormState] = useState<TemplateFormState>({
    title: '',
    folderId: ''
  })

  const loadResources = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const profile = await userService.getCurrentUser()
      if (!profile?.organization_id) {
        setError(tDocuments('organizationMissing'))
        setIsLoading(false)
        return
      }

      setOrganizationId(profile.organization_id)

      const [templateRows, folderRows] = await Promise.all([
        documentService.getTemplates(locale === 'en' ? 'en' : 'ja'),
        documentService.getFolders(profile.organization_id)
      ])

      setTemplates(templateRows)
      setFolders(folderRows)
    } catch (err) {
      console.error('Failed to load document templates', err)
      setError(t('errors.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [documentService, locale, t, tDocuments, userService])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  useEffect(() => {
    if (!toast) return

    const timeout = setTimeout(() => {
      setToast(null)
    }, 4000)

    return () => clearTimeout(timeout)
  }, [toast])

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') {
      return templates
    }

    return templates.filter(template => template.category === categoryFilter)
  }, [categoryFilter, templates])

  const handleOpenModal = (template: DocumentTemplate) => {
    setFormError(null)
    setFormState({
      title: template.name,
      folderId: ''
    })
    setSelectedTemplate(template)
  }

  const handleCloseModal = () => {
    setSelectedTemplate(null)
    setFormError(null)
    setIsSubmitting(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTemplate || !organizationId) return

    const trimmedTitle = formState.title.trim()
    if (!trimmedTitle) {
      setFormError({ message: t('modal.errorTitleRequired') })
      return
    }

    if (trimmedTitle.length > 120) {
      setFormError({ message: tDocuments('validationFailed') })
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    try {
      await documentService.createFromTemplate(organizationId, selectedTemplate.id, {
        title: trimmedTitle,
        folderId: formState.folderId || null
      })

      setToast({
        type: 'success',
        message: t('toast.success')
      })

      handleCloseModal()
      router.push(`/${locale}/documents?created=template`)
    } catch (err: any) {
      console.error('Failed to create document from template', err)
      setFormError({
        message: err?.message || t('toast.error')
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderCategoryButton = (category: CategoryFilter) => {
    const isActive = categoryFilter === category
    const label =
      category === 'all'
        ? t('filters.all')
        : t(`categories.${category}` as const)

    return (
      <button
        key={category}
        type="button"
        onClick={() => setCategoryFilter(category)}
        className={`px-4 py-2 rounded-md transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
        <p className="text-sm text-text-secondary">{t('description')}</p>
      </div>

      {toast && (
        <div
          role="status"
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 flex flex-wrap gap-2">
        {(['all', 'policy', 'procedure', 'form', 'checklist'] as CategoryFilter[]).map(
          renderCategoryButton
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-sm text-text-muted">
          {tCommon('loading')}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface-elevated text-sm text-text-muted">
          {t('empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map(template => (
            <article
              key={template.id}
              className="flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-text-primary">{template.name}</h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      template.category === 'policy'
                        ? 'bg-indigo-100 text-indigo-700'
                        : template.category === 'procedure'
                        ? 'bg-emerald-100 text-emerald-700'
                        : template.category === 'form'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {t(`categories.${template.category}` as const)}
                  </span>
                </div>
                {template.description && (
                  <p className="text-sm text-text-secondary">{template.description}</p>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-text-muted">
                <span>
                  {template.iso_reference
                    ? t('isoReference', { value: template.iso_reference })
                    : t('isoReferenceUnknown')}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenModal(template)}
                  className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
                >
                  {t('useTemplate')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-10">
        <Link
          href={`/${locale}/documents`}
          className="inline-flex items-center text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
        >
          ← {t('backToDocuments')}
        </Link>
      </div>

      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 px-4 py-6 sm:items-center sm:p-0">
          <div className="relative w-full max-w-lg overflow-hidden rounded-lg bg-surface shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-text-primary">{t('modal.title')}</h3>
                <p className="text-sm text-text-secondary">
                  {t('modal.templateLabel', { name: selectedTemplate.name })}
                </p>
              </div>

              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError.message}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="template-title" className="block text-sm font-medium text-text-secondary">
                  {t('modal.documentTitle')}
                </label>
                <input
                  id="template-title"
                  name="title"
                  type="text"
                  value={formState.title}
                  onChange={event =>
                    setFormState(prev => ({ ...prev, title: event.target.value }))
                  }
                  maxLength={120}
                  required
                  className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="template-folder" className="block text-sm font-medium text-text-secondary">
                  {t('modal.folderLabel')}
                </label>
                <select
                  id="template-folder"
                  name="folder"
                  value={formState.folderId}
                  onChange={event =>
                    setFormState(prev => ({ ...prev, folderId: event.target.value }))
                  }
                  className="w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('modal.folderPlaceholder')}</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="inline-flex justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-elevated"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {isSubmitting ? t('modal.submitting') : t('modal.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
