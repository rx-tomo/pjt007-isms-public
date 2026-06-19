/**
 * Manual PDF 生成 — CSS スタイル & ヘッダー/フッター テンプレート
 */
import { COLORS, FONTS } from './config.mjs';

// ── Google Fonts CDN ──────────────────────────
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap');`;

// ── メイン CSS ────────────────────────────────
export function buildStyles() {
  return `
${FONT_IMPORT}

/* ── Reset & Base ─────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

html {
  font-size: 10.5pt;
  line-height: 1.75;
  color: ${COLORS.foreground};
  font-family: ${FONTS.sansEn}, ${FONTS.sansJa};
  -webkit-font-smoothing: antialiased;
}

body {
  margin: 0;
  padding: 0;
}

/* ── Headings ─────────────────────────────── */
h1 {
  font-size: 22pt;
  font-weight: 700;
  color: ${COLORS.primary600};
  border-bottom: 3px solid ${COLORS.primary600};
  padding-bottom: 8px;
  margin: 0 0 20px 0;
  page-break-after: avoid;
}

h2 {
  font-size: 15pt;
  font-weight: 700;
  color: ${COLORS.primary700};
  border-left: 4px solid ${COLORS.primary700};
  padding-left: 12px;
  margin: 28px 0 12px 0;
  page-break-after: avoid;
}

h3 {
  font-size: 12pt;
  font-weight: 600;
  color: ${COLORS.foreground};
  margin: 20px 0 8px 0;
  page-break-after: avoid;
}

h4 {
  font-size: 11pt;
  font-weight: 600;
  color: ${COLORS.muted};
  margin: 16px 0 6px 0;
}

/* ── Paragraph ────────────────────────────── */
p {
  margin: 0 0 10px 0;
  orphans: 3;
  widows: 3;
}

/* ── Links ────────────────────────────────── */
a {
  color: ${COLORS.primary600};
  text-decoration: none;
}

/* ── Lists ────────────────────────────────── */
ul, ol {
  margin: 0 0 12px 0;
  padding-left: 0;
}

ul {
  list-style: disc;
  padding-left: 24px;
}

ol {
  list-style: none;
  counter-reset: ol-counter;
}

ol > li {
  counter-increment: ol-counter;
  position: relative;
  padding-left: 36px;
  margin-bottom: 6px;
}

ol > li::before {
  content: counter(ol-counter);
  position: absolute;
  left: 0;
  top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${COLORS.primary600};
  color: ${COLORS.white};
  font-size: 9pt;
  font-weight: 600;
  line-height: 1;
}

li {
  margin-bottom: 4px;
}

/* nested lists */
li > ul, li > ol {
  margin-top: 4px;
}

/* ── Table ────────────────────────────────── */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 16px 0;
  font-size: 9.5pt;
  page-break-inside: auto;
}

thead {
  background: ${COLORS.primary50};
}

th {
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid ${COLORS.border};
  color: ${COLORS.primary700};
}

td {
  padding: 7px 10px;
  border: 1px solid ${COLORS.border};
  vertical-align: top;
}

tr:nth-child(even) {
  background: ${COLORS.background};
}

/* ── Blockquote (default → hint) ──────────── */
blockquote {
  margin: 14px 0;
  padding: 12px 16px;
  border-left: 4px solid ${COLORS.hintBorder};
  background: ${COLORS.hintBg};
  border-radius: 0 6px 6px 0;
  font-size: 9.5pt;
  page-break-inside: avoid;
}

blockquote p {
  margin: 0;
}

/* hint variant */
blockquote.hint {
  border-left-color: ${COLORS.hintBorder};
  background: ${COLORS.hintBg};
}

/* wip (準備中) variant */
blockquote.wip {
  border-left-color: ${COLORS.wipBorder};
  background: ${COLORS.wipBg};
  color: ${COLORS.wipText};
}

/* ── Code ─────────────────────────────────── */
code {
  font-family: ${FONTS.mono};
  font-size: 9pt;
  background: #f1f5f9;
  padding: 2px 5px;
  border-radius: 4px;
  color: #334155;
}

pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 9pt;
  line-height: 1.6;
  margin: 12px 0 16px 0;
  page-break-inside: avoid;
}

pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  color: inherit;
  font-size: inherit;
}

/* ── ASCII art (code block without language) ── */
pre.ascii-art {
  background: ${COLORS.white};
  color: ${COLORS.foreground};
  border: 1px solid ${COLORS.border};
  font-family: ${FONTS.mono};
  font-size: 8.5pt;
  line-height: 1.4;
  white-space: pre;
  overflow-x: auto;
}

/* ── Images ──────────────────────────────── */
img {
  max-width: 100%;
  height: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin: 12px 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* ── Strong / Em ──────────────────────────── */
strong { font-weight: 700; }
em { font-style: italic; }

/* ── hr ───────────────────────────────────── */
hr {
  border: none;
  border-top: 1px solid ${COLORS.border};
  margin: 24px 0;
}

/* ── Page break helpers ───────────────────── */
.page-break { page-break-before: always; }

/* ── Print adjustments ────────────────────── */
@media print {
  body { margin: 0; }
  h1, h2, h3 { page-break-after: avoid; }
  table, pre, blockquote { page-break-inside: avoid; }
  tr { page-break-inside: avoid; }
}
`;
}

// ── ヘッダーテンプレート ──────────────────────
export function headerTemplate(chapterTitle) {
  return `
<div style="
  width: 100%;
  font-size: 8pt;
  font-family: 'Noto Sans JP', 'Inter', sans-serif;
  color: ${COLORS.muted};
  padding: 0 15mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
">
  <span>Riscala AI for ISMS 取扱説明書</span>
  <span>${chapterTitle}</span>
</div>`;
}

// ── フッターテンプレート ──────────────────────
export function footerTemplate() {
  return `
<div style="
  width: 100%;
  font-size: 8pt;
  font-family: 'Noto Sans JP', 'Inter', sans-serif;
  color: ${COLORS.muted};
  padding: 0 15mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
">
  <span>Confidential</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;
}
