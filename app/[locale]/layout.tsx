import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
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
