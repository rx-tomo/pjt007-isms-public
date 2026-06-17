'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { PhaseHistoryEntry } from '@/lib/services/onboarding'

type PhaseLabelKey = `${PhaseHistoryEntry['phase']}.label`
type SourceLabelKey = `sources.${PhaseHistoryEntry['source']}`

interface Props {
  history: PhaseHistoryEntry[]
  locale: string
}

function formatTimestamp(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch (err) {
    console.warn('[ISMSPhaseHistory] Failed to format timestamp', err)
    return value
  }
}

function buildActorLabel(entry: PhaseHistoryEntry) {
  if (entry.changedBy?.name) {
    return entry.changedBy.name
  }
  if (entry.changedBy?.email) {
    return entry.changedBy.email
  }
  return null
}

export default function ISMSPhaseHistory({ history, locale }: Props) {
  const tHistory = useTranslations('settings.organization.phaseHistory')
  const tPhase = useTranslations('settings.organization.phase.options')

  const items = useMemo(() => history.slice(0, 12), [history])

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{tHistory('title')}</h3>
          <p className="text-sm text-text-secondary">{tHistory('description')}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {tHistory('count', { total: items.length })}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface-elevated p-4 text-sm text-text-muted">
          {tHistory('empty')}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map(entry => {
            const actor = buildActorLabel(entry)
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {tPhase(`${entry.phase}.label` as PhaseLabelKey)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatTimestamp(entry.recordedAt, locale)}
                    {actor ? ` · ${actor}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-medium text-text-secondary">
                  {tHistory(`sources.${entry.source}` as SourceLabelKey)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
