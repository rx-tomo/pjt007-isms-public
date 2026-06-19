#!/usr/bin/env node

const http = require('http');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);

function callApi({ method, path, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        Accept: 'application/json'
      }
    };

    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 0, json });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function main() {
  console.log(`🧪 通知トリガー API を検証します (http://${HOST}:${PORT})`);

  const tests = [
    {
      name: 'POST /api/tasks/reminders returns ok',
      request: { method: 'POST', path: '/api/tasks/reminders' },
      validate: (result) => result.status === 200 && result.json && result.json.ok === true
    },
    {
      name: 'POST /api/notifications/deliver handles missing notification gracefully',
      request: {
        method: 'POST',
        path: '/api/notifications/deliver',
        body: { notificationId: '00000000-0000-0000-0000-000000000000' }
      },
      validate: (result) => result.status === 200 && result.json && result.json.ok === true
    }
  ];

  let successCount = 0;

  for (const test of tests) {
    process.stdout.write(`- ${test.name} ... `);
    try {
      const result = await callApi(test.request);
      if (test.validate(result)) {
        console.log('OK');
        successCount += 1;
      } else {
        console.log('FAILED');
        console.log(`  ↳ status=${result.status}, response=${JSON.stringify(result.json)}`);
      }
    } catch (error) {
      console.log('FAILED');
      console.log(`  ↳ error=${error.message}`);
    }
  }

  if (successCount === tests.length) {
    console.log('\n🎉 通知トリガー API の検証が成功しました');
    process.exit(0);
  }

  console.log(`\n⚠️ ${tests.length - successCount}/${tests.length} 件が失敗しました`);
  process.exit(1);
}

main().catch((error) => {
  console.error('❌ 通知トリガー検証で想定外のエラーが発生しました:', error);
  process.exit(1);
});
