import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import InviteAcceptForm from './InviteAcceptForm'

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'authInvite' })

  return {
    title: t('title'),
    description: t('description')
  }
}

export default async function InvitePage(
  props: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const {
    locale
  } = params;

  setRequestLocale(locale)
  const tokenParam = searchParams?.token
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam ?? null

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-surface">
        <InviteAcceptForm token={token} locale={locale} />
      </div>
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700">
          <div className="absolute inset-0 bg-black opacity-20"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-12">
          <div className="max-w-md">
            <h2 className="text-4xl font-bold mb-6">ISMS Pilot</h2>
            <p className="text-xl mb-8 text-blue-100">
              ISO27001認証取得を効率的にサポートする<br />
              クラウドベースの統合管理システム
            </p>
            <div className="space-y-4">
              <div className="flex items-start">
                <svg className="w-6 h-6 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>文書管理・バージョン管理</span>
              </div>
              <div className="flex items-start">
                <svg className="w-6 h-6 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>リスクアセスメント＆対策管理</span>
              </div>
              <div className="flex items-start">
                <svg className="w-6 h-6 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>監査準備＆進捗管理</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
