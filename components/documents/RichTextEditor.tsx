'use client'

import { useId, useState } from 'react'
import dynamic from 'next/dynamic'

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-md bg-surface-elevated" /> }
)

type PreviewMode = 'edit' | 'live' | 'preview'

interface PreviewLabels {
  edit: string
  live: string
  preview: string
}

interface RichTextEditorProps {
  id?: string
  label: string
  value: string
  placeholder?: string
  helperText?: string
  remainingText?: string
  error?: string | null
  disabled?: boolean
  onChange: (value: string) => void
  previewLabels: PreviewLabels
}

export default function RichTextEditor({
  id,
  label,
  value,
  placeholder,
  helperText,
  remainingText,
  error,
  disabled = false,
  onChange,
  previewLabels
}: RichTextEditorProps) {
  const fallbackId = useId()
  const fieldId = id ?? `rich-text-${fallbackId}`
  const helperId = helperText ? `${fieldId}-helper` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const [mode, setMode] = useState<PreviewMode>('live')

  const previewModes: Array<{ value: PreviewMode; label: string }> = [
    { value: 'edit', label: previewLabels.edit },
    { value: 'live', label: previewLabels.live },
    { value: 'preview', label: previewLabels.preview }
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={fieldId} className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {previewModes.map((item, index) => {
            const isActive = mode === item.value
            const roundedClass =
              index === 0
                ? 'rounded-l-md'
                : index === previewModes.length - 1
                  ? 'rounded-r-md'
                  : ''

            return (
              <button
                key={item.value}
                type="button"
                disabled={disabled}
                onClick={() => setMode(item.value)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${roundedClass} ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-text-secondary hover:bg-surface-elevated'
                } ${disabled ? 'opacity-60' : ''}`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        data-color-mode="light"
        className={`rounded-lg border bg-surface shadow-sm focus-within:ring-2 ${
          error
            ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100'
            : 'border-border focus-within:border-indigo-300 focus-within:ring-indigo-50'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <MDEditor
          id={fieldId}
          value={value}
          onChange={(val) => onChange(val ?? '')}
          height={420}
          visibleDragbar={false}
          textareaProps={{
            placeholder,
            'aria-describedby': [helperId, errorId].filter(Boolean).join(' ') || undefined,
            disabled
          }}
          preview={mode}
          commandsFilter={(command) => (command.name === 'image' ? false : command)}
        />
      </div>

      {(helperText || remainingText || error) && (
        <div className="flex flex-wrap items-center gap-x-4 text-xs">
          {helperText && (
            <p id={helperId} className="text-text-muted">
              {helperText}
            </p>
          )}
          {remainingText && (
            <p className="text-text-muted" aria-live="polite">
              {remainingText}
            </p>
          )}
          {error && (
            <p id={errorId} className="text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
