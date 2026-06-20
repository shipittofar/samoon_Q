import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// P3.3 — Mock mode safety: fail fast when production builds include mock data.
// NEXT_PUBLIC_USE_MOCK=true is only safe for local development and demo deploys.
// A production build with mock mode active bypasses real auth and exposes
// the demo@savor.com/password backdoor to all users.
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
  throw new Error(
    '[P3.3] Build aborted: NEXT_PUBLIC_USE_MOCK=true is not allowed in production. ' +
    'Set NEXT_PUBLIC_USE_MOCK=false (or unset it) before building for production.',
  )
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  output: "standalone",
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
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
