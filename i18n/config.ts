export const locales = ['ja', 'en', 'zh'] as const;
export const defaultLocale = 'ja' as const;

export type Locale = (typeof locales)[number];