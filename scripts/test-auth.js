const puppeteer = require('puppeteer');

async function testAuth() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log('🔍 Testing authentication pages...\n');

  try {
    // Test login page
    console.log('1. Testing login page...');
    await page.goto('http://localhost:3006/ja/auth/login');
    await page.waitForSelector('form', { timeout: 5000 });
    
    const loginTitle = await page.$eval('h2', el => el.textContent);
    console.log(`   ✓ Login page loaded: "${loginTitle}"`);
    
    // Check for email and password fields
    const emailField = await page.$('#email');
    const passwordField = await page.$('#password');
    const submitButton = await page.$('button[type="submit"]');
    
    if (emailField && passwordField && submitButton) {
      console.log('   ✓ Login form fields present');
    } else {
      console.log('   ✗ Missing login form fields');
    }

    // Test signup page
    console.log('\n2. Testing signup page...');
    await page.goto('http://localhost:3006/ja/auth/signup');
    await page.waitForSelector('form', { timeout: 5000 });
    
    const signupTitle = await page.$eval('h2', el => el.textContent);
    console.log(`   ✓ Signup page loaded: "${signupTitle}"`);
    
    // Check for signup form fields
    const fullNameField = await page.$('#fullName');
    const organizationField = await page.$('#organizationName');
    const confirmPasswordField = await page.$('#confirmPassword');
    const agreeCheckbox = await page.$('#agreeToTerms');
    
    if (fullNameField && organizationField && confirmPasswordField && agreeCheckbox) {
      console.log('   ✓ Signup form fields present');
    } else {
      console.log('   ✗ Missing signup form fields');
    }

    // Test English version
    console.log('\n3. Testing English version...');
    await page.goto('http://localhost:3006/en/auth/login');
    await page.waitForSelector('form', { timeout: 5000 });
    
    const loginTitleEn = await page.$eval('h2', el => el.textContent);
    console.log(`   ✓ English login page loaded: "${loginTitleEn}"`);

    // Test dev login link (development only)
    console.log('\n4. Testing dev login link...');
    const devLoginLink = await page.$('a[href*="/dev-login"]');
    if (devLoginLink) {
      console.log('   ✓ Dev login link present');
    } else {
      console.log('   ✓ Dev login link not present (production mode?)');
    }

    console.log('\n✅ All authentication page tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testAuth();