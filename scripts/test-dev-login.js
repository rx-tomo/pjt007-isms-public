const http = require('http');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3000);

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

const locales = ['ja', 'en'];
const roleLabels = {
  ja: ['システム運営者', '組織管理者', '一般ユーザー', '監査員', '承認者'],
  en: ['System Operator', 'Organization Admin', 'Team Member', 'Auditor', 'Approver']
};

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testDevLogin() {
  console.log(`🧪 Testing Dev Login functionality... (target: http://${HOST}:${PORT})\n`);
  
  for (const locale of locales) {
    console.log(`Testing ${locale.toUpperCase()} locale:`);
    
    const path = `/${locale}/dev-login`;
    
    try {
      const response = await makeRequest(path);
      
      if (response.status === 200) {
        console.log(`${colors.green}✓${colors.reset} ${path} - Status: ${response.status}`);
        
        // Check for title / warning banner
        const elements = [
          { name: 'Title', pattern: locale === 'ja' ? '開発用ロールログイン' : 'Developer Role Login' },
          { name: 'Warning badge', pattern: locale === 'ja' ? '開発環境専用' : 'Development only' },
          { name: 'Selected role section', pattern: locale === 'ja' ? '選択したロール' : 'Selected role' },
          { name: 'Sample email label', pattern: locale === 'ja' ? 'サンプルメールアドレス' : 'Sample email' }
        ];

        for (const element of elements) {
          if (response.data.includes(element.pattern)) {
            console.log(`  ${colors.green}✓${colors.reset} ${element.name} found`);
          } else {
            console.log(`  ${colors.red}✗${colors.reset} ${element.name} missing`);
          }
        }

        // Check role labels
        const expectedRoles = roleLabels[locale];
        let missingRole = false;
        expectedRoles.forEach(role => {
          if (response.data.includes(role)) {
            console.log(`  ${colors.green}✓${colors.reset} Role card found: ${role}`);
          } else {
            missingRole = true;
            console.log(`  ${colors.red}✗${colors.reset} Role card missing: ${role}`);
          }
        });

        if (missingRole) {
          console.log(`  ${colors.yellow}⚠${colors.reset} Role buttons may require hydration to render fully.`);
        }
        
      } else {
        console.log(`${colors.red}✗${colors.reset} ${path} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} ${path} - Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Test authenticated home redirect
  console.log('Testing authenticated home page:');
  try {
    const response = await makeRequest('/ja/home');
    if (response.status === 200) {
      console.log(`${colors.green}✓${colors.reset} /ja/home - Status: ${response.status}`);
      const hasHomeLabel = /ホーム|Home/.test(response.data);
      if (hasHomeLabel) {
        console.log(`  ${colors.green}✓${colors.reset} Home label detected`);
      }
    } else {
      console.log(`${colors.yellow}⚠${colors.reset} /ja/home - Status: ${response.status} (might require auth)`);
    }
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} /ja/home - Error: ${error.message}`);
  }
  
  console.log('\n✅ Dev login testing completed!');
}

// Run the tests
testDevLogin().catch(console.error);
