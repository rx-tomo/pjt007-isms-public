import Link from 'next/link'

// This not-found renders outside [locale] layout (e.g. /unknown-path with no
// locale prefix). next-intl context is unavailable here, so use defaultLocale
// (ja) and display a minimal redirect prompt.
export default function RootNotFound() {
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
        <div style={{ maxWidth: 400, width: '100%' }}>
          <p
            style={{
              fontSize: '4rem',
              fontWeight: 700,
              color: '#9ca3af',
              margin: '0 0 1rem',
              lineHeight: 1,
            }}
          >
            404
          </p>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            ページが見つかりません
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
            Page not found / 页面未找到
          </p>
          <Link
            href="/ja/home"
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.25rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            ホームへ / Home
          </Link>
        </div>
      </body>
    </html>
  )
}
