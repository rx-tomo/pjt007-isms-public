'use client'

import { useTranslations } from 'next-intl'
import type { IsmsPhase } from '@/lib/services/onboarding'

interface PhaseSelectionDialogProps {
  open: boolean
  selectedPhase: IsmsPhase | ''
  onSelect: (phase: IsmsPhase) => void
  onSubmit: () => void
  loading?: boolean
  error?: string | null
}

const phaseOptions: { value: IsmsPhase; icon: string }[] = [
  { value: 'initial', icon: '🌱' },
  { value: 'surveillance', icon: '♻️' }
]

export default function PhaseSelectionDialog({
  open,
  selectedPhase,
  onSelect,
  onSubmit,
  loading = false,
  error
}: PhaseSelectionDialogProps) {
  const t = useTranslations('home.phaseWizard')

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6">
      <div data-testid="phase-selection-dialog" className="w-full max-w-xl rounded-3xl bg-surface p-6 shadow-2xl">
        <div className="space-y-2 text-center">
          <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {t('badge')}
          </span>
          <h2 className="text-2xl font-semibold text-text-primary">{t('title')}</h2>
          <p className="text-sm text-text-secondary">{t('description')}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {phaseOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`flex h-full flex-col rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                selectedPhase === option.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-border bg-surface hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {option.icon}
                </span>
                <div>
                  <p className="text-base font-semibold text-text-primary">{t(`${option.value}.label`)}</p>
                  <p className="text-xs text-text-secondary">{t(`${option.value}.description`)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <div className="mt-6">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!selectedPhase || loading}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? t('submitting') : t('submit')}
          </button>
          <p className="mt-3 text-center text-xs text-text-muted">{t('helper')}</p>
        </div>
      </div>
    </div>
  )
}
