const createNextIntlPlugin = require('next-intl/plugin');
const path = require('path');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    // Keep the allow-list limited to the third parties used by the public UI.
    // `unsafe-inline` remains necessary while the layout contains inline theme,
    // GTM, and GA bootstrap scripts; it can be removed after those use nonces.
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://www.googletagmanager.com https://*.stripe.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://*.stripe.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://www.googletagmanager.com",
      "worker-src 'self' blob:",
    ].join('; '),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(), usb=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
  experimental: {
    // Keep middleware/proxy body clones above the 25 MiB attachment limit.
    // The task attachment route independently enforces a hard streaming limit.
    proxyClientMaxBodySize: '27mb',
  },
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    '/api/cron/reset-demo': [
      './scripts/seed-practical-verification.mjs',
      './node_modules/@libsql/**',
      './node_modules/@neon-rs/**',
      './node_modules/cross-fetch/**',
      './node_modules/cross-fetch/node_modules/**',
      './node_modules/data-uri-to-buffer/**',
      './node_modules/detect-libc/**',
      './node_modules/fetch-blob/**',
      './node_modules/formdata-polyfill/**',
      './node_modules/js-base64/**',
      './node_modules/libsql/**',
      './node_modules/node-domexception/**',
      './node_modules/node-fetch/**',
      './node_modules/promise-limit/**',
      './node_modules/tr46/**',
      './node_modules/web-streams-polyfill/**',
      './node_modules/webidl-conversions/**',
      './node_modules/whatwg-url/**',
      './node_modules/ws/**',
    ],
  },
  allowedDevOrigins: ['127.0.0.1'],
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/docs/05-quality/screenshots/**',
        '**/docs/archive/**',
        '**/docs/handoff/**',
        '**/docs/sample/**',
        '**/local.db*',
        '**/docs/05-quality/uc/**/logs/**',
      ],
    }

    if (!isServer) {
      // @libsql/client and drizzle-orm use Node.js modules (fs/path)
      // These modules are not available in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }
    return config
  },
};

module.exports = withNextIntl(nextConfig);
