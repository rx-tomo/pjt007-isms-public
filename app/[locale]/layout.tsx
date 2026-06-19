import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { Suspense } from 'react';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import { routing } from '@/i18n/routing';
import LocaleProvider from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastProvider } from '@/components/ui/ToastProvider';
import '../globals.css';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

const gtmDisabled = process.env.NEXT_PUBLIC_GTM_ENABLED === 'false';
const gtmId = gtmDisabled
  ? null
  : process.env.NEXT_PUBLIC_GTM_ID?.match(/^GTM-[A-Z0-9]+$/)?.[0] ?? null;
const gaMeasurementId = gtmId
  ? null
  : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.match(/^G-[A-Z0-9]+$/)?.[0] ?? null;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const { locale } = params;

  // Ensure that the incoming locale is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);

  // Providing all messages to the client side is the easiest way to get started
  const messages = await getMessages();
  const themeInitScript = `
    (function() {
      try {
        var theme = window.localStorage.getItem('isms-theme') || 'light';
        var root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.classList.toggle('theme-liquid-glass', theme === 'liquid-glass');
      } catch (e) {}
    })();
  `;

  // GAP-008: <html> は本レイアウトが所有し、SSR時点で lang を出力する（next-intl標準構成）
  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${notoSansJP.variable}`}>
      <body suppressHydrationWarning>
        {gtmId && (
          <Script
            id="google-tag-manager"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${gtmId}');
              `,
            }}
          />
        )}
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        {gaMeasurementId && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            strategy="afterInteractive"
          />
        )}
        {gaMeasurementId && (
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}');
              `,
            }}
          />
        )}
        <LocaleProvider locale={locale}>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          <NextIntlClientProvider messages={messages}>
            <ThemeProvider>
              <ToastProvider>
                <Suspense>
                  {children}
                </Suspense>
              </ToastProvider>
            </ThemeProvider>
          </NextIntlClientProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
