#!/usr/bin/env node

const http = require('http');

async function testRoute(path, expectedStatus = 200) {
  return new Promise((resolve) => {
    const url = `http://localhost:3000${path}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          expectedStatus,
          success: res.statusCode === expectedStatus,
          data
        });
      });
    }).on('error', (err) => {
      resolve({
        path,
        status: 'ERROR',
        error: err.message,
        success: false
      });
    });
  });
}

async function runAllTests() {
  console.log('Running comprehensive i18n tests...\n');
  console.log('Note: Make sure the development server is running (npm run dev)\n');
  
  const routes = [
    // Root redirects
    { path: '/', expectedStatus: 307, name: 'Root redirect' },
    
    // Home pages
    { path: '/ja', expectedStatus: 200, name: 'Japanese home' },
    { path: '/en', expectedStatus: 200, name: 'English home' },
    
    // Auth pages
    { path: '/ja/auth/login', expectedStatus: 200, name: 'Japanese login' },
    { path: '/en/auth/login', expectedStatus: 200, name: 'English login' },
    { path: '/ja/auth/signup', expectedStatus: 200, name: 'Japanese signup' },
    { path: '/en/auth/signup', expectedStatus: 200, name: 'English signup' },
    
    // Home application shell (may redirect if not authenticated)
    { path: '/ja/home', expectedStatus: 200, name: 'Japanese home shell' },
    { path: '/en/home', expectedStatus: 200, name: 'English home shell' },
    
    // Invalid locale (should 404)
    { path: '/fr', expectedStatus: 404, name: 'Invalid locale' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const route of routes) {
    const result = await testRoute(route.path, route.expectedStatus);
    
    if (result.success) {
      console.log(`✅ ${route.name} (${route.path}): ${result.status}`);
      passed++;
    } else {
      console.log(`❌ ${route.name} (${route.path}): ${result.status} (expected ${route.expectedStatus})`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Total tests: ${routes.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(50) + '\n');
  
  // Content verification
  console.log('Content verification tests:\n');
  
  const contentTests = [
    { 
      path: '/ja',
      checks: ['ISMS', '文書管理', 'リスク評価', 'タスク管理'],
      name: 'Japanese content'
    },
    { 
      path: '/en',
      checks: ['ISMS', 'Document Management', 'Risk Assessment', 'Task Management'],
      name: 'English content'
    }
  ];
  
  for (const test of contentTests) {
    const result = await testRoute(test.path);
    if (result.status === 200) {
      const found = test.checks.filter(text => result.data.includes(text));
      const missing = test.checks.filter(text => !result.data.includes(text));
      
      console.log(`${test.name} (${test.path}):`);
      if (found.length > 0) {
        console.log(`  ✓ Found: ${found.join(', ')}`);
      }
      if (missing.length > 0) {
        console.log(`  ✗ Missing: ${missing.join(', ')}`);
      }
      console.log('');
    }
  }
  
  console.log('All tests completed!\n');
}

runAllTests();
