import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// ── P4.1.2 — Content Security Policy ──────────────────────────────────────────

// Phase 7 — best-effort origin extraction for the CSP allowlist below.
// Malformed/absent env values fall back to `undefined` (filtered out),
// never to a wildcard — an unparsable value should shrink the allowlist,
// not silently open it up.
function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

function buildCspHeader(): string {
  const isDev = process.env.NODE_ENV === 'development'
  // 'unsafe-eval' is required by Next.js HMR in development only.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com`
    : `'self' 'unsafe-inline' https://js.stripe.com`

  // Phase 7 — connect-src previously allowed ANY http(s)/ws(s) origin
  // (`http: https: ws: wss:`), which defeats CSP's purpose for this
  // directive — it only blocked non-HTTP(S)/WS(S) schemes, not
  // exfiltration to an attacker-controlled endpoint via injected script.
  // Production now allows only: same-origin, the configured API/WS
  // backends (derived from the same env vars the app itself calls),
  // Stripe's API, Firebase Cloud Messaging's endpoints (harmless to list
  // even when FCM is unconfigured — see lib/firebase.ts's graceful
  // feature-detection), and the Sentry ingest origin parsed directly out
  // of the DSN when one is configured. Dev keeps the permissive form —
  // local dev regularly points at arbitrary localhost ports and tunnels,
  // and tightening it buys no production security benefit.
  const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_BASE_URL)
  const wsOrigin = originOf(process.env.NEXT_PUBLIC_WS_BASE_URL)
  const sentryOrigin = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN)

  const connectSrc = isDev
    ? `'self' http: https: ws: wss:`
    : [
        `'self'`,
        apiOrigin,
        wsOrigin,
        `https://api.stripe.com`,
        `https://fcm.googleapis.com`,
        `https://firebaseinstallations.googleapis.com`,
        sentryOrigin,
      ].filter(Boolean).join(' ')

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src ${connectSrc}`,
    // Stripe Elements (card input) and 3DS challenge frames render inside
    // an iframe from js.stripe.com/hooks.stripe.com — without this,
    // default-src 'self' silently blocks the card payment form.
    `frame-src 'self' https://js.stripe.com https://hooks.stripe.com`,
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ')
}

// changeAfterDev

// return [
//   `default-src 'self'`,
//   `script-src ${scriptSrc}`,
//   `style-src 'self' 'unsafe-inline'`,
//   `img-src 'self' data: blob: https:`,
//   `font-src 'self'`,
//   `connect-src 'self' https: wss:`,
//   `media-src 'self'`,
//   `object-src 'none'`,
//   `frame-ancestors 'none'`,
//   `base-uri 'self'`,
//   `form-action 'self'`,
// ].join('; ')

// P3.3 / Phase 7 — Mock mode safety: fail fast when production builds include
// mock data. NEXT_PUBLIC_USE_MOCK=true is only safe for local development and
// demo deploys. A production build with mock mode active bypasses real auth
// and exposes the demo@samoon.com/password backdoor to all users.
//
// Phase 7 — the ALLOW_PRODUCTION_MOCK escape hatch has been removed. It
// existed to unblock demo/staging builds that run with NODE_ENV=production,
// but any bypass here is exactly the kind of env var that gets left set in
// a CI/deploy pipeline by accident, silently defeating this guard for a
// real production deploy. There is no supported way to build with
// NODE_ENV=production and NEXT_PUBLIC_USE_MOCK=true — a demo/staging
// deploy that needs mock data should use NODE_ENV=development or a
// dedicated non-production NODE_ENV value instead.
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
  throw new Error(
    '[P3.3] Build aborted: NEXT_PUBLIC_USE_MOCK=true is not allowed in production. ' +
    'Set NEXT_PUBLIC_USE_MOCK=false (or unset it) before building for production. ' +
    'There is no override for this check.',
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

      { protocol: 'https', hostname: 'hot.ir-central1.arvanstorage.ir' },
      { protocol: 'https', hostname: 'staticmap.openstreetmap.de' },

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
