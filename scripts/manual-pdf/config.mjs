/**
 * Manual PDF 生成 — 設定定数
 */
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ── デザイントークン ──────────────────────────
export const COLORS = {
  primary600: '#2563eb',
  primary700: '#1d4ed8',
  primary50:  '#eff6ff',
  foreground: '#111827',
  muted:      '#6b7280',
  border:     '#e5e7eb',
  background: '#f8fafc',
  white:      '#ffffff',
  // blockquote: hint (blue)
  hintBg:     '#eff6ff',
  hintBorder: '#2563eb',
  // blockquote: wip (yellow)
  wipBg:      '#fef3c7',
  wipBorder:  '#b45309',
  wipText:    '#92400e',
};

// ── フォント ────────────────────────────────
export const FONTS = {
  sansJa:  "'Noto Sans JP', sans-serif",
  sansEn:  "'Inter', system-ui, sans-serif",
  mono:    "'SF Mono', Monaco, Menlo, 'Courier New', monospace",
};

// ── PDF オプション ──────────────────────────
export const PDF_OPTIONS = {
  format: 'A4',
  margin: { top: '25mm', bottom: '20mm', left: '15mm', right: '15mm' },
  printBackground: true,
  displayHeaderFooter: true,
  preferCSSPageSize: false,
};

// ── セクション定義 ──────────────────────────
export const SECTIONS = {
  '00-common':       '共通操作',
  '01-user-approver': 'ユーザー/承認者',
  '02-org-admin':    '組織管理者',
  '03-auditor':      '監査員',
  '04-super-admin':  'スーパー管理者',
};

// ── パス定数 ────────────────────────────────
export const PATHS = {
  root:     ROOT,
  docs:     path.join(ROOT, 'docs/08-user-manual'),
  outDir:   path.join(ROOT, 'dist/manuals'),
};
