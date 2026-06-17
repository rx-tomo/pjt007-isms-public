'use client'

import { ToastProvider } from '@/components/ui/ToastProvider'

export default function SettingsToastGate({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
