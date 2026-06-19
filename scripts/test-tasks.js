const http = require('http');
const https = require('https');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);

const ROUTES = [
  { path: '/ja/tasks', description: 'タスク一覧（日本語）' },
  { path: '/en/tasks', description: 'Task List (English)' },
  { path: '/ja/tasks/new', description: '新規タスク作成（日本語）' },
  { path: '/en/tasks/new', description: 'New Task Creation (English)' },
];

function testRoute(route) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: route.path,
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const success = res.statusCode === 200;
        
        if (success) {
          // Check for expected content
          let contentCheck = false;
          if (route.path.includes('/ja/tasks')) {
            contentCheck = data.includes('タスク管理') || data.includes('タスク一覧');
          } else if (route.path.includes('/en/tasks')) {
            contentCheck = data.includes('Task Management') || data.includes('Task List');
          }
          
          console.log(`✅ ${route.description}: OK (${res.statusCode}) - Content: ${contentCheck ? 'OK' : 'NG'}`);
        } else {
          console.log(`❌ ${route.description}: ERROR (${res.statusCode})`);
        }
        
        resolve({ route: route.path, status: res.statusCode, success });
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ ${route.description}: ERROR - ${error.message}`);
      resolve({ route: route.path, status: 0, success: false });
    });
    
    req.end();
  });
}

async function runTests() {
  console.log(`🧪 タスク管理機能のテストを開始します... (target: http://${HOST}:${PORT})\n`);
  
  const results = [];
  
  for (const route of ROUTES) {
    const result = await testRoute(route);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
  }
  
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

// Check if server is running
const checkReq = http.request({ hostname: HOST, port: PORT, path: '/', method: 'HEAD' }, (res) => {
  runTests();
});

checkReq.on('error', () => {
  console.error('❌ 開発サーバーが起動していません。先に `npm run dev` を実行してください。');
  process.exit(1);
});

checkReq.end();
