import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const rawBaseURL = process.env.BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3007';

function resolveBaseURL(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid BASE_URL: ${raw}`);
  }

  if (parsed.hostname === '127.0.0.1') {
    parsed.hostname = 'localhost';
    console.warn(`[capture] BASE_URL host normalized to localhost to avoid CORS mismatch: ${parsed.toString()}`);
  }

  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

const baseURL = resolveBaseURL(rawBaseURL);

const COMMON_DIR = 'docs/08-user-manual/assets/screenshots/00-common';
const APPROVER_DIR = 'docs/08-user-manual/assets/screenshots/01-user-approver';

const VIEWPORT = { width: 1280, height: 800 };

const screenshots = [
  // 00-common: unauthenticated
  { filename: '01-login.png', path: '/ja/auth/login', role: null, section: COMMON_DIR },
  { filename: '02-login-form.png', path: '/ja/auth/login', role: null, section: COMMON_DIR },
  // 00-common: org_admin
  { filename: '03-dashboard-layout.png', path: '/ja/home', role: 'org_admin', section: COMMON_DIR },
  { filename: '04-home-dashboard.png', path: '/ja/home', role: 'org_admin', section: COMMON_DIR },
  { filename: '05-notifications.png', path: '/ja/notifications', role: 'org_admin', section: COMMON_DIR },
  { filename: '06-profile-settings.png', path: '/ja/settings/profile', role: 'org_admin', section: COMMON_DIR },
  { filename: '07-documents-list.png', path: '/ja/documents', role: 'org_admin', section: COMMON_DIR },
  { filename: '08-home-general.png', path: '/ja/home', role: 'org_admin', section: COMMON_DIR },
  // 01-user-approver
  { filename: '01-approver-home.png', path: '/ja/home', role: 'approver', section: APPROVER_DIR },
  { filename: '02-documents.png', path: '/ja/documents', role: 'approver', section: APPROVER_DIR },
  { filename: '03-tasks.png', path: '/ja/tasks', role: 'approver', section: APPROVER_DIR },
  { filename: '04-risks.png', path: '/ja/risks', role: 'approver', section: APPROVER_DIR },
  { filename: '05-approvals.png', path: '/ja/approvals', role: 'approver', section: APPROVER_DIR },
  { filename: '06-ai-settings.png', path: '/ja/settings/ai', role: 'approver', section: APPROVER_DIR },
];

async function devLogin(page, role) {
  // API直接呼び出し方式（テナント選択UIをバイパス）
  await page.goto(`${baseURL}/ja`, { waitUntil: 'domcontentloaded' });

  const loginResponse = await page.request.post(`${baseURL}/api/dev/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { role },
  });

  if (!loginResponse.ok()) {
    const body = await loginResponse.text().catch(() => '');
    throw new Error(`dev login failed (${loginResponse.status()}): ${body.slice(0, 300)}`);
  }

  const [whoamiResponse, sessionResponse, inPageSessionStatus] = await Promise.all([
    page.request.get(`${baseURL}/api/dev/whoami`),
    page.request.get(`${baseURL}/api/auth/get-session`),
    page.evaluate(async () => {
      const response = await fetch('/api/auth/get-session');
      return response.status;
    }),
  ]);

  if (!whoamiResponse.ok()) {
    throw new Error(`whoami check failed (${whoamiResponse.status()})`);
  }
  if (!sessionResponse.ok()) {
    throw new Error(`session check failed (${sessionResponse.status()})`);
  }
  if (inPageSessionStatus !== 200) {
    throw new Error(`in-page session check failed (${inPageSessionStatus})`);
  }

  // ログイン後にホーム画面へ遷移
  await page.goto(`${baseURL}/ja/home`, { waitUntil: 'networkidle' });
  const postLoginPath = new URL(page.url()).pathname;
  if (postLoginPath.includes('/auth/login')) {
    throw new Error(`post-login redirect detected: ${postLoginPath}`);
  }
}

