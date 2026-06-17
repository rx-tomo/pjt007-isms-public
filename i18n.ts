import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';
import {routing} from '@/i18n/routing';

export default getRequestConfig(async ({locale}) => {
  // If locale is undefined, use default locale
  const currentLocale = locale || routing.defaultLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!routing.locales.includes(currentLocale as any)) {
    notFound();
  }

  return {
    locale: currentLocale,
    messages: (await import(`./messages/${currentLocale}.json`)).default,
    timeZone: 'Asia/Tokyo',
    now: new Date()
  };
});