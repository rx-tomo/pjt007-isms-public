'use client';

import { useEffect } from 'react';

interface LocaleProviderProps {
  locale: string;
  children: React.ReactNode;
}

export default function LocaleProvider({ locale, children }: LocaleProviderProps) {
  useEffect(() => {
    // Set the lang attribute on the html element
    document.documentElement.lang = locale;

    // Set font class based on locale
    if (locale === 'ja') {
      document.body.className = 'font-noto-sans-jp';
    } else {
      document.body.className = 'font-sans';
    }
  }, [locale]);

  return <>{children}</>;
}