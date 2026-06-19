const http = require('http');
const https = require('https');

const ROUTES = [
  // リスクアセスメント機能
  { path: '/ja/risks', description: 'リスク一覧（日本語）', feature: 'リスクアセスメント' },
  { path: '/en/risks', description: 'Risk List (English)', feature: 'Risk Assessment' },
  { path: '/ja/risks/new', description: '新規リスク登録（日本語）', feature: 'リスクアセスメント' },
  { path: '/en/risks/new', description: 'New Risk Registration (English)', feature: 'Risk Assessment' },
  
  // タスク管理機能
  { path: '/ja/tasks', description: 'タスク一覧（日本語）', feature: 'タスク管理' },
  { path: '/en/tasks', description: 'Task List (English)', feature: 'Task Management' },
  { path: '/ja/tasks/new', description: '新規タスク作成（日本語）', feature: 'タスク管理' },
  { path: '/en/tasks/new', description: 'New Task Creation (English)', feature: 'Task Management' },
  
  // 監査管理機能
  { path: '/ja/audit', description: '監査管理（日本語）', feature: '監査管理' },
  { path: '/en/audit', description: 'Audit Management (English)', feature: 'Audit Management' },
  { path: '/ja/audit/plans/new', description: '新規監査計画（日本語）', feature: '監査管理' },
  { path: '/en/audit/plans/new', description: 'New Audit Plan (English)', feature: 'Audit Management' },
];

const TEST_PORT = 3000;
const HOST = 'localhost';

function testRoute(route) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: TEST_PORT,
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
          // Check for expected content based on route
          let contentCheck = false;
          
          if (route.path.includes('/risks')) {
            if (route.path.includes('/ja/')) {
              contentCheck = data.includes('リスクアセスメント') || data.includes('リスク一覧');
            } else {
              contentCheck = data.includes('Risk Assessment') || data.includes('Risk List');
            }
          } else if (route.path.includes('/tasks')) {
            if (route.path.includes('/ja/')) {
              contentCheck = data.includes('タスク管理') || data.includes('タスク一覧');
            } else {
              contentCheck = data.includes('Task Management') || data.includes('Task List');
            }
          } else if (route.path.includes('/audit')) {
            if (route.path.includes('/ja/')) {
              contentCheck = data.includes('監査管理') || data.includes('監査計画');
            } else {
              contentCheck = data.includes('Audit Management') || data.includes('Audit Plans');
            }
          }
          
          console.log(`✅ ${route.description}: OK (${res.statusCode}) - Content: ${contentCheck ? 'OK' : 'NG'}`);
        } else {
          console.log(`❌ ${route.description}: ERROR (${res.statusCode})`);
        }
        
        resolve({ 
          route: route.path, 
          status: res.statusCode, 
          success, 
          feature: route.feature 
        });
      });
    });
    
    req.on('error', (error) => {
      console.log(`❌ ${route.description}: ERROR - ${error.message}`);
      resolve({ 
        route: route.path, 
        status: 0, 
        success: false, 
        feature: route.feature 
      });
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 全機能の統合テストを開始します...\n');
  
  const results = [];
  const featureResults = {};
  
  for (const route of ROUTES) {
    const result = await testRoute(route);
    results.push(result);
    
    // Group results by feature
    if (!featureResults[result.feature]) {
      featureResults[result.feature] = { success: 0, total: 0 };
    }
    featureResults[result.feature].total++;
    if (result.success) {
      featureResults[result.feature].success++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
  }
  
  console.log('\n📊 機能別テスト結果:');
  for (const [feature, result] of Object.entries(featureResults)) {
    const allPassed = result.success === result.total;
    const icon = allPassed ? '✅' : '❌';
    console.log(`${icon} ${feature}: ${result.success}/${result.total} テスト成功`);
  }
  
  console.log('\n📊 全体のテスト結果サマリー:');
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ 成功: ${successCount}/${results.length}`);
  console.log(`❌ 失敗: ${results.length - successCount}/${results.length}`);
  
  if (successCount < results.length) {
    console.log('\n⚠️  一部のテストが失敗しました。');
    console.log('失敗したルート:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.route} (${r.status})`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 すべてのテストが成功しました！');
    console.log('✨ リスクアセスメント機能、タスク管理機能、監査チェックリスト機能が正常に動作しています。');
  }
}

// Check if server is running
const checkReq = http.request({ hostname: HOST, port: TEST_PORT, path: '/', method: 'HEAD' }, (res) => {
  runTests();
});

checkReq.on('error', () => {
  console.error('❌ 開発サーバーが起動していません。先に `npm run dev` を実行してください。');
  process.exit(1);
});

checkReq.end();