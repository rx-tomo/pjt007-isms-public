const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Test configuration
const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);
const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;
const RESULTS_DIR = path.join(__dirname, '..', 'test-results');
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const DEFAULT_LOCALES = ['ja', 'en'];
const DOCUMENT_ROUTES = [
  '/documents',
  '/documents/new',
  '/documents/templates'
];
const EXPECTED_CONTENT = {
  ja: {
    '/documents': ['文書管理'],
    '/documents/new': ['文書編集', '文書タイトル'],
    '/documents/templates': ['ISMSテンプレート', '読み込み中']
  },
  en: {
    '/documents': ['Document Management'],
    '/documents/new': ['Document Editor', 'Document Title'],
    '/documents/templates': ['ISMS Templates', 'Loading']
  }
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function parseLocaleList(value) {
  return value
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
}

function resolveLocales() {
  const localesFromArgs = () => {
    const index = process.argv.indexOf('--locales');
    if (index === -1) {
      return null;
    }
    const value = process.argv[index + 1];
    if (!value) {
      console.error('❌ --locales オプションの後に値を指定してください (例: --locales ja,en)');
      process.exit(1);
    }
    return parseLocaleList(value);
  };

  const localesFromEnv = () => {
    const value = process.env.QA_LOCALES || process.env.QA_LOCALE;
    if (!value) {
      return null;
    }
    return parseLocaleList(value);
  };

  const candidates = localesFromArgs() || localesFromEnv();
  if (!candidates || candidates.length === 0) {
    return DEFAULT_LOCALES;
  }
  return Array.from(new Set(candidates));
}

function writeLocaleLog(locale, results, runTimestamp) {
  const safeStamp = runTimestamp.replace(/[:]/g, '-').replace(/\./g, '-');
  const filename = `qa-documents-${locale}-${safeStamp}.log`;
  const logPath = path.join(RESULTS_DIR, filename);
  const payload = {
    timestamp: runTimestamp,
    baseUrl: BASE_URL,
    locale,
    routes: results
  };
  fs.writeFileSync(logPath, JSON.stringify(payload, null, 2), 'utf8');
  return path.relative(process.cwd(), logPath);
}

// Helper function to make HTTP requests
async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body: data
        });
      });
    });
    
    request.on('error', reject);
    request.setTimeout(Number(process.env.QA_REQUEST_TIMEOUT_MS || 20000), () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Check if a route contains expected document content
function checkDocumentContent(body, locale, route) {
  const routeKey = route;
  const expectedTexts = EXPECTED_CONTENT[locale]?.[routeKey] || [];
  
  const missingTexts = expectedTexts.filter(text => !body.includes(text));
  
  return {
    hasExpectedContent: missingTexts.length === 0,
    missingTexts
  };
}

// Test a single route
async function testRoute(locale, route) {
  const url = `${BASE_URL}/${locale}${route}`;
  console.log(`\nTesting: ${colors.cyan}${url}${colors.reset}`);

  const result = {
    locale,
    route,
    url,
    statusCode: null,
    success: false,
    missingTexts: [],
    redirectLocation: null,
    error: null,
    expectedTexts: EXPECTED_CONTENT[locale]?.[route] || []
  };

  try {
    const response = await makeRequest(url);
    result.statusCode = response.statusCode;

    if (response.statusCode === 200) {
      console.log(`  ✓ Status: ${colors.green}${response.statusCode}${colors.reset}`);
    } else if (response.statusCode >= 300 && response.statusCode < 400) {
      console.log(`  ⚠ Status: ${colors.yellow}${response.statusCode} (Redirect)${colors.reset}`);
      if (response.headers.location) {
        result.redirectLocation = response.headers.location;
        console.log(`    → Redirects to: ${response.headers.location}`);
      }
    } else {
      console.log(`  ✗ Status: ${colors.red}${response.statusCode}${colors.reset}`);
    }

    if (response.statusCode !== 200) {
      result.error = `Unexpected status code ${response.statusCode}`;
    }

    const contentCheck = checkDocumentContent(response.body, locale, route);
    result.missingTexts = contentCheck.missingTexts;

    if (contentCheck.hasExpectedContent) {
      console.log(`  ✓ Content: ${colors.green}Expected document content found${colors.reset}`);
    } else {
      console.log(`  ✗ Content: ${colors.red}Missing expected content${colors.reset}`);
      contentCheck.missingTexts.forEach(text => {
        console.log(`    - Missing: "${text}"`);
      });
      result.error = result.error || 'Missing expected content';
    }

    if (response.body.includes('Error') || response.body.includes('error')) {
      console.log(`  ⚠ ${colors.yellow}Page contains error text${colors.reset}`);
    }

    result.success = response.statusCode === 200 && contentCheck.hasExpectedContent;

    return result;
  } catch (error) {
    console.log(`  ✗ Error: ${colors.red}${error.message}${colors.reset}`);
    result.error = error.message;
    return result;
  }
}

// Main test runner
async function runTests() {
  const locales = resolveLocales();
  const runTimestamp = new Date().toISOString();
  console.log(`${colors.cyan}=== Document Management Feature Tests ===${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Locales: ${locales.join(', ')}`);
  console.log(`Testing ${locales.length} locales × ${DOCUMENT_ROUTES.length} routes = ${locales.length * DOCUMENT_ROUTES.length} total tests\n`);

  let passedTests = 0;
  let totalTests = 0;
  const logPaths = [];

  for (const locale of locales) {
    console.log(`\n${colors.yellow}Testing locale: ${locale}${colors.reset}`);
    console.log('─'.repeat(40));

    const localeResults = [];

    for (const route of DOCUMENT_ROUTES) {
      totalTests++;
      const result = await testRoute(locale, route);
      localeResults.push(result);
      if (result.success) {
        passedTests++;
      }
    }

    const logPath = writeLocaleLog(locale, localeResults, runTimestamp);
    logPaths.push(logPath);
    console.log(`\n📝 Saved log for ${locale}: ${logPath}`);
  }

  const failedTests = totalTests - passedTests;

  console.log(`\n${colors.cyan}=== Test Summary ===${colors.reset}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Failed: ${colors.red}${failedTests}${colors.reset}`);
  if (logPaths.length > 0) {
    console.log('Log files:');
    logPaths.forEach(logPath => {
      console.log(`  - ${logPath}`);
    });
  }

  if (failedTests === 0) {
    console.log(`\n${colors.green}✓ All document tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}✗ Some tests failed${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Test runner error:${colors.reset}`, error);
  process.exit(1);
});
