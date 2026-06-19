#!/usr/bin/env node

const http = require('http');

async function testDashboard() {
  console.log('Testing home page i18n implementation...\n');
  
  const host = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
  const port = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)

  const pages = [
    { path: '/ja/home', name: 'Japanese Home' },
    { path: '/en/home', name: 'English Home' }
  ];

  const expectedTexts = {
    '/ja/home': ['ホーム', '文書管理', 'リスク管理', 'タスク', '監査'],
    '/en/home': ['Home', 'Documents', 'Risk', 'Tasks', 'Audit']
  };
  
  for (const page of pages) {
    const url = `http://${host}:${port}${page.path}`;
    
    console.log(`Testing ${page.name} (${page.path})...`);
    
    await new Promise((resolve) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`  Status: ${res.statusCode}`);
          
          if (res.statusCode === 200) {
            const expected = expectedTexts[page.path];
            if (expected) {
              const found = expected.filter(text => data.includes(text));
              const missing = expected.filter(text => !data.includes(text));
              
              if (found.length > 0) {
                console.log(`  ✓ Found: ${found.join(', ')}`);
              }
              if (missing.length > 0) {
                console.log(`  ✗ Missing: ${missing.join(', ')}`);
              }
            }
            
            // Check for authentication redirect
            if (data.includes('login')) {
              console.log('  ℹ Redirected to login (auth required)');
            }
          } else if (res.statusCode === 404) {
            console.log('  ✗ Page not found');
          } else if (res.statusCode === 302 || res.statusCode === 307) {
            console.log('  ℹ Redirected (likely auth required)');
          }
          
          console.log('');
          resolve();
        });
      }).on('error', (err) => {
        console.log(`  ERROR: ${err.message}\n`);
        resolve();
      });
    });
  }
  
  console.log('Home test complete.\n');
  console.log(`Target server: http://${host}:${port}\n`);
  console.log('Note: Home requires authentication. If redirected, that\'s expected behavior.\n');
}

testDashboard();
