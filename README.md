# Samoon — Hospitality SaaS Platform Frontend

> Next.js 15 frontend for a multi-tenant hospitality ordering and operations platform.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Current Status](#current-status)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Docker](#docker)
- [Build & Deployment](#build--deployment)
- [Internationalization](#internationalization)
- [PWA](#pwa)
- [Related Documentation](#related-documentation)
- [License](#license)

---

## Project Overview

**Samoon** is the frontend for a hospitality SaaS platform built to support multiple business types (restaurant, cafe, bar, hotel, and others) across multiple tenants and locations. The frontend communicates with a Django REST Framework + Django Channels backend over HTTPS (REST) and WSS (WebSocket).

The current deployment is a single-tenant restaurant application. The roadmap direction is toward a configurable Tenant / Location / Module architecture that allows onboarding additional tenants and business types without forking the codebase.

A built-in **mock mode** (`NEXT_PUBLIC_USE_MOCK=true`) allows the application to run entirely without a backend, using simulated data and simulated WebSocket events.

**Framework:** Next.js 15 (App Router)  
**Backend target:** Django REST Framework + Django Channels (`smartrestaurant-web:8000`)

---

## Current Status

**Feature-complete frontend — backend integration and CI pipeline required before production.**

All frontend phases through P7.14.5 are complete. The application runs fully in mock mode with 4,651 passing tests and 0 TypeScript/ESLint errors.

| Layer | Completion |
|-------|-----------|
| Foundation architecture (Tenant / Location / Module / RBAC) | ✅ 100% |
| Platform governance (RBAC / feature flags / routing / module registry) | ✅ 100% |
| Platform UI foundation (design tokens / theme engine / nav shell) | ✅ 100% |
| Restaurant ordering flow (menu → cart → checkout → confirmation) | ✅ 100% |
| User authentication | ✅ 100% |
| User dashboard | ✅ 100% |
| Reservations | ✅ 100% |
| Admin panel (all pages, RBAC-guarded, API-backed via mock) | ✅ 100% |
| Real-time operations (WebSocket, kitchen display, SLA monitor) | ✅ 100% |
| Analytics (menu, revenue, branch, export) | ✅ 100% |
| Hospitality modules (cafe, bar, food court, food truck, mobile cafe) | ✅ 100% |
| Bulk operations (orders, reservations, customers) | ✅ 100% |
| PWA (manifest, service worker, push notifications) | ✅ 100% |
| Audit logs & activity tracking | ✅ 100% |
| Staff management | ✅ 100% |
| Loyalty & promotions | ✅ 100% |
| Customer reviews | ✅ 100% |
| Order tracking (real-time subroute) | ✅ 100% |
| Localization (en/fa) | ✅ 100% (Arabic incomplete — 14/187 keys) |
| **Overall (platform scope)** | **~95%** |

Remaining gaps: no real backend (all data mocked), no CI pipeline, Arabic translation incomplete, Firebase VAPID key placeholder, no Sentry initialization, no payment gateway. See [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) for the full audit. See [ROADMAP.md](./ROADMAP.md) for the sequenced plan.

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Framework | Next.js | ^15.1.0 | App Router, Server Components, standalone output |
| Language | TypeScript | ^5.7.2 | Strict mode |
| Styling | Tailwind CSS | ^4.0.0 | CSS custom properties for theming |
| Animation | Framer Motion | ^11.15.0 | Page transitions, list animations, modals |
| State Management | Zustand | ^5.0.2 | 7 stores with `persist` middleware |
| Server State | TanStack React Query | ^5.62.7 | Caching, stale-time, polling |
| Forms | React Hook Form + Zod | ^7.54.1 / ^3.24.1 | Type-safe validation |
| HTTP Client | Axios | ^1.7.9 | JWT interceptors, auto-refresh on 401 |
| WebSocket | Native WS API | — | Custom `DjangoChannelsWebSocket` class |
| Internationalization | next-intl | ^3.26.3 | 3 locales, cookie/header detection |
| UI Components | Radix UI | various | Dialog, Select, Tabs, Switch, Toast, etc. |
| Icons | Lucide React | ^0.468.0 | — |
| Push Notifications | Firebase | ^11.1.0 | Installed but not initialized |
| PWA | Custom Service Worker | — | `public/sw.js`; `next-pwa` installed but unused |
| Fonts | Google Fonts | — | Playfair Display, DM Sans, Vazirmatn (RTL) |
| Testing | Vitest + Testing Library | ^2.1.8 | 59 test files, 4,651 tests passing |
| Build | Next.js + SWC/Turbopack | — | `--turbopack` for dev, standalone for prod |
| Container | Docker (multi-stage) | — | Builder + Alpine runner |
| Reverse Proxy | Nginx | alpine | Rate limiting, caching, WS proxy |
| CI/CD | Not configured | — | No CI pipeline exists |

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- (Optional) Docker + Docker Compose
- (Optional) A running Django backend at `NEXT_PUBLIC_API_BASE_URL`

### Installation

```bash
git clone <repository-url>
cd <project-directory>
npm install
cp .env.example .env.local
# Edit .env.local — leave NEXT_PUBLIC_USE_MOCK=true for local dev without a backend
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_APP_NAME` | No | `Samoon` | Application display name |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | `http://localhost:3000` | Canonical URL for metadata & sitemap |
| `NEXT_PUBLIC_API_BASE_URL` | Yes (prod) | `http://localhost:8000/api` | Django REST API base URL |
| `NEXT_PUBLIC_WS_BASE_URL` | Yes (prod) | `ws://localhost:8000/ws` | Django Channels WebSocket base URL |
| `NEXT_PUBLIC_USE_MOCK` | No | `true` | Set to `false` to use real backend |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Optional | — | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Optional | — | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Optional | — | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional | — | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional | — | Firebase Cloud Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Optional | — | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Optional | — | VAPID key for Web Push |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional | — | Google Analytics measurement ID |
| `SENTRY_DSN` | Optional | — | Sentry DSN for server-side errors |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | — | Sentry DSN for client-side errors |

> **Warning:** `NEXT_PUBLIC_USE_MOCK=true` serves simulated data to real users. Always set `NEXT_PUBLIC_USE_MOCK=false` in production.

---

## Running Locally

```bash
# Development (Turbopack)
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Tests
npm test

# Tests with UI
npm run test:ui

# Coverage
npm run test:coverage
```

The dev server starts at `http://localhost:3000`.

**Mock mode credentials:**  
Email: any email / Password: any password → logs in as `John Doe`

**Mock discount codes:**  
`SAVE10` (10% off) · `WEEKEND20` (20% off) · `FIRST5` ($5 off)

---

## Docker

### Development

```bash
docker compose -f docker-compose.dev.yml up
```

### Production

```bash
# Requires an external Docker network and volume shared with the Django service
docker network create shared-net
docker volume create backend_static_volume

docker compose up -d
```

The production stack runs `samoon-app` (Next.js, port 3000 internal) behind `samoon-nginx` (ports 80/443). Nginx proxies `/api/` and `/ws/` to the Django backend and serves `/_next/static/` with a 1-year cache.

---

## Build & Deployment

```bash
npm run build   # produces .next/standalone — self-contained, no node_modules needed
npm start
```

```bash
docker build -t samoon-frontend .   # multi-stage: Node 22 Alpine builder → runner
```

### Deployment Checklist

**Frontend complete — remaining items are backend/infrastructure:**

- [ ] Set `NEXT_PUBLIC_USE_MOCK=false`
- [ ] Set correct `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_BASE_URL`
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [x] PWA icon files present in `public/icons/`
- [x] `public/og-image.jpg` present
- [ ] Create external Docker network `shared-net` and volume `backend_static_volume`
- [ ] Configure SSL termination
- [ ] Implement authentication middleware (`src/middleware.ts`) — currently client-side only via `AuthGuard`
- [ ] Fill in Arabic translations (`src/i18n/locales/ar.json`) — 14/187 keys done
- [ ] Stand up CI quality gates (lint, type-check, test, build)
- [ ] Initialize Firebase with real VAPID key (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`)
- [ ] Initialize Sentry error tracking (`NEXT_PUBLIC_SENTRY_DSN`)
- [ ] Integrate a real payment gateway
- [ ] Stand up Django backend with all API endpoints (see `docs/BACKEND_API_CONTRACT.md`)

---

## Internationalization

| Code | Language | Direction | Status |
|------|----------|-----------|--------|
| `en` | English | LTR | Complete (187 keys) |
| `fa` | Persian (Farsi) | RTL | Complete (187 keys) |
| `ar` | Arabic | RTL | Incomplete (14/187 keys) |

Locale is detected from the `NEXT_LOCALE` cookie, then `Accept-Language` header, defaulting to `en`. RTL layout is applied automatically via `dir="rtl"` on `<html>` and Tailwind logical property classes throughout the codebase.

---

## PWA

- **Manifest:** `public/manifest.json` — display: standalone, theme: orange (#f97316), shortcuts for Order Food / My Orders / Reserve Table
- **Service Worker:** `public/sw.js` — cache-first for static assets, network-first with fallback for API calls
- **Push Notifications:** Web Push handler in `sw.js`; `firebase-messaging-sw.js` registered; `useNotificationPermission` hook and `PushNotificationSettings` component implemented. Requires real VAPID key for production.

> PWA icon files (`public/icons/*.png`) and `public/og-image.jpg` are referenced but not present in the repository and must be added before deployment.

---

## Related Documentation

- [Architecture & Design Decisions](./ARCHITECTURE.md)
- [Technical Debt Audit](./TECHNICAL_DEBT.md)
- [Product Roadmap](./ROADMAP.md)

---

## License

Proprietary — All rights reserved. License terms to be determined.
