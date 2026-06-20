# Savor — Hospitality SaaS Platform Frontend

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

**Savor** is the frontend for a hospitality SaaS platform built to support multiple business types (restaurant, cafe, bar, hotel, and others) across multiple tenants and locations. The frontend communicates with a Django REST Framework + Django Channels backend over HTTPS (REST) and WSS (WebSocket).

The current deployment is a single-tenant restaurant application. The roadmap direction is toward a configurable Tenant / Location / Module architecture that allows onboarding additional tenants and business types without forking the codebase.

A built-in **mock mode** (`NEXT_PUBLIC_USE_MOCK=true`) allows the application to run entirely without a backend, using simulated data and simulated WebSocket events.

**Framework:** Next.js 15 (App Router)  
**Backend target:** Django REST Framework + Django Channels (`smartrestaurant-web:8000`)

---

## Current Status

**Beta — not production ready, single-tenant only.**

| Layer | Completion |
|-------|-----------|
| Foundation architecture (Tenant / Location / Module) | 0% — not started |
| Platform governance (RBAC / feature flags / routing) | 0% — not started |
| Platform UI foundation (design tokens / theme engine / nav shell) | 0% — not started |
| Restaurant ordering flow (menu → cart → checkout → confirmation) | ~90% |
| User authentication | ~85% |
| User dashboard | ~80% |
| Reservations | ~85% |
| Admin panel | ~15% (UI shell only, no backend) |
| Real-time order tracking | ~40% (WebSocket built, not wired to UI) |
| **Overall (restaurant scope)** | **~65%** |
| **Overall (platform scope)** | **~33%** |

Key gaps blocking production: no route authentication middleware, no payment gateway, no CI pipeline, incomplete Arabic translations, missing PWA icons, WebSocket hooks not mounted. See [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) for the full audit. See [ROADMAP.md](./ROADMAP.md) for the sequenced plan.

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
| Testing | Vitest + Testing Library | ^2.1.8 | Unit tests for utils and cart store |
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
| `NEXT_PUBLIC_APP_NAME` | No | `Savor` | Application display name |
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

The production stack runs `savor-app` (Next.js, port 3000 internal) behind `savor-nginx` (ports 80/443). Nginx proxies `/api/` and `/ws/` to the Django backend and serves `/_next/static/` with a 1-year cache.

---

## Build & Deployment

```bash
npm run build   # produces .next/standalone — self-contained, no node_modules needed
npm start
```

```bash
docker build -t savor-frontend .   # multi-stage: Node 22 Alpine builder → runner
```

### Deployment Checklist

**Required before any production deployment:**

- [ ] Set `NEXT_PUBLIC_USE_MOCK=false`
- [ ] Set correct `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_BASE_URL`
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Add PWA icon files to `public/icons/` (72px through 512px)
- [ ] Add `public/og-image.jpg` (1200×630)
- [ ] Create external Docker network `shared-net` and volume `backend_static_volume`
- [ ] Configure SSL termination
- [ ] Implement authentication middleware (`src/middleware.ts`)
- [ ] Fill in Arabic translations (`src/i18n/locales/ar.json`)
- [ ] Wire WebSocket hooks to the UI (order tracking and notifications)
- [ ] Integrate a real payment gateway
- [ ] Stand up CI quality gates (lint, type-check, test, build)
- [ ] Initialize Sentry error tracking

**Required before onboarding a second tenant or business type (see ROADMAP.md):**

- [ ] Tenant, Location, and Module models wired through API and frontend (Phase 1A)
- [ ] RBAC foundation, feature flag system, and tenant-aware routing (Phase 1B)
- [ ] Shared design-token system and permission-aware navigation shell (Phase 2)

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
- **Push Notifications:** Web Push handler in `sw.js`; Firebase SDK installed but not yet initialized

> PWA icon files (`public/icons/*.png`) and `public/og-image.jpg` are referenced but not present in the repository and must be added before deployment.

---

## Related Documentation

- [Architecture & Design Decisions](./ARCHITECTURE.md)
- [Technical Debt Audit](./TECHNICAL_DEBT.md)
- [Product Roadmap](./ROADMAP.md)

---

## License

Proprietary — All rights reserved. License terms to be determined.
