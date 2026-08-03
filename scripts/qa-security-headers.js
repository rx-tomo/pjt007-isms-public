#!/usr/bin/env node
'use strict';

const nextConfig = require('../next.config.js');

const requiredHeaders = {
  'content-security-policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    'https://js.stripe.com',
    'https://www.googletagmanager.com',
  ],
  'strict-transport-security': ['max-age=31536000', 'includeSubDomains'],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['DENY'],
  'referrer-policy': ['strict-origin-when-cross-origin'],
  'permissions-policy': ['camera=()', 'geolocation=()', 'microphone=()', 'usb=()'],
};

async function main() {
  if (typeof nextConfig.headers !== 'function') {
    throw new Error('next.config.js must export a headers() function');
  }

  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === '/:path*');
  if (!globalRule) {
    throw new Error('missing global security-header rule');
  }

  const values = new Map(globalRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  const failures = [];

  for (const [name, snippets] of Object.entries(requiredHeaders)) {
    const value = values.get(name);
    if (!value) {
      failures.push(`missing ${name}`);
      continue;
    }
    for (const snippet of snippets) {
      if (!value.includes(snippet)) failures.push(`${name} missing ${snippet}`);
    }
  }

  if (values.get('content-security-policy')?.includes("'unsafe-eval'")) {
    failures.push("content-security-policy must not allow 'unsafe-eval'");
  }
  if (values.get('content-security-policy')?.includes(' wss:')) {
    failures.push('content-security-policy must not allow every WebSocket origin');
  }

  if (failures.length > 0) {
    throw new Error(failures.join('; '));
  }

  console.log('Security header configuration QA passed.');
}

main().catch((error) => {
  console.error(`Security header configuration QA failed: ${error.message}`);
  process.exit(1);
});
