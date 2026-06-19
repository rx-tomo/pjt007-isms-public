#!/usr/bin/env node

const http = require('http');

async function testAuthPages() {
  console.log('Testing auth pages i18n implementation...\n');
  
  const host = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1'
  const port = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007)

  const pages = [
    { path: '/ja/auth/login', name: 'Japanese Login' },
    { path: '/en/auth/login', name: 'English Login' },
    { path: '/ja/auth/signup', name: 'Japanese Signup' },
    { path: '/en/auth/signup', name: 'English Signup' }
  ];
  
  const expectedTexts = {
    '/ja/auth/login': ['ログイン', 'メールアドレス', 'パスワード'],
    '/en/auth/login': ['Sign in', 'Email', 'Password'],
    '/ja/auth/signup': ['アカウント作成', 'メールアドレス', 'パスワード'],
    '/en/auth/signup': ['Create', 'Email', 'Password']
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
          } else if (res.statusCode === 404) {
            console.log('  ✗ Page not found');
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
  
  console.log('Auth pages test complete.\n');
  console.log(`Target server: http://${host}:${port}\n`);
}

testAuthPages();
