# Savor — Fine Dining & Delivery

> A full-featured restaurant web application built with Next.js 15, supporting online ordering, table reservations, real-time order tracking, and multi-language support.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Screens & Modules](#screens--modules)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Docker](#docker)
- [Build & Deployment](#build--deployment)
- [Internationalization](#internationalization)
- [PWA](#pwa)
- [State Management](#state-management)
- [API Architecture](#api-architecture)
- [Security Notes](#security-notes)
- [Related Documentation](#related-documentation)
- [License](#license)

---

## Project Overview

**Savor** is the frontend for a hospitality SaaS platform. The current codebase is a single-tenant restaurant progressive web application (PWA); the platform direction is toward multi-tenant operation supporting multiple hospitality business types (restaurant, cafe, bar, hotel, and others) via a configurable Tenant / Location / Module architecture.

In its current state, the application enables end-to-end food ordering (delivery, pickup, dine-in), table reservations, real-time order tracking, and multi-branch management — with support for English, Persian (Farsi), and Arabic with automatic RTL layout switching.

**Current status: Beta — not production ready, single-tenant only.** The codebase has no Tenant/Location/Module abstraction, no route authentication middleware, and no CI pipeline. The foundation layers (Phases 1A, 1B, and 2 in the roadmap) are 0% complete. The existing restaurant feature set is approximately 65% complete. See [ROADMAP.md](./ROADMAP.md) for the full production readiness assessment and sequenced plan.

The frontend integrates with a Django REST Framework + Django Channels backend (WebSocket for real-time updates). A built-in **mock mode** (`NEXT_PUBLIC_USE_MOCK=true`) allows the application to run entirely standalone with simulated data and simulated WebSocket events, making local development possible without a running backend.

**Application Name:** Savor  
**Version:** 1.0.0  
**Framework:** Next.js 15 (App Router)  
**Backend Target:** Django REST Framework + Django Channels (`smartrestaurant-web:8000`)

---

## Features

### Feature Status Matrix

| Feature | Status | Evidence | Missing Pieces | Risk Level |
|---------|--------|----------|----------------|------------|
| Menu Browsing | `COMPLETE` | `src/app/menu/page.tsx`, `menuService.getItems()` | — | Low |
| Category Filtering | `COMPLETE` | `menuService.getItems({ category })`, URL params synced | — | Low |
| Search (debounced) | `COMPLETE` | `menuService.search()`, 350ms debounce in menu page | — | Low |
| Advanced Filters (price/rating/availability) | `COMPLETE` | Filter panel in `src/app/menu/page.tsx` | — | Low |
| Sort Options | `COMPLETE` | 5 sort modes in `menuService.getItems()` | — | Low |
| Grid / List View Toggle | `COMPLETE` | ViewMode state in menu page | — | Low |
| Food Detail Modal | `COMPLETE` | `FoodDetailModal.tsx`, extras, notes, quantity | — | Low |
| Recently Viewed | `COMPLETE` | `useRecentlyViewedStore` persisted to localStorage | — | Low |
| Shopping Cart | `COMPLETE` | `useCartStore` (Zustand persist), extras, notes, quantity | — | Low |
| Cart Drawer + Floating Button | `COMPLETE` | `CartDrawer.tsx`, FloatingCart component | — | Low |
| Discount Codes | `COMPLETE` | `orderService.validateDiscountCode()`, 3 mock codes | — | Low |
| Checkout (3 order types) | `COMPLETE` | `src/app/checkout/page.tsx`, Zod validation | — | Low |
| Payment Method Selection | `COMPLETE` | card/cash/online/wallet selectors in checkout | No real payment gateway | Medium |
| Order Creation | `COMPLETE` | `orderService.createOrder()` → API or mock | — | Low |
| Order Tracking | `COMPLETE` | `OrderTracker.tsx`, mock simulation via `simulateOrderUpdates()` | Real WS not wired to tracker UI | Medium |
| Order Success/Failure Pages | `COMPLETE` | `/checkout/success`, `/checkout/failure` | — | Low |
| User Authentication (email) | `COMPLETE` | `authService.login/register()`, JWT + refresh | — | Low |
| OTP Phone Verification | `COMPLETE` | `authService.verifyOTP/sendOTP()`, `/verify-otp` page | No SMS gateway | Medium |
| Forgot Password | `COMPLETE` | `authService.forgotPassword()`, `/forgot-password` page | — | Low |
| User Dashboard | `COMPLETE` | `/dashboard` with orders, reservations, stats | — | Low |
| Dashboard Orders | `COMPLETE` | `src/app/dashboard/orders/page.tsx`, `useOrders()` hook | — | Low |
| Dashboard Favorites | `COMPLETE` | `src/app/dashboard/favorites/page.tsx`, `useFavoritesStore` | — | Low |
| Dashboard Addresses | `COMPLETE` | `src/app/dashboard/addresses/page.tsx`, CRUD via `userService` | — | Low |
| Dashboard Reservations | `COMPLETE` | `src/app/dashboard/reservations/page.tsx` | — | Low |
| Dashboard Settings (profile/theme/lang) | `COMPLETE` | `src/app/dashboard/settings/page.tsx` | — | Low |
| Reservations | `COMPLETE` | `reservationService.create()`, time slot picker | — | Low |
| Branch Selector | `COMPLETE` | `BranchSelector.tsx`, `useBranchStore` (persisted) | — | Low |
| Notifications Center | `COMPLETE` | `NotificationCenter.tsx`, `useNotificationStore` | — | Low |
| WebSocket (order updates) | `PARTIALLY_IMPLEMENTED` | `websocket.service.ts`, `useOrderWebSocket` hook exist; not wired to OrderTracker UI | Tracker uses mock simulation instead | High |
| WebSocket (notifications) | `PARTIALLY_IMPLEMENTED` | `useNotificationWebSocket` hook exists | Hook not mounted anywhere in the app | High |
| Firebase Push Notifications | `PARTIALLY_IMPLEMENTED` | `firebase` package installed, `NEXT_PUBLIC_FIREBASE_*` env vars defined, `registerDevice` in notificationService | No Firebase initialization code exists in codebase | High |
| Favorites (toggle) | `COMPLETE` | `useFavoritesStore`, `useToggleFavorite()` with optimistic update | — | Low |
| QR Table Ordering | `PARTIALLY_IMPLEMENTED` | `/table/[tableId]` page renders welcome banner + menu | Table number not passed through to order flow | Medium |
| Admin Dashboard (Stats) | `UI_ONLY` | `src/app/admin/stats/page.tsx` — all data hardcoded | No API, no auth guard | Critical |
| Admin Orders Management | `UI_ONLY` | `src/app/admin/orders/page.tsx` — local state only | No API, no auth guard | Critical |
| Admin Menu Management | `UI_ONLY` | `src/app/admin/menu/page.tsx` — mutates local state only | No API, no auth guard | Critical |
| Admin Customers | `UI_ONLY` | `src/app/admin/customers/page.tsx` — hardcoded MOCK_CUSTOMERS | No API, no auth guard | Critical |
| Admin Reservations | `UI_ONLY` | `src/app/admin/reservations/page.tsx` — local state only | No API, no auth guard | Critical |
| Localization (English) | `COMPLETE` | `src/i18n/locales/en.json` — 187 lines, complete | — | Low |
| Localization (Persian/Farsi) | `COMPLETE` | `src/i18n/locales/fa.json` — 187 lines, mirrors EN | — | Low |
| Localization (Arabic) | `UI_ONLY` | `src/i18n/locales/ar.json` — only 14 lines (empty shell) | 173 translation keys missing | High |
| RTL Layout Support | `COMPLETE` | `dir="rtl"` set in `layout.tsx` + CSS logical properties used | — | Low |
| Dark / Light / System Theme | `COMPLETE` | `useThemeStore`, theme CSS vars in `globals.css` | — | Low |
| PWA Manifest | `COMPLETE` | `public/manifest.json` with shortcuts | Icon files referenced but absent | High |
| PWA Service Worker | `COMPLETE` | `public/sw.js` — cache-first static, network-first API | — | Low |
| Offline Page | `COMPLETE` | `src/app/offline/page.tsx` | — | Low |
| SEO (metadata / sitemap / JSON-LD) | `COMPLETE` | `src/app/sitemap.ts`, `JsonLd.tsx`, per-page metadata | — | Low |
| Reviews | `BACKEND_MISSING` | Types in `types/index.ts`, endpoints in `endpoints.ts` | No UI, no hooks, no service methods | Medium |
| Payment Gateway | `BACKEND_MISSING` | Payment method types defined, checkout form exists | No Stripe/PayPal/etc. integration | High |
| Sentry Error Tracking | `PLANNED` | `SENTRY_DSN` in `.env.example` | No `@sentry/nextjs` package, no init code | Low |
| Google Analytics | `PLANNED` | `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env.example` | No `@next/third-parties` or gtag code | Low |
| Image Upload (Avatar / Menu) | `BACKEND_MISSING` | Avatar field in User type | No file upload UI or service | Medium |
| Route Authentication Guards | `MISSING` | No `middleware.ts` exists | Dashboard and admin routes are publicly accessible | Critical |

---

## Screens & Modules

### Public Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `src/app/page.tsx` | Landing page: hero, stats, categories, featured dishes, CTA |
| `/menu` | `src/app/menu/page.tsx` | Full menu with search, category tabs, filters, sort, grid/list view, detail modal |
| `/restaurant` | `src/app/restaurant/page.tsx` | Restaurant info page |
| `/reservation` | `src/app/reservation/page.tsx` | Reservation booking form with time-slot picker |
| `/table/[tableId]` | `src/app/table/[tableId]/page.tsx` | QR scan landing: sets dine-in context, then shows menu |
| `/offline` | `src/app/offline/page.tsx` | PWA offline fallback |
| `/not-found` | `src/app/not-found.tsx` | 404 page |

### Authentication Pages

| Route | Description |
|-------|-------------|
| `/login` | Email + password login with react-hook-form + Zod |
| `/register` | Full registration form with password confirmation |
| `/forgot-password` | Email submission for password reset |
| `/verify-otp` | Phone OTP verification |

### Checkout Flow

| Route | Description |
|-------|-------------|
| `/checkout` | Order type selection, address/table input, payment method, discount code, order summary |
| `/checkout/success` | Confirmation with order number, confetti animation, live order tracker |
| `/checkout/failure` | Payment failure page with retry options |

### User Dashboard

| Route | Description |
|-------|-------------|
| `/dashboard` | Overview: active order, recent orders, upcoming reservations, quick actions |
| `/dashboard/orders` | Full order history with search and status badges |
| `/dashboard/reservations` | Upcoming and past reservations with cancellation |
| `/dashboard/favorites` | Saved menu items with add-to-cart |
| `/dashboard/addresses` | Saved delivery addresses with CRUD |
| `/dashboard/settings` | Profile editing, theme switcher, language selector, notification preferences |

### Admin Panel (UI Preview Only)

| Route | Description |
|-------|-------------|
| `/admin/stats` | KPI cards, recent orders table, top items — all hardcoded |
| `/admin/orders` | Live-ish order board with local status advancement — mock only |
| `/admin/menu` | Menu item list with toggle availability, delete, edit modal — mock only |
| `/admin/customers` | Customer list with VIP tagging — hardcoded fixture data |
| `/admin/reservations` | Reservation list with date navigator, approve/cancel — local state only |

### Components

| Component | Location | Description |
|-----------|----------|-------------|
| `Header` | `components/layout/Header.tsx` | Navbar with auth state, cart icon, notification center, branch selector |
| `Navbar` | `components/layout/Navbar.tsx` | Mobile bottom navigation |
| `Footer` | `components/layout/Footer.tsx` | Site footer |
| `MainLayout` | `components/layout/MainLayout.tsx` | Wraps dashboard pages with sidebar navigation |
| `CartDrawer` + `FloatingCart` | `components/cart/CartDrawer.tsx` | Slide-in cart with item controls and summary |
| `FoodCard` | `components/menu/FoodCard.tsx` | Menu item card with add-to-cart, favorites, badge display |
| `FoodDetailModal` | `components/menu/FoodDetailModal.tsx` | Full item view with extras, notes, quantity |
| `OrderTracker` | `components/order/OrderTracker.tsx` | Animated step-by-step order status progress |
| `NotificationCenter` | `components/notification/NotificationCenter.tsx` | Bell dropdown with unread badges, mark-read |
| `BranchSelector` | `components/common/BranchSelector.tsx` | Branch selection popover |
| `PageTransition` | `components/common/PageTransition.tsx` | Framer Motion page transition wrapper |
| `JsonLd` | `components/common/JsonLd.tsx` | Structured data injection for SEO |
| `Button`, `Input`, `Modal` | `components/ui/` | Reusable UI primitives |

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Framework | Next.js | ^15.1.0 | App Router, Server Components, standalone output |
| Language | TypeScript | ^5.7.2 | Strict mode |
| Styling | Tailwind CSS | ^4.0.0 | CSS custom properties for theming |
| Animation | Framer Motion | ^11.15.0 | Page transitions, list animations, modals |
| State Management | Zustand | ^5.0.2 | 7 stores, all with `persist` middleware |
| Server State | TanStack React Query | ^5.62.7 | Caching, stale-time, polling |
| Forms | React Hook Form + Zod | ^7.54.1 / ^3.24.1 | Type-safe validation on all forms |
| HTTP Client | Axios | ^1.7.9 | JWT interceptors, auto-refresh on 401 |
| WebSocket | Socket.IO Client / native WS | ^4.8.1 | Custom `DjangoChannelsWebSocket` class |
| Internationalization | next-intl | ^3.26.3 | 3 locales, cookie/header detection |
| UI Components | Radix UI | various | Dialog, Select, Tabs, Switch, Toast, etc. |
| Icons | Lucide React | ^0.468.0 | — |
| Push Notifications | Firebase | ^11.1.0 | Installed but not initialized |
| PWA | Custom Service Worker | — | `public/sw.js`, `next-pwa` installed but unused |
| Fonts | Google Fonts | — | Playfair Display, DM Sans, Vazirmatn (RTL) |
| Testing | Vitest + Testing Library | ^2.1.8 | Unit tests for utils and cart store |
| Build | Next.js + SWC/Turbopack | — | `--turbopack` for dev, standalone for prod |
| Container | Docker (multi-stage) | — | Builder + Alpine runner |
| Reverse Proxy | Nginx | alpine | Rate limiting, caching, WS proxy |
| CI/CD | Not configured | — | No CI pipeline found |

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
```

### Setup Environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

For local development without a backend, leave `NEXT_PUBLIC_USE_MOCK=true`.

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

> **Warning:** `NEXT_PUBLIC_USE_MOCK=true` ships simulated data to real users. Always set `NEXT_PUBLIC_USE_MOCK=false` in production.

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

**Demo credentials** (mock mode):  
Email: any email / Password: any password → logs in as `John Doe`

**Demo discount codes** (mock mode):  
- `SAVE10` — 10% off  
- `WEEKEND20` — 20% off  
- `FIRST5` — $5 off

---

## Docker

### Development

```bash
# Assumes docker-compose.dev.yml exists
docker compose -f docker-compose.dev.yml up
```

### Production

```bash
# Requires external Docker network 'shared-net' and volume 'backend_static_volume'
docker network create shared-net
docker volume create backend_static_volume

docker compose up -d
```

The production stack includes:
- `savor-app` — Next.js standalone server on port 3000 (internal)
- `savor-nginx` — Nginx reverse proxy on ports 80/443 (external)

Nginx proxies:
- `/api/` and `/ws/` → Django backend (`smartrestaurant-web:8000`)
- `/_next/static/` → Next.js with 1-year cache
- `/sw.js` → Next.js with no-cache headers
- `/` → Next.js with rate limiting (30 req/s)

---

## Build & Deployment

```bash
# Production build
npm run build

# Start production server
npm start
```

The build uses `output: "standalone"` — the `.next/standalone` directory is self-contained and can be deployed without `node_modules`.

### Docker Build

```dockerfile
# Multi-stage: builder (Node 22 Alpine) → runner (Node 22 Alpine)
# Final image runs as non-root user 'nextjs'
docker build -t savor-frontend .
```

### Deployment Checklist

**Required before any production deployment (existing restaurant tenant):**

- [ ] Set `NEXT_PUBLIC_USE_MOCK=false`
- [ ] Set correct `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_BASE_URL`
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Add PWA icon files to `public/icons/` (72px through 512px)
- [ ] Add `public/og-image.jpg` (1200×630)
- [ ] Create external Docker network `shared-net`
- [ ] Create external Docker volume `backend_static_volume`
- [ ] Configure SSL termination (Nginx or upstream load balancer)
- [ ] Implement authentication middleware (`src/middleware.ts`)
- [ ] Fill in Arabic translations (`src/i18n/locales/ar.json`)
- [ ] Wire WebSocket hooks to the UI (order tracking and notifications)
- [ ] Integrate a real payment gateway
- [ ] Stand up CI quality gates (lint, type-check, test, build)
- [ ] Initialize Sentry error tracking

**Required before onboarding a second tenant or business type:**

- [ ] Tenant, Location, and Module models exist and are wired through the API and frontend (Phase 1A)
- [ ] RBAC foundation, feature flag system, and tenant-aware routing are in place (Phase 1B)
- [ ] A shared, tokenized, theme-aware component library and permission-aware navigation shell exist (Phase 2)

---

## Internationalization

The application uses **next-intl** with locale detection via cookie (`NEXT_LOCALE`) and `Accept-Language` header fallback.

### Supported Locales

| Code | Language | Direction | Translation Status |
|------|----------|-----------|-------------------|
| `en` | English | LTR | Complete (187 keys) |
| `fa` | Persian (Farsi) | RTL | Complete (187 keys) |
| `ar` | Arabic | RTL | Incomplete (14/187 keys) |

### Translation Structure

```
src/i18n/
├── request.ts          # Locale detection logic
└── locales/
    ├── en.json         # English (reference)
    ├── fa.json         # Persian
    └── ar.json         # Arabic (INCOMPLETE)
```

Translation namespaces: `common`, `nav`, `auth`, `menu`, `cart`, `checkout`, `orders`, `reservation`, `dashboard`, `notifications`, `restaurant`, `errors`, `seo`

RTL font: **Vazirmatn** loaded from Google Fonts for `fa` and `ar` locales. `dir="rtl"` is applied to `<html>` and CSS logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) are used throughout.

---

## PWA

The application ships as a Progressive Web App:

- **Manifest:** `public/manifest.json` — display: standalone, theme: orange (#f97316)
- **Service Worker:** `public/sw.js` — cache-first for static assets, network-first with fallback for API
- **Push Notifications:** Supported via Web Push API (handler in `sw.js`)
- **Shortcuts:** Order Food, My Orders, Reserve Table

> **Note:** `next-pwa` is listed as a dependency but is not configured in `next.config.ts`. The service worker is hand-written. PWA icon files (`public/icons/*.png`) are referenced in `manifest.json` but **do not exist in the repository** and must be added before deployment.

---

## State Management

The application uses **Zustand** for global client state. All stores are in `src/stores/index.ts`.

| Store | Persisted | Responsibility |
|-------|-----------|----------------|
| `useAuthStore` | No | `user`, `isAuthenticated`, `isLoading` |
| `useCartStore` | Yes (localStorage) | Cart items, extras, discount, totals computation |
| `useThemeStore` | Yes (localStorage) | `light` / `dark` / `system` theme preference |
| `useLangStore` | Yes (localStorage) | Active locale, triggers `dir` and `lang` on `<html>` |
| `useBranchStore` | Yes (localStorage) | Active branch selection |
| `useNotificationStore` | No | Notification list, unread count, read state |
| `useFavoritesStore` | Yes (localStorage, custom serializer for `Set`) | Set of favorited item IDs |
| `useRecentlyViewedStore` | Yes (localStorage) | Last 10 viewed menu items |

**Server state** is managed by **TanStack React Query**. Hooks are in `src/hooks/index.ts`. Default `staleTime` is 5 minutes; `gcTime` is 30 minutes.

---

## API Architecture

### Services

| Service | File | Coverage |
|---------|------|----------|
| `authService` | `services/auth.service.ts` | login, register, logout, getMe, forgotPassword, resetPassword, sendOTP, verifyOTP, changePassword |
| `menuService` | `services/menu.service.ts` | getCategories, getItems (filtered/sorted/paginated), getItem, getFeatured, getPopular, getRelated, search |
| `orderService` | `services/order.service.ts` | createOrder, getOrders, getOrder, cancelOrder, validateDiscountCode |
| `reservationService` | `services/combined.service.ts` | create, getReservations, cancelReservation, getAvailableSlots |
| `branchService` | `services/combined.service.ts` | getBranches, getBranch |
| `notificationService` | `services/combined.service.ts` | getNotifications, markRead, markAllRead, registerDevice |
| `userService` | `services/combined.service.ts` | updateProfile, getAddresses, createAddress, deleteAddress, getFavorites, toggleFavorite |

### API Patterns

- **Base URL:** `NEXT_PUBLIC_API_BASE_URL` (e.g., `http://localhost:8000/api`)
- **Authentication:** JWT Bearer token in `Authorization` header, stored in `localStorage`
- **CSRF:** Django CSRF token read from `csrftoken` cookie, sent as `X-CSRFToken` header on mutating requests
- **Token Refresh:** Automatic 401 handling with refresh queue — prevents duplicate refresh calls during concurrent requests
- **Mock Mode:** Every service method checks `process.env.NEXT_PUBLIC_USE_MOCK` and returns simulated data with artificial delay when `true`

### WebSocket

The `DjangoChannelsWebSocket` class (`services/websocket.service.ts`) provides:
- Typed event pub/sub (`on`, `off`, `emit`)
- Exponential backoff reconnection (5 attempts, max)
- JWT token passed as query param on connect

Two singleton instances: `orderWebSocket` and `notificationWebSocket`.

> Both WebSocket hooks (`useOrderWebSocket`, `useNotificationWebSocket`) exist in `src/hooks/client.ts` but are **not currently mounted** anywhere in the application. The `OrderTracker` component uses `simulateOrderUpdates()` (mock animation) instead of the real WebSocket hook.

---

## Security Notes

| Area | Status | Notes |
|------|--------|-------|
| JWT Storage | Concern | Tokens stored in `localStorage` (XSS risk); consider `httpOnly` cookies |
| Route Guards | Missing | No `middleware.ts` — `/dashboard` and `/admin` are publicly accessible |
| Admin Authorization | Missing | Admin pages have no role check; any user can access `/admin/*` |
| CSRF Protection | Implemented | Django CSRF cookie forwarded on mutating requests |
| Security Headers | Implemented | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy` in both `next.config.ts` and Nginx |
| Rate Limiting | Implemented | Nginx: 10 req/s on `/api/`, 30 req/s on general routes |
| HTTPS | Not configured | Nginx config has port 443 placeholder but no SSL certificates configured |
| Input Validation | Implemented | Zod schemas on all user-facing forms |

---

## Related Documentation

- [Architecture & Design Decisions](./ARCHITECTURE.md)
- [Technical Debt Audit](./TECHNICAL_DEBT.md)
- [Product Roadmap](./ROADMAP.md)

---

## License

Proprietary — All rights reserved. License terms to be determined.
