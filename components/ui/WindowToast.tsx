'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastVariant = 'success' | 'error' | 'info'

interface WindowToastProps {
  message: string | null
  variant?: ToastVariant
  duration?: number
  onDismiss?: () => void
  offsetTop?: number
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-border bg-surface text-text-primary'
}

export default function WindowToast({
  message,
  variant = 'info',
  duration = 5000,
  onDismiss,
  offsetTop = 16
}: WindowToastProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }

    setVisible(true)
    if (!duration) {
      return
    }

    const timer = window.setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, duration)

    return () => window.clearTimeout(timer)
  }, [message, duration, onDismiss])

  if (!isMounted || !message || !visible) {
    return null
  }

  const role = variant === 'error' ? 'alert' : 'status'

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ top: Math.max(0, offsetTop) }}
    >
      <div
        role={role}
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
        data-testid="window-toast"
        className={`pointer-events-auto flex max-w-3xl items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition ${variantStyles[variant]}`}
      >
        <div className="flex-1 text-sm leading-6">{message}</div>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            onDismiss?.()
          }}
          className="rounded-md p-1 text-current transition hover:bg-surface/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="sr-only">Close</span>
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l8 8m0-8l-8 8" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  )
}
