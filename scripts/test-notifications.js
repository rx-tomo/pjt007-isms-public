#!/usr/bin/env node

const http = require('http');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);

const ROUTES = [
  { path: '/ja/notifications', description: '通知センター（日本語）', expected: ['通知', '通知設定'] },
  { path: '/en/notifications', description: 'Notification Center (English)', expected: ['Notifications', 'Notification Settings'] }
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
  console.log(`🧪 通知センターのテストを開始します (http://${HOST}:${PORT})\n`);

  const results = [];
  for (const route of ROUTES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await testRoute(route);
    results.push(result);
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n📊 テスト結果: ${passed}/${results.length} 件成功`);

  if (passed === results.length) {
    console.log('🎉 通知センターのテストがすべて成功しました');
    process.exit(0);
  }

  console.log('⚠️ 通知センターに問題が見つかりました');
  process.exit(1);
}

main().catch(error => {
  console.error('❌ テスト実行中にエラーが発生しました:', error);
  process.exit(1);
});