async function captureScreenshot(page, config, index, total) {
  const outDir = path.resolve(config.section);
  const filePath = path.join(outDir, config.filename);

  process.stdout.write(`📸 [${index + 1}/${total}] ${config.filename} ... `);

  await page.goto(`${baseURL}${config.path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  if (config.role) {
    const currentPath = new URL(page.url()).pathname;
    if (currentPath.includes('/auth/login')) {
      throw new Error(`authenticated page redirected to login: ${currentPath}`);
    }
  }

  await page.screenshot({
    path: filePath,
    fullPage: false,
    type: 'png',
  });

  console.log('done');
}

async function main() {
  // Create output directories
  fs.mkdirSync(path.resolve(COMMON_DIR), { recursive: true });
  fs.mkdirSync(path.resolve(APPROVER_DIR), { recursive: true });

  const browser = await chromium.launch();
  // Suppress Next.js error overlay in dev mode
  // Applied to all new contexts via browser-level init script is not available,
  // so we'll add it in each context creation.
  const total = screenshots.length;
  const failures = [];
  let captured = 0;

  try {
    // --- Unauthenticated screenshots ---
    const unauthShots = screenshots.filter((s) => s.role === null);
    if (unauthShots.length > 0) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      await page.addInitScript(() => {
        // Hide Next.js error overlay
        if (typeof window !== 'undefined') {
          const style = document.createElement('style');
          style.textContent = 'nextjs-portal { display: none !important; } body > nextjs-portal { display: none !important; }';
          (document.head || document.documentElement).appendChild(style);
          // Suppress unhandled error popups
          window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
          window.__NEXT_DATA__.props = window.__NEXT_DATA__.props || {};
        }
      });
      for (const config of unauthShots) {
        const idx = screenshots.indexOf(config);
        try {
          await captureScreenshot(page, config, idx, total);
          captured++;
        } catch (err) {
          console.log('FAILED');
          failures.push({ filename: config.filename, error: err.message });
        }
      }
      await context.close();
    }

    // --- org_admin screenshots ---
    const adminShots = screenshots.filter((s) => s.role === 'org_admin');
    if (adminShots.length > 0) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      await page.addInitScript(() => {
        // Hide Next.js error overlay
        if (typeof window !== 'undefined') {
          const style = document.createElement('style');
          style.textContent = 'nextjs-portal { display: none !important; } body > nextjs-portal { display: none !important; }';
          (document.head || document.documentElement).appendChild(style);
          // Suppress unhandled error popups
          window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
          window.__NEXT_DATA__.props = window.__NEXT_DATA__.props || {};
        }
      });
      await devLogin(page, 'org_admin');
      for (const config of adminShots) {
        const idx = screenshots.indexOf(config);
        try {
          await captureScreenshot(page, config, idx, total);
          captured++;
        } catch (err) {
          console.log('FAILED');
          failures.push({ filename: config.filename, error: err.message });
        }
      }
      await context.close();
    }

    // --- approver screenshots ---
    const approverShots = screenshots.filter((s) => s.role === 'approver');
    if (approverShots.length > 0) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      await page.addInitScript(() => {
        // Hide Next.js error overlay
        if (typeof window !== 'undefined') {
          const style = document.createElement('style');
          style.textContent = 'nextjs-portal { display: none !important; } body > nextjs-portal { display: none !important; }';
          (document.head || document.documentElement).appendChild(style);
          // Suppress unhandled error popups
          window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
          window.__NEXT_DATA__.props = window.__NEXT_DATA__.props || {};
        }
      });
      await devLogin(page, 'approver');
      for (const config of approverShots) {
        const idx = screenshots.indexOf(config);
        try {
          await captureScreenshot(page, config, idx, total);
          captured++;
        } catch (err) {
          console.log('FAILED');
          failures.push({ filename: config.filename, error: err.message });
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // --- Summary ---
  console.log('\n--- Summary ---');
  console.log(`Total: ${total}`);
  console.log(`Captured: ${captured}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f.filename}: ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
