'use client'

import { Component, ReactNode } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback onReset={() => this.setState({ hasError: false })} />
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  onReset: () => void
}

function DefaultErrorFallback({ onReset }: ErrorFallbackProps) {
  const handleGoBack = () => {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/ja/home'
    }
  }

  const handleRetry = () => {
    onReset()
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-app flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
              エラーが発生しました
            </h2>
            <p className="mt-2 text-center text-sm text-text-secondary">
              予期しないエラーが発生しました。しばらく時間をおいてから再度お試しください。
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <button
              onClick={handleGoBack}
              className="w-full flex justify-center py-2 px-4 border border-border rounded-md shadow-sm bg-surface text-sm font-medium text-text-secondary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              前のページに戻る
            </button>

            <button
              onClick={handleRetry}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              再試行
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface text-text-muted">問題が続く場合</span>
              </div>
            </div>
            <div className="mt-4 text-center text-xs text-text-muted">
              ブラウザを再読み込みするか、システム管理者にお問い合わせください
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ErrorBoundary
