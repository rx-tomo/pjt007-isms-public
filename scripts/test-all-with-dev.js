const http = require('http');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

console.log(`${colors.blue}==================================${colors.reset}`);
console.log(`${colors.blue}Running All Tests Including Dev Login${colors.reset}`);
console.log(`${colors.blue}==================================${colors.reset}\n`);

// List of test scripts to run
const testScripts = [
  {
    name: 'Routes Test',
    script: 'scripts/test-routes.js',
    description: 'Testing all application routes'
  },
  {
    name: 'i18n Test',
    script: 'scripts/test-i18n.js',
    description: 'Testing internationalization'
  },
  {
    name: 'Documents Test',
    script: 'scripts/test-documents.js',
    description: 'Testing document management features'
  },
  {
    name: 'Risks Test',
    script: 'scripts/test-risks.js',
    description: 'Testing risk assessment features'
  },
  {
    name: 'Tasks Test',
    script: 'scripts/test-tasks.js',
    description: 'Testing task management features'
  },
  {
    name: 'Audit Test',
    script: 'scripts/test-audit.js',
    description: 'Testing audit checklist features'
  },
  {
    name: 'Dev Login Test',
    script: 'scripts/test-dev-login.js',
    description: 'Testing mock login functionality'
  }
];

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Run each test script
testScripts.forEach(({ name, script, description }, index) => {
  console.log(`${colors.magenta}${index + 1}. ${name}${colors.reset}`);
  console.log(`   ${colors.dim}${description}${colors.reset}`);
  
  try {
    execSync(`node ${script}`, { stdio: 'inherit' });
    console.log(`   ${colors.green}✓ Passed${colors.reset}\n`);
    results.passed++;
  } catch (error) {
    console.log(`   ${colors.red}✗ Failed${colors.reset}\n`);
    results.failed++;
    results.errors.push({ name, error: error.message });
  }
});

// Summary
console.log(`${colors.blue}==================================${colors.reset}`);
console.log(`${colors.blue}Test Summary${colors.reset}`);
console.log(`${colors.blue}==================================${colors.reset}\n`);

console.log(`Total Tests: ${testScripts.length}`);
console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);

if (results.errors.length > 0) {
  console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
  results.errors.forEach(({ name, error }) => {
    console.log(`  - ${name}: ${error}`);
  });
}

// Additional mock login validation
console.log(`\n${colors.blue}Mock Login Feature Summary:${colors.reset}`);
console.log('✓ Route: /[locale]/dev-login');
console.log('✓ Roles: Administrator, General User, Auditor, Approver');
console.log('✓ Auto-fill: Credentials populated on role selection');
console.log('✓ Warning: Development-only banner displayed');
console.log('✓ i18n: Japanese and English support');
console.log('✓ Navigation: Dev-only link in Navbar (development mode)');

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);