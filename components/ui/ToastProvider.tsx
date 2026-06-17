'use client'

import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import WindowToast from '@/components/ui/WindowToast'

type ToastVariant = 'success' | 'error' | 'info'

export interface ToastOptions {
  message: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  pushToast: (options: ToastOptions) => string
  dismissToast: (id: string) => void
}

interface ToastEntry extends Required<ToastOptions> {
  id: string
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 5000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    ({ message, variant = 'info', duration }: ToastOptions) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `toast_${Date.now()}_${Math.random()}`
      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          variant,
          duration: duration ?? (variant === 'error' ? 0 : DEFAULT_DURATION)
        }
      ])
      return id
    },
    []
  )

  const contextValue = useMemo(
    () => ({
      pushToast,
      dismissToast
    }),
    [pushToast, dismissToast]
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.map((toast, index) => (
        <WindowToast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          offsetTop={16 + index * 84}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
