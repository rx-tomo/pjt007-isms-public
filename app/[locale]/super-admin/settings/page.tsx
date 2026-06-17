'use client'

import { useMemo, use } from 'react';
import { useTranslations } from 'next-intl'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SuperAdminHealthPanel from '@/components/super-admin/SuperAdminHealthPanel'
import { useSuperAdminHealth } from '@/lib/hooks/useSuperAdminHealth'

interface PageProps {
  params: Promise<{ locale: string }>
}

interface SettingsSectionItem {
  title: string
  body: string
}

interface SettingsSection {
  title: string
  items: SettingsSectionItem[]
}

export default function SuperAdminSettingsPage(props: PageProps) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations('superAdmin.organizations.settings')
  const sections = useMemo(() => {
    const rawSections = t.raw('sections') as Record<string, SettingsSection>
    return Object.entries(rawSections).map(([key, value]) => ({
      key,
      ...value
    }))
  }, [t])
  const { health } = useSuperAdminHealth()

  const content = (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-600">{t('badge')}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="max-w-3xl text-sm text-slate-600">{t('description')}</p>
      </div>

      {health && (
        <SuperAdminHealthPanel health={health} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.key} className="rounded-2xl border border-slate-200 bg-surface shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {section.items.map((item) => (
                <div key={`${section.key}-${item.title}`} className="px-6 py-4">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )

  return (
    <DashboardLayout locale={locale}>
      {content}
    </DashboardLayout>
  )
}
