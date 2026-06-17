const createNextIntlPlugin = require('next-intl/plugin');
const path = require('path');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: ['127.0.0.1'],
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/test-results/**',
        '**/playwright-report/**',
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
