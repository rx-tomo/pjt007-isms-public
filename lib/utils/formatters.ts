import { format, parseISO } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';

/**
 * 日付をフォーマット
 */
export function formatDate(
  date: string | Date,
  formatStr: string = 'yyyy/MM/dd',
  locale: string = 'ja'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const localeObj = locale === 'ja' ? ja : enUS;

  return format(dateObj, formatStr, { locale: localeObj });
}

/**
 * 数値を通貨形式でフォーマット
 */
export function formatCurrency(
  amount: number,
  currency: string = 'JPY',
  locale: string = 'ja-JP'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * 電話番号をフォーマット
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // 数字以外を削除
  const cleaned = phoneNumber.replace(/\D/g, '');

  // 日本の電話番号形式
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }

  return phoneNumber;
}