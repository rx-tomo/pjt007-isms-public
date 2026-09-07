'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { PublicDemoCatalog, PublicDemoPersona } from '@/lib/demo/contract'
import { PUBLIC_REPOSITORY_ISSUES_URL, PUBLIC_REPOSITORY_URL } from '@/lib/publicLinks'

export default function DevLoginClient() {
  const t = useTranslations('devLogin')
  const tCommon = useTranslations('common')
  const params = useParams<{ locale: string }>()
  const router = useRouter()
  const [catalog, setCatalog] = useState<PublicDemoCatalog | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scenarios = useMemo(() => catalog?.scenarios ?? [], [catalog])
  const translate = useCallback((key: string, fallback = 'title') => (
    t.has(key) ? t(key as never) : t(fallback as never)
  ), [t])

  useEffect(() => {
    let cancelled = false
    async function loadPersonas() {
      try {
        const response = await fetch('/api/demo/personas', { cache: 'no-store', credentials: 'same-origin' })
        if (!response.ok) throw new Error(translate('catalogLoadError', 'userSelector.loadError'))
        const payload = await response.json() as PublicDemoCatalog
        if (cancelled) return
        setCatalog(payload)
        setStatus('ready')
      } catch (loadError) {
        if (cancelled) return
        setStatus('error')
        setError(loadError instanceof Error ? loadError.message : translate('catalogLoadError', 'userSelector.loadError'))
      }
    }
    void loadPersonas()
    return () => { cancelled = true }
  }, [translate])

  async function login(persona: PublicDemoPersona) {
    setError(null)
    setActivePersonaId(persona.personaId)
    try {
      const response = await fetch('/api/demo-auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ personaId: persona.personaId }),
      })
      const payload = await response.json().catch(() => null) as { message?: unknown; error?: unknown } | null
      if (!response.ok) {
        const message = payload?.message ?? payload?.error
        throw new Error(typeof message === 'string' ? message : translate('loginError', 'userSelector.loadError'))
      }
      router.push(`/${params.locale}${persona.redirectPath}`)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : translate('loginError', 'userSelector.loadError'))
      setActivePersonaId(null)
    }
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{t('devOnlyFeature')}</span>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="text-3xl font-semibold text-text-primary">{t('title')}</h1><p className="mt-2 max-w-3xl text-sm text-text-secondary">{t('description')}</p></div>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <a href={PUBLIC_REPOSITORY_URL} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-500">{t('publicLinks.source')}</a>
              <a href={PUBLIC_REPOSITORY_ISSUES_URL} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-500">{t('publicLinks.feedback')}</a>
              <Link href={`/${params.locale}/auth/login`} className="text-text-secondary hover:text-blue-500">{t('backToLogin')}</Link>
            </div>
          </div>
        </header>
        <section className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-950"><h2 className="font-semibold">{t('publicNotice.title')}</h2><p className="mt-1 leading-6">{t('publicNotice.body')}</p></section>
        <section className="space-y-4">
          <div><h2 className="text-lg font-semibold text-text-primary">{translate('personas.title', 'selectRole')}</h2><p className="mt-1 text-sm text-text-secondary">{translate('personas.description', 'description')}</p></div>
          {status === 'loading' && <div className="rounded-xl border border-border bg-surface px-5 py-4 text-sm text-text-secondary">{tCommon('loading')}</div>}
          {status === 'error' && error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
          {status === 'ready' && scenarios.length === 0 && <div className="rounded-xl border border-border bg-surface px-5 py-4 text-sm text-text-secondary">{translate('empty', 'selectRole')}</div>}
          <div className="space-y-6" data-testid="dev-login-persona-list">
            {scenarios.map(scenario => <article key={scenario.scenarioId} data-testid={`dev-login-scenario-${scenario.scenarioId}`} data-availability={scenario.availability} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <header className="border-b border-border bg-slate-50 px-5 py-4"><h3 className="text-base font-semibold text-text-primary">{scenario.title}</h3><div className="mt-2 flex gap-4 text-xs text-text-secondary"><span>{scenario.phase}</span><span>{scenario.plan}</span></div></header>
              {scenario.availability === 'unavailable' ? <p className="p-4 text-sm text-amber-700">{scenario.unavailableReason}</p> : <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">{scenario.personas.map(persona => {
                const isActive = activePersonaId === persona.personaId
                return <button key={persona.personaId} type="button" onClick={() => void login(persona)} disabled={activePersonaId !== null} data-demo-role={persona.role} data-testid={`dev-login-persona-${persona.personaId}`} className="flex min-h-36 flex-col justify-between rounded-lg border border-border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-wait disabled:opacity-60">
                  <span><span className="block text-sm font-semibold text-text-primary">{persona.displayName}</span><span className="mt-1 block text-xs font-medium text-blue-700">{translate(persona.labelKey)}</span><span className="mt-2 block text-xs leading-5 text-text-secondary">{translate(persona.descriptionKey, 'description')}</span></span><span className="mt-4 text-sm font-medium text-blue-600">{isActive ? translate('loggingIn') : translate('login')}</span>
                </button>
              })}</div>}
            </article>)}
          </div>
          {error && status === 'ready' && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
        </section>
      </div>
    </main>
  )
}
