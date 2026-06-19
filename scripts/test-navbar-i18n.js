#!/usr/bin/env node

const http = require('http');

async function testNavbar() {
  console.log('Testing Navbar i18n implementation...\n');
  
  const locales = ['ja', 'en'];
  const expectedTexts = {
    ja: ['ダッシュボード', '文書管理', 'リスク管理', 'タスク', '監査'],
    en: ['Dashboard', 'Documents', 'Risks', 'Tasks', 'Audit']
  };
  
  for (const locale of locales) {
    const url = `http://localhost:3000/${locale}`;
    
    console.log(`Testing ${locale} locale...`);
    
    await new Promise((resolve) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.log(`  Status: ${res.statusCode} - ERROR`);
          } else {
            console.log(`  Status: ${res.statusCode} - OK`);
            
            // Check for expected texts
            const found = expectedTexts[locale].filter(text => data.includes(text));
            const missing = expectedTexts[locale].filter(text => !data.includes(text));
            
            if (found.length > 0) {
              console.log(`  Found translations: ${found.join(', ')}`);
            }
            if (missing.length > 0) {
              console.log(`  Missing translations: ${missing.join(', ')}`);
            }
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
  
  console.log('Note: If translations are missing, the Navbar may not be rendered on the home page.');
  console.log('      Check the authenticated home shell for full navbar functionality.\n');
}

testNavbar();
