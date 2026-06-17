'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IsoControlService, type ControlTemplate, type IsoControl } from '@/lib/services/isoControl'
import { useToast } from '@/components/ui/ToastProvider'

type SeedMode = 'insert' | 'restore' | 'overwrite'

interface ControlTemplateWizardProps {
  open: boolean
  locale: string
  organizationId: string
  existingControls: Map<string, IsoControl>
  onClose: () => void
  onSeeded: () => Promise<void> | void
}

export function ControlTemplateWizard({
  open,
  locale,
  organizationId,
  existingControls,
  onClose,
  onSeeded
}: ControlTemplateWizardProps) {
  const isoControlService = useMemo(() => new IsoControlService(), [])
  const t = useTranslations('settings.controls.wizard')
  const { pushToast } = useToast()
  const [templates, setTemplates] = useState<ControlTemplate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<SeedMode>('insert')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set())
      setSearch('')
      setMode('insert')
      return
    }
    setIsLoading(true)
    isoControlService
      .getControlTemplates(locale)
      .then(data => setTemplates(data))
      .catch(err => {
        console.error('Failed to load templates', err)
        pushToast({ message: t('errors.loadFailed'), variant: 'error', duration: 0 })
      })
      .finally(() => setIsLoading(false))
  }, [open, locale, isoControlService, pushToast, t])

  if (!open) {
    return null
  }

  const filteredTemplates = templates.filter(template => {
    if (!search.trim()) return true
    const keyword = search.trim().toLowerCase()
    return (
      template.title.toLowerCase().includes(keyword) ||
      (template.description ?? '').toLowerCase().includes(keyword) ||
      (template.control_code ?? '').toLowerCase().includes(keyword) ||
      template.category.toLowerCase().includes(keyword)
    )
  })

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      pushToast({ message: t('errors.selectOne'), variant: 'error' })
      return
    }
    setIsSubmitting(true)
    const selectedTemplates = templates.filter(template => selectedIds.has(template.id))
    let created = 0
    let updated = 0
    try {
      for (const template of selectedTemplates) {
        const existing = template.template_key ? existingControls.get(template.template_key) : null
        const payload = {
          organization_id: organizationId,
          category: template.category,
          title: template.title,
          control_code: template.control_code ?? null,
          description: template.description ?? null,
          tags: template.default_tags ?? [],
          template_key: template.template_key
        }

        if (mode === 'overwrite' && existing) {
          await isoControlService.updateControl(existing.id, {
            category: payload.category,
            title: payload.title,
            control_code: payload.control_code ?? undefined,
            description: payload.description ?? undefined,
            tags: payload.tags ?? undefined,
            template_key: payload.template_key ?? undefined
          })
          updated += 1
        } else if (!existing) {
          await isoControlService.createControl(payload)
          created += 1
        }
      }

      pushToast({
        message:
          mode === 'overwrite'
            ? t('messages.successOverwrite', { created, updated })
            : t('messages.successInsert', { created }),
        variant: 'success'
      })
      await onSeeded()
      onClose()
    } catch (err) {
      console.error('Failed to seed controls', err)
      pushToast({ message: t('errors.seedFailed'), variant: 'error', duration: 0 })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderModeLabel = (value: SeedMode) => {
    return t(`modes.${value}` as const)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4 py-8">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{t('title')}</h2>
            <p className="text-sm text-text-muted">{t('description')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text-secondary"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 md:max-w-sm"
            />
            <div className="flex gap-3 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {t('badges.existing')}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border">
            {isLoading ? (
              <div className="p-6 text-sm text-text-muted">{t('states.loading')}</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-6 text-sm text-text-muted">{t('states.empty')}</div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredTemplates.map(template => {
                  const exists = template.template_key ? existingControls.has(template.template_key) : false
                  const selected = selectedIds.has(template.id)
                  return (
                    <li
                      key={template.id}
                      className={`flex items-start gap-4 px-4 py-3 ${exists ? 'bg-emerald-50/40' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelection(template.id)}
                        className="mt-1 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text-primary">{template.title}</p>
                          {exists && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                              {t('badges.existing')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">
                          {template.control_code || template.annex_reference} ・ {template.category}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary whitespace-pre-line">
                          {template.description}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-4 text-sm text-indigo-900">
            <p className="font-semibold mb-2">{t('modeSection.title')}</p>
            <div className="flex flex-col gap-2">
              {(['insert', 'restore', 'overwrite'] as SeedMode[]).map(value => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="seed-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="h-4 w-4 border-border text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">{renderModeLabel(value)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border bg-surface-elevated px-6 py-4">
          <span className="text-sm text-text-muted">
            {t('selectedLabel', { count: selectedIds.size })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface"
              disabled={isSubmitting}
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedIds.size === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? t('actions.applying') : t('actions.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
