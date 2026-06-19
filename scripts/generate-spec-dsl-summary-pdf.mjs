#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const repoRoot = process.cwd();
const sourceHtml = path.join(repoRoot, 'docs/01-business/spec-dsl/engineer-summary.html');
const outPdf = path.join(repoRoot, 'docs/01-business/spec-dsl/riscala-isms-business-spec-summary.pdf');
const outScreenshot = path.join(repoRoot, 'docs/01-business/spec-dsl/engineer-summary-preview.png');

async function main() {
  if (!fs.existsSync(sourceHtml)) {
    throw new Error(`HTML not found: ${sourceHtml}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.goto(`file://${sourceHtml}`, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');

    const layoutReport = await page.evaluate(() => {
      const badChars = /[�□]/.test(document.body.innerText);
      const overflowing = [];
      for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 2) {
          overflowing.push({
            tag: el.tagName.toLowerCase(),
            className: el.className || '',
            text: (el.textContent || '').trim().slice(0, 80),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          });
        }
      }
      return { badChars, overflowing: overflowing.slice(0, 20) };
    });

    console.log(JSON.stringify(layoutReport, null, 2));

    await page.screenshot({
      path: outScreenshot,
      fullPage: true,
    });

    await page.pdf({
      path: outPdf,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
      headerTemplate: '<div style="font-size:8px;color:#64748b;width:100%;padding:0 12mm;">Riscala AI for ISMS 業務仕様まとめ</div>',
      footerTemplate: '<div style="font-size:8px;color:#64748b;width:100%;padding:0 12mm;text-align:right;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });

    await page.close();
    console.log(`PDF: ${outPdf}`);
    console.log(`Preview: ${outScreenshot}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
