import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// ── P4.1.2 — Content Security Policy ──────────────────────────────────────────

function buildCspHeader(): string {
  const isDev = process.env.NODE_ENV === 'development'
  // 'unsafe-eval' is required by Next.js HMR in development only.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'unsafe-inline'`

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self'`,
    `connect-src 'self' https: wss:`,
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ')
}

// P3.3 — Mock mode safety: fail fast when production builds include mock data.
// NEXT_PUBLIC_USE_MOCK=true is only safe for local development and demo deploys.
// A production build with mock mode active bypasses real auth and exposes
// the demo@savor.com/password backdoor to all users.

const allowMockProduction = process.env.ALLOW_PRODUCTION_MOCK === "true";

if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCK === 'true' && !allowMockProduction) {
  throw new Error(
    '[P3.3] Build aborted: NEXT_PUBLIC_USE_MOCK=true is not allowed in production. ' +
    'Set NEXT_PUBLIC_USE_MOCK=false (or unset it) before building for production.',
  )
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "http://77.221.156.197:3000",
    "http://localhost:3000",
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
    ],
  },
  experimental: {
    optimizeCss: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: buildCspHeader() },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
