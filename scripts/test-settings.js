#!/usr/bin/env node

const http = require('http');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);

const ROUTES = [
  {
    path: '/ja/settings/organization',
    description: '組織設定（日本語）',
    expected: ['組織設定', 'ISMSフェーズ', 'フェーズを保存', 'フェーズ変更履歴']
  },
  {
    path: '/en/settings/organization',
    description: 'Organization Settings (English)',
    expected: ['Organization Settings', 'ISMS phase', 'Save phase', 'Phase change history']
  },
  { path: '/ja/settings/users', description: 'ユーザー管理（日本語）', expected: ['ユーザー管理', '招待'] },
  { path: '/en/settings/users', description: 'User Management (English)', expected: ['User Management', 'Invite'] },
  { path: '/ja/settings/profile', description: 'プロフィール設定（日本語）', expected: ['プロフィール', 'メール'] },
  { path: '/en/settings/profile', description: 'Profile Settings (English)', expected: ['Profile Settings', 'Email'] },
  { path: '/ja/settings/subscription', description: '契約情報（日本語）', expected: ['サブスクリプション', '料金プラン'] },
  { path: '/en/settings/subscription', description: 'Subscription (English)', expected: ['Subscription', 'Pricing Plan'] }
];

function testRoute({ path, description, expected }) {
  return new Promise(resolve => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml'
      }
    };

    const req = http.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        const ok = res.statusCode === 200;
        let contentOk = false;
        if (ok) {
          contentOk = expected.every(text => data.includes(text));
        }

        if (ok && contentOk) {
          console.log(`✅ ${description}: OK (200)`);
        } else if (!ok) {
          console.log(`❌ ${description}: HTTP ${res.statusCode}`);
        } else {
          console.log(`❌ ${description}: expected text missing`);
          expected.forEach(text => {
            if (!data.includes(text)) {
              console.log(`   - Missing: ${text}`);
            }
          });
        }

        resolve(ok && contentOk);
      });
    });

    req.on('error', error => {
      console.log(`❌ ${description}: ${error.message}`);
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  console.log(`🧪 設定画面のテストを開始します (http://${HOST}:${PORT})\n`);

  const results = [];
  for (const route of ROUTES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await testRoute(route);
    results.push(result);
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n📊 テスト結果: ${passed}/${results.length} 件成功`);

  if (passed === results.length) {
    console.log('🎉 設定画面のテストがすべて成功しました');
    process.exit(0);
  }

  console.log('⚠️ 設定画面に問題が見つかりました');
  process.exit(1);
}

main().catch(error => {
  console.error('❌ テスト実行中にエラーが発生しました:', error);
  process.exit(1);
});
