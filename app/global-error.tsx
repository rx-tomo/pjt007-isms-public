'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// This component renders outside the [locale] layout, so next-intl context is
// unavailable. Display all three supported languages in a simple stacked layout.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error.digest ?? error.message)
  }, [error])

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f8fafc',
          color: '#111827',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 480, width: '100%' }}>
          {/* Icon */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              marginBottom: '1.5rem',
            }}
          >
            <svg
              width={32}
              height={32}
              fill="none"
              stroke="#9ca3af"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Title — all three languages */}
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              lineHeight: 1.4,
            }}
          >
            {/* ja */ }アプリケーションエラー
            <br />
            <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 400 }}>
              {/* en */}Application Error /{/* zh */} 应用程序错误
            </span>
          </h1>

          {/* Description */}
          <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            致命的なエラーが発生しました。ページを再読み込みしてください。
            <br />
            <span style={{ color: '#6b7280' }}>
              A critical error occurred. Please reload the page. / 发生了严重错误。请重新加载页面。
            </span>
          </p>

          {/* Reload button */}
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <svg
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            再読み込み / Reload / 重新加载
          </button>
        </div>
      </body>
    </html>
  )
}
