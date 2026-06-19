const http = require('http');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3000);

const AUDIT_PLAN_ACTIVE_ID = '44444444-4444-4444-8444-444444444444';
let authCookie = '';

function captureAuthCookie(setCookieHeaders) {
  if (!Array.isArray(setCookieHeaders) || setCookieHeaders.length === 0) {
    return;
  }
  authCookie = setCookieHeaders
    .map(cookie => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

/**
 * @typedef {{ path: string; description: string; expectPeriod?: string }} RouteConfig
 */

/** @type {RouteConfig[]} */
const ROUTES = [
  { path: '/ja/audit', description: '監査管理（日本語）' },
  { path: '/en/audit', description: 'Audit Management (English)' },
  { path: `/ja/audit/plans/${AUDIT_PLAN_ACTIVE_ID}`, description: '監査計画詳細（日本語）' },
  { path: `/ja/audit/plans/${AUDIT_PLAN_ACTIVE_ID}/checklist`, description: '監査チェックリスト（日本語）' },
  { path: `/ja/audit/plans/${AUDIT_PLAN_ACTIVE_ID}/report`, description: '監査報告書（日本語）' },
  { path: '/ja/audit/plans/new', description: '新規監査計画（日本語）' },
  { path: '/en/audit/plans/new', description: 'New Audit Plan (English)' },
  { path: '/ja/audit/requirements', description: 'ISO要求事項管理（日本語）' },
  { path: '/en/audit/requirements', description: 'ISO Requirement Management (English)' },
  { path: '/ja/audit/nonconformities', description: '不適合管理（日本語）' },
  { path: '/en/audit/nonconformities', description: 'Nonconformity Management (English)' }
];

function seedDevLogin() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ role: 'auditor' });
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/dev/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, res => {
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
      timeout: Number(process.env.QA_AUDIT_PAGE_TIMEOUT_MS || 15000),
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        ...(authCookie ? { Cookie: authCookie } : {}),
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (settled) return;
        settled = true;
        const success = res.statusCode === 200;

        if (success) {
          let contentCheck = true;
          if (route.path === '/ja/audit') {
            contentCheck = data.includes('次のアクション');
          } else if (route.path === '/en/audit') {
            contentCheck = data.includes('Next actions');
          } else if (route.path.includes('/checklist')) {
            contentCheck = data.includes('監査チェックリスト') || data.includes('ステータス');
          } else if (route.path.includes('/report')) {
            contentCheck = data.includes('監査報告書') || data.includes('Audit Reports');
          } else if (route.path.includes('/nonconformities')) {
            contentCheck = data.includes('不適合管理') || data.includes('Nonconformity');
          } else if (route.path.includes('/plans/')) {
            contentCheck = data.includes('監査計画') || data.includes('Audit Plan');
          }

          if (route.expectPeriod) {
            contentCheck = contentCheck && data.includes(route.expectPeriod);
          }

          console.log(`✅ ${route.description}: OK (${res.statusCode}) - Content: ${contentCheck ? 'OK' : 'NG'}`);
        } else {
          console.log(`❌ ${route.description}: ERROR (${res.statusCode})`);
        }

        resolve({ route: route.path, description: route.description, status: res.statusCode, success });
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
      resolve({ route: route.path, description: route.description, status: 0, success: false });
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
      resolve({ route: route.path, description: route.description, status: 0, success: false });
    });

    req.end();
  });
}

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(authCookie ? { Cookie: authCookie } : {}),
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (error) {
            reject(new Error('Invalid JSON response.'));
          }
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log(`🧪 監査管理機能のテストを開始します... (target: http://${HOST}:${PORT})\n`);

  try {
    console.log('🔧 Dev Login シードを準備しています...');
    await seedDevLogin();
    console.log('✅ Dev Login シード完了\n');
  } catch (error) {
    console.error(`❌ Dev Login シードに失敗しました: ${error.message}`);
    process.exit(1);
  }

  const results = [];

  for (const route of ROUTES) {
    const result = await testRoute(route);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
  }

  await verifyAuditPeriods(results);

  console.log('\n📊 テスト結果サマリー:');
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ 成功: ${successCount}/${results.length}`);
  console.log(`❌ 失敗: ${results.length - successCount}/${results.length}`);

  if (successCount < results.length) {
    console.log('\n⚠️  一部のテストが失敗しました。開発サーバーが起動していることを確認してください。');
    process.exit(1);
  } else {
    console.log('\n🎉 すべてのテストが成功しました！');
  }
}

async function verifyAuditPeriods(results) {
  console.log('\n🔍 監査期間 API を検証しています...');
  try {
    const data = await fetchJson('/api/audit/periods');
    const periods = Array.isArray(data.periods) ? data.periods : [];
    const summary = Array.isArray(data.summary) ? data.summary : [];

    if (!periods.length || !summary.length) {
      console.log('❌ 監査期間API: 有効な期間または統計が取得できませんでした');
      results.push({ route: '/api/audit/periods', description: '監査期間API', status: 0, success: false });
      return;
    }

    console.log(`ℹ️  取得した期間: ${periods.join(', ')}`);
    const targetPeriod = periods[0];
    const targetSummary = summary.find(entry => entry.period === targetPeriod);

    const hasFollowUp = targetSummary && targetSummary.followUp && typeof targetSummary.followUp.completed === 'number';
    const hasNcStatus = targetSummary && targetSummary.nonconformityStatus && typeof targetSummary.nonconformityStatus.open === 'number';

    const apiSuccess = Boolean(hasFollowUp && hasNcStatus);
    console.log(apiSuccess ? `✅ 監査期間API: ${targetPeriod} の統計を取得しました` : '❌ 監査期間API: 統計の形式が不正です');
    results.push({ route: '/api/audit/periods', description: '監査期間API', status: apiSuccess ? 200 : 500, success: apiSuccess });

    if (!apiSuccess) {
      return;
    }

    if (targetPeriod) {
      const periodResult = await testRoute({
        path: `/ja/audit?period=${encodeURIComponent(targetPeriod)}`,
        description: `監査管理 (${targetPeriod})`,
        expectPeriod: targetPeriod
      });
      results.push(periodResult);
    }
  } catch (error) {
    console.log(`❌ 監査期間API: ERROR - ${error.message}`);
    results.push({ route: '/api/audit/periods', description: '監査期間API', status: 0, success: false });
  }
}

// Check if server is running
const checkReq = http.request({ hostname: HOST, port: PORT, path: '/', method: 'HEAD' }, (res) => {
  runTests();
});

checkReq.on('error', () => {
  console.error('❌ 開発サーバーが起動していません。先に `npm run dev` を実行してください。');
  process.exit(1);
});

checkReq.end();
