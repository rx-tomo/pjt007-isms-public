'use client'

interface StatusFilterBannerProps {
  label: string
  clearLabel: string
  onClear: () => void
  className?: string
}

export function StatusFilterBanner({ label, clearLabel, onClear, className }: StatusFilterBannerProps) {
  if (!label) {
    return null
  }

  return (
    <div
      className={[
        'flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="font-medium">
        {label}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 rounded-full border border-blue-200 px-3 py-1 font-semibold text-blue-700 transition hover:bg-surface"
      >
        {clearLabel}
      </button>
    </div>
  )
}
