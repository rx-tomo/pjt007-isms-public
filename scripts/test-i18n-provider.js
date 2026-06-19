#!/usr/bin/env node

const http = require('http');
const https = require('https');

const testUrls = [
  'http://localhost:3000',
  'http://localhost:3000/ja',
  'http://localhost:3000/en',
];

console.log('Testing i18n routes...\n');

function testUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const hasProvider = data.includes('NextIntlClientProvider') || res.statusCode === 200;
        console.log(`${url}: ${res.statusCode} - ${hasProvider ? 'OK' : 'Missing Provider'}`);
        resolve({ url, status: res.statusCode, hasProvider });
      });
    }).on('error', (err) => {
      console.log(`${url}: ERROR - ${err.message}`);
      resolve({ url, status: 'ERROR', error: err.message });
    });
  });
}

async function runTests() {
  console.log('Note: Make sure the development server is running (npm run dev)\n');
  
  for (const url of testUrls) {
    await testUrl(url);
  }
  
  console.log('\nTest complete!');
}

runTests();