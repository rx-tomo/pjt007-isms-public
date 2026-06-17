'use client'

import { useEffect, useMemo, use } from 'react';
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SettingsClientWrapper from '@/components/settings/SettingsToastGate'
import { SettingsNav, type SettingsNavItem } from '@/components/settings/SettingsNav'

interface SettingsLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default function SettingsLayout(props: SettingsLayoutProps) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const {
    children
  } = props;

  const t = useTranslations('settings')
  const pathname = usePathname()
  const router = useRouter()

  const isAdminOnlySettingsPath = useMemo(() => {
    const pathWithoutLocale = pathname.replace(/^\/(ja|en|zh)(?=\/)/, '')
    return [
      '/settings/assets',
      '/settings/controls',
      '/settings/structure',
      '/settings/users'
    ].some((path) => pathWithoutLocale === path || pathWithoutLocale.startsWith(`${path}/`))
  }, [pathname])

  useEffect(() => {
    if (!isAdminOnlySettingsPath) return

    let isActive = true
    ;(async () => {
      try {
        const response = await fetch('/api/auth/profile', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store'
        })

        if (!isActive) return

        if (response.status === 401 || response.status === 404) {
          router.replace(`/${locale}/auth/login`)
          return
        }

        if (!response.ok) {
          router.replace(`/${locale}/home`)
          return
        }

        const body = await response.json()
        const role = body?.profile?.role
        if (!['system_operator', 'org_admin'].includes(role)) {
          router.replace(`/${locale}/home`)
        }
      } catch {
        if (isActive) {
          router.replace(`/${locale}/home`)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [isAdminOnlySettingsPath, locale, router])

  const navigationItems: SettingsNavItem[] = [
    {
      name: t('tabs.profile'),
      href: `/${locale}/settings/profile`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      name: t('tabs.organization'),
      href: `/${locale}/settings/organization`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      name: t('tabs.assets'),
      href: `/${locale}/settings/assets`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm4 0v12m8-12v12M4 10h16M4 14h16"
          />
        </svg>
      )
    },
    {
      name: t('tabs.users'),
      href: `/${locale}/settings/users`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      name: t('tabs.controls'),
      href: `/${locale}/settings/controls`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3l7 4v5c0 5.25-3.5 9.75-7 10-3.5-.25-7-4.75-7-10V7l7-4z"
          />
        </svg>
      )
    },
    {
      name: t('tabs.subscription') || t('organization.fields.subscription') || 'Subscription',
      href: `/${locale}/settings/subscription`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      name: t('tabs.notifications') || 'Notifications',
      href: `/${locale}/settings/notifications`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    },
    {
      name: t('tabs.ai'),
      href: `/${locale}/settings/ai`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    },
    {
      name: t('tabs.structure'),
      href: `/${locale}/settings/structure`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    }
  ]

  return (
    <SettingsClientWrapper>
      <DashboardLayout locale={locale}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary">{t('title')}</h1>
          </div>

          <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
            <aside className="lg:col-span-3">
              <SettingsNav items={navigationItems} />
            </aside>

            <main className="lg:col-span-9">{children}</main>
          </div>
        </div>
      </DashboardLayout>
    </SettingsClientWrapper>
  )
}
