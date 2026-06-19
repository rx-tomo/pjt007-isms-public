/**
 * Manual PDF 生成 — Puppeteer HTML → PDF レンダラー
 */
import puppeteer from 'puppeteer';
import { PDF_OPTIONS } from './config.mjs';
import { headerTemplate, footerTemplate } from './styles.mjs';

/**
 * 複数の HTML→PDF 変換をバッチ処理
 * ブラウザインスタンスを共有して効率化
 *
 * @param {Array<{ html: string, outPath: string, chapterTitle: string }>} jobs
 */
export async function renderPdfBatch(jobs) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  try {
    for (const job of jobs) {
      await renderSinglePdf(browser, job);
    }
  } finally {
    await browser.close();
  }
}

/**
 * 単一の HTML → PDF 変換
 */
async function renderSinglePdf(browser, { html, outPath, chapterTitle }) {
  const page = await browser.newPage();

  try {
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Google Fonts の読み込みを追加で待機
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
      ...PDF_OPTIONS,
      path: outPath,
      headerTemplate: headerTemplate(chapterTitle),
      footerTemplate: footerTemplate(),
    });

    console.log(`  ✓ ${outPath}`);
  } finally {
    await page.close();
  }
}

/**
 * 単一ファイルのみ変換（ブラウザ起動〜終了まで含む）
 */
export async function renderPdfSingle({ html, outPath, chapterTitle }) {
  await renderPdfBatch([{ html, outPath, chapterTitle }]);
}
