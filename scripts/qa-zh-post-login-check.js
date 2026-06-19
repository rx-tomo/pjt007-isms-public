#!/usr/bin/env node

/**
 * WS4 中文（ZH）ページ認証後確認スクリプト
 * - POST /api/dev/login でセッション取得
 * - 中文ページが 200 で返ること
 * - HTML lang="zh" が含まれること
 * - 翻訳キーの生文字列が含まれないこと（簡易チェック）
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);

let authCookie = '';

/**
 * @typedef {{ path: string; description: string }} RouteConfig
 */

/** @type {RouteConfig[]} */
const ROUTES = [
  { path: '/zh/home', description: 'ホーム（中文）' },
  { path: '/zh/tasks', description: 'タスク管理（中文）' },
  { path: '/zh/risks', description: 'リスク管理（中文）' },
  { path: '/zh/documents', description: '文書管理（中文）' },
  { path: '/zh/settings/profile', description: 'プロフィール設定（中文）' },
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function captureAuthCookie(setCookieHeaders) {
  if (!Array.isArray(setCookieHeaders) || setCookieHeaders.length === 0) {
    return;
  }
  authCookie = setCookieHeaders
    .map(cookie => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function seedDevLogin() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ role: 'system_operator' });
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/dev/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      const success = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
      captureAuthCookie(res.headers['set-cookie']);
      res.on('data', () => {});
      res.on('end', () => {
        if (success) {
          resolve();
        } else {
          reject(new Error(`Dev login seed failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function testRoute(route, attempt = 1) {
  return new Promise((resolve) => {
    let settled = false;
    const options = {
      hostname: HOST,
      port: PORT,
      path: route.path,
      method: 'GET',
      timeout: Number(process.env.QA_PAGE_TIMEOUT_MS || 15000),
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        ...(authCookie ? { Cookie: authCookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (settled) return;
        settled = true;

        // リダイレクト（302等）は失敗扱い
        const success = res.statusCode === 200;
        let details = {
          route: route.path,
          description: route.description,
          status: res.statusCode,
          success,
          checks: {
            statusCode: res.statusCode === 200,
            htmlLangZh: false,
            noTranslationKeys: false,
          },
        };

        if (success) {
          // Check for <html lang="zh"
          const htmlLangMatch = data.match(/<html[^>]*lang=['"](zh)['"]/i);
          details.checks.htmlLangZh = Boolean(htmlLangMatch);

          // 簡易チェック: 翻訳キーの生文字列パターンを検査
          // 例: auth.login, home.title など
          const translationKeyPattern = /\b[a-z]+\.[a-z]+(?:\.[a-z]+)?\b/g;
          const matches = data.match(translationKeyPattern) || [];
          // false positives を除外（例: example.com, よくある単語など）
          const suspiciousMatches = matches.filter(m => {
            const [ns] = m.split('.');
            return ['auth', 'common', 'home', 'settings', 'tasks', 'risks', 'documents', 'notifications', 'errors'].includes(ns);
          });

          details.checks.noTranslationKeys = suspiciousMatches.length === 0;
          if (suspiciousMatches.length > 0) {
            details.translationKeysFound = suspiciousMatches.slice(0, 5);
          }

          if (details.checks.htmlLangZh && details.checks.noTranslationKeys) {
            console.log(`✅ ${route.description}: OK (${res.statusCode})`);
          } else {
            const issues = [];
            if (!details.checks.htmlLangZh) issues.push('lang="zh" missing');
            if (!details.checks.noTranslationKeys) issues.push(`translation keys found (${details.translationKeysFound?.length || 0})`);
            console.log(`⚠️  ${route.description}: PARTIAL (${res.statusCode}) - ${issues.join(', ')}`);
          }
        } else {
          console.log(`❌ ${route.description}: ERROR (${res.statusCode})`);
        }

        resolve(details);
      });
    });

    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (attempt < 2) {
        setTimeout(() => {
          testRoute(route, attempt + 1).then(resolve);
        }, 500);
        return;
      }
      console.log(`❌ ${route.description}: ERROR - ${error.message}`);
      resolve({
        route: route.path,
        description: route.description,
        status: 0,
        success: false,
        error: error.message,
        checks: {
          statusCode: false,
          htmlLangZh: false,
          noTranslationKeys: false,
        },
      });
    });

    req.on('timeout', () => {
      if (settled) return;
      settled = true;
      req.destroy();
      if (attempt < 2) {
        setTimeout(() => {
          testRoute(route, attempt + 1).then(resolve);
        }, 500);
        return;
      }
      console.log(`❌ ${route.description}: ERROR - Request timeout`);
      resolve({
        route: route.path,
        description: route.description,
        status: 0,
        success: false,
        error: 'Request timeout',
        checks: {
          statusCode: false,
          htmlLangZh: false,
          noTranslationKeys: false,
        },
      });
    });

    req.end();
  });
}

async function main() {
  const outputDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `zh-post-login-check-run-${timestamp()}.json`);

  console.log('\n=== WS4 中文（ZH）ページ認証後確認 QA ===\n');

  try {
    console.log('ステップ 1: /api/dev/login でセッション取得...');
    await seedDevLogin();
    console.log('✅ セッション取得成功\n');

    console.log('ステップ 2: 各中文ページをチェック...\n');
    const results = [];
    for (const route of ROUTES) {
      const result = await testRoute(route);
      results.push(result);
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      baseUrl: `http://${HOST}:${PORT}`,
      totalPages: results.length,
      successCount: results.filter(r => r.success).length,
      allChecksPassed: results.every(r => r.success && r.checks.htmlLangZh && r.checks.noTranslationKeys),
      results,
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

    console.log('\n========================================');
    console.log(`総ページ数: ${summary.totalPages}`);
    console.log(`成功: ${summary.successCount}/${summary.totalPages}`);

    if (summary.allChecksPassed) {
      console.log('\n✅ すべての中文ページが正常です！');
      console.log(`結果: ${outputPath}`);
      process.exit(0);
    } else {
      console.log('\n❌ いくつかの中文ページに問題があります。');
      console.log(`結果: ${outputPath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ エラー: ${error.message}`);
    const errorOutput = {
      generatedAt: new Date().toISOString(),
      baseUrl: `http://${HOST}:${PORT}`,
      error: error.message,
      errorStack: error.stack,
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(errorOutput, null, 2)}\n`);
    console.log(`結果: ${outputPath}`);
    process.exit(1);
  }
}

main();
