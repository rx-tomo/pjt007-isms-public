/**
 * Verify public guidance against a local development server (no external posts).
 * BASE_URL defaults to http://127.0.0.1:3007. Use a local server so /dev-login
 * remains available without enabling production analytics or external effects.
 * CHROMIUM_EXECUTABLE_PATH can select an installed browser.
 * REVIEW_OUTPUT_DIR enables screenshots and a JSON evidence summary.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL || 'http://127.0.0.1:3007';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local review server');
const canonicalOrigin = 'https://riscala-ai.com';
const output = process.env.REVIEW_OUTPUT_DIR;
if (output) await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--no-sandbox'],
});
const slugs = ['isms-certification-cost', 'iso27001-certification-process', 'isms-risk-assessment', 'isms-required-documents', 'isms-vs-privacy-mark', 'iso27001-annex-a-controls'];
const evidence = { http: [], viewports: [] };
async function capture(page, filename) {
  if (!output) return;
  // Reveal sections that use scroll observers, then capture from the top.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate(value => window.scrollTo(0, value), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(output, filename), fullPage: true });
}
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const brokenPaths = ['/about', '/contact', '/privacy', '/terms', '/help', '/docs', '/status', '/cookies'];
  for (const locale of ['ja', 'en', 'zh']) {
    for (const route of ['', '/guide', '/research', '/resources', '/interviews/isms-operations', ...slugs.map(slug => `/guide/${slug}`)]) {
      const urlPath = `/${locale}${route}`;
      const response = await page.goto(`${base}${urlPath}`);
      assert.equal(response.status(), 200, urlPath);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${canonicalOrigin}${urlPath}`);
      assert(await page.locator('title').textContent(), `${urlPath}: title`);
      assert(await page.locator('meta[name="description"]').getAttribute('content'), `${urlPath}: description`);
      const robots = page.locator('meta[name="robots"]');
      assert(!/noindex/i.test(await robots.count() ? await robots.getAttribute('content') : ''), urlPath);
      const footerHrefs = await page.locator('footer a').evaluateAll(links => links.map(link => link.getAttribute('href')));
      assert(!footerHrefs.some(href => brokenPaths.some(broken => href === `/${locale}${broken}`)), `${urlPath}: dead footer`);
      if (route.startsWith('/guide/')) {
        const jsonld = await page.locator('script[type="application/ld+json"]').allTextContents();
        assert(jsonld.map(JSON.parse).some(item => item['@type'] === 'Article'));
        const cta = page.locator('article section').filter({ has: page.locator(`a[href="/${locale}/research"]`) });
        assert(await cta.locator(`a[href="/${locale}/dev-login"]`).count(), `${urlPath}: demo CTA`);
      }
      evidence.http.push(urlPath);
    }
    await page.goto(`${base}/${locale}/dev-login`);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
    const pricingHtml = await (await context.request.get(`${base}/${locale}/pricing`)).text();
    assert.match(pricingHtml, /<meta name="robots" content="[^"]*noindex/);
  }
  for (const endpoint of ['/robots.txt', '/sitemap.xml']) {
    const response = await context.request.get(`${base}${endpoint}`);
    assert.equal(response.status(), 200);
    const body = await response.text();
    assert(body.includes(canonicalOrigin));
    if (endpoint === '/sitemap.xml') {
      assert.equal((body.match(/<loc>/g) || []).length, 33);
      assert(!body.includes('/pricing') && !body.includes('/dev-login'));
    }
  }
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/ja`);
    assert(!(await page.locator('main').innerText()).includes('14日間'));
    assert(!(await page.locator('main').innerText()).includes('専任サポート'));
    assert(!(await page.locator('main').innerText()).includes('専門サポート'));
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(!await overflow(), 'home overflow');
    await capture(page, `home-${viewport.width}.png`);
    await page.locator('main a[href="/ja/dev-login"]').first().click();
    await page.waitForURL('**/ja/dev-login');
    // These are real local seed personas; no login or external side effect is triggered.
    await page.locator('[data-demo-role]').first().waitFor();
    await page.getByRole('link', { name: 'ホームに戻る' }).click();
    await page.waitForURL('**/ja');
    await page.goto(`${base}/ja/guide/isms-certification-cost`);
    assert(!await overflow(), 'cost article overflow');
    const rows = await page.locator('table tbody tr').count();
    assert.equal(rows, 9);
    await capture(page, `cost-${viewport.width}.png`);
    const cta = page.locator('article section').filter({ has: page.locator('a[href="/ja/research"]') });
    await cta.locator('a[href="/ja/dev-login"]').click();
    await page.waitForURL('**/ja/dev-login');
    await page.goBack();
    await page.waitForURL('**/ja/guide/isms-certification-cost');
    await cta.locator('a[href="/ja/research"]').click();
    await page.waitForURL('**/ja/research');
    for (const [option, expectedSlug] of [['notStarted', 'iso27001-certification-process'], ['partly', 'isms-required-documents'], ['routine', 'iso27001-annex-a-controls']]) {
      await page.getByTestId('research-start').click();
      for (let i = 0; i < 5; i++) {
        await page.getByTestId(`research-option-${option}`).click();
        await page.getByTestId('research-next').click();
      }
      await page.getByTestId('research-result').waitFor();
      const result = page.getByTestId('research-result');
      assert(await result.locator(`a[href="/ja/guide/${expectedSlug}"]`).count());
      assert.equal(await page.getByTestId('research-interview-link').getAttribute('href'), 'https://github.com/rx-tomo/pjt007-isms-public/issues/new?template=research-interview.yml');
      assert((await result.innerText()).includes('機密情報'));
      const events = await page.evaluate(() => window.dataLayer);
      assert(events.filter(item => item.event === 'assessment_complete').every(item => Object.keys(item).sort().join(',') === 'event,result_band'));
      assert(!await overflow(), 'research result overflow');
      if (option === 'partly') await capture(page, `research-${viewport.width}.png`);
      await page.getByTestId('research-restart').click();
    }
    await page.goto(`${base}/ja/guide/iso27001-annex-a-controls`);
    assert.equal(await page.locator('table tbody tr').count(), 93 + 5 + 3);
    assert(await page.locator('#soa-examples').count());
    assert(!await overflow(), 'annex article overflow');
    await capture(page, `annex-${viewport.width}.png`);
    const resultCta = page.locator('article section').filter({ has: page.locator('a[href="/ja/research"]') });
    await resultCta.locator('a[href="/ja/research"]').click();
    await page.waitForURL('**/ja/research');
    await page.goBack();
    await page.waitForURL('**/ja/guide/iso27001-annex-a-controls');
    evidence.viewports.push(viewport);
  }
  if (output) await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify(evidence, null, 2));
  console.log(`Public guidance QA passed: ${evidence.http.length} pages, robots/sitemap, three result bands, desktop/mobile CTA navigation and back.`);
} finally {
  await browser.close();
}
