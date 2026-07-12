# Frontend Technical Analysis: Discover Page, Tenant Fetch, and Auth `/me`

This document describes the **current implementation only**, as found in the codebase on 2026-07-12. No code was changed to produce this document.

---

## 1. Discover Flow

### Files Involved
- `src/app/discover/page.tsx` — server component, route entry, builds SEO metadata, renders client page.
- `src/app/discover/DiscoverClientPage.tsx` — `'use client'`, main page logic.
- `src/hooks/index.ts` — contains `usePublicTenants()`.
- `src/services/tenant.service.ts` — contains `tenantService.getTenants()`.
- `src/services/endpoints.ts` — defines `ENDPOINTS.TENANTS.LIST`.
- `src/services/axios.instance.ts` — shared axios instance / base URL.
- `src/types/index.ts` — `Tenant` interface.
- `src/types/marketplace.ts` — `MarketplaceMeta` type and helper functions (`matchesSearch`, `matchesCategory`, `matchesFilters`, `sortItems`, `getMarketplaceMeta`).

### Components Involved
- `DiscoverClientPage` (main container)
- `Header`, `Footer`
- `BusinessSearch`, `CategoryFilter`, `AdvancedFilters`, `SortBar`
- Internally defined `Section` / `BusinessGrid`
- `BusinessCard` (renders each tenant)

### Hooks Involved
- `usePublicTenants()` (`src/hooks/index.ts:1925-1935`)

### Services Involved
- `tenantService.getTenants()` (`src/services/tenant.service.ts:213-224`)

### API Endpoint Called
- `GET /tenants/` (`ENDPOINTS.TENANTS.LIST`, `src/services/endpoints.ts:97`)

### Complete Request Flow
1. `src/app/discover/page.tsx` renders `DiscoverClientPage`.
2. `DiscoverClientPage` calls `usePublicTenants()` (line 185):
   ```tsx
   const { data: tenants = [], isLoading, isError } = usePublicTenants()
   ```
3. `usePublicTenants()` is a React Query `useQuery` with key `['public-tenants']` and no `enabled` guard, so it fires on mount:
   ```tsx
   export function usePublicTenants() {
     return useQuery({
       queryKey: ['public-tenants'],
       queryFn: () => tenantService.getTenants(),
       staleTime: STALE_TIME,
       select: (tenants) =>
         tenants.filter(
           (t) => t.slug !== 'default' && (t.status === 'active' || t.status === 'trial'),
         ),
     })
   }
   ```
4. `queryFn` calls `tenantService.getTenants()`, which performs `api.get<Tenant[]>(ENDPOINTS.TENANTS.LIST)` (or returns mock data if `USE_MOCK` is set), and returns `[]` on error.
5. React Query's `select` filters out tenant `slug === 'default'` and any tenant whose `status` is not `'active'` or `'trial'`.
6. `DiscoverClientPage` passes the resulting tenants through client-side search/category/filter/sort helpers in `src/types/marketplace.ts`.
7. Each resulting `{ tenant, meta }` pair is rendered via `BusinessCard`:
   ```tsx
   {items.map(({ tenant, meta }) => (
     <BusinessCard key={tenant.id} tenant={tenant} meta={meta} />
   ))}
   ```

### Expected Response Structure
`GET /tenants/` returns `Tenant[]`:
```ts
export interface Tenant {
  id: string
  name: string
  slug: string
  businessTypes: string[]
  status: TenantStatus
  createdAt: string
  settings?: Record<string, unknown>
  ownerId?: string
}
```
`settings.marketplace` is expected to conform to `MarketplaceMeta` (`src/types/marketplace.ts:30-84`): `description`, `coverImage`, `cuisines`, `tags`, `rating`, `reviewCount`, `city`, `branchCount`, `openNow`, `primaryBranchSlug`, `featured`/`popular`/`isNew`, `branches`, `tagline`, `priceLevel`, `phone_number`, `email`, `website`, `gallery`, `story`, `amenities`, `socialLinks`, `heroImage`.

### Every Tenant Field Used and Where

| Field | Used In |
|---|---|
| `tenant.id` | `DiscoverClientPage.tsx:74,172` (React key) |
| `tenant.name` | `DiscoverClientPage.tsx` (search matching via `marketplace.ts:167,175`); `BusinessCard.tsx:71,110,114,194,203,215` |
| `tenant.slug` | `BusinessCard.tsx:55,56,224`; branch matching in `marketplace.ts` |
| `tenant.businessTypes` | `DiscoverClientPage.tsx:243,251,281,286,317`; `BusinessCard.tsx:46,60`; `marketplace.ts:169,182,193` |
| `tenant.status` | filter condition in `hooks/index.ts:1932` |
| `tenant.settings` | `DiscoverClientPage.tsx:37,292`; `BusinessCard.tsx:47,48` |
| `tenant.settings.marketplace` (via `getMarketplaceMeta`) | `marketplace.ts:152-154`; consumed throughout `DiscoverClientPage.tsx` and `BusinessCard.tsx` |
| `tenant.settings.featureFlags` | `DiscoverClientPage.tsx:292`; `BusinessCard.tsx:48` |
| `tenant.settings.theme.primaryColor` | `BusinessCard.tsx:47` |
| `tenant.createdAt` | not referenced on the Discover page |
| `tenant.ownerId` | not referenced on the Discover page |

Nested `meta` (`MarketplaceMeta`, derived from `tenant.settings.marketplace`) fields consumed in `BusinessCard.tsx`: `coverImage` (75-84), `openNow` (93,96), `priceLevel` (115), `description` (122), `rating`/`reviewCount` (126-129), `city` (133), `branchCount` (54,135,137), `cuisines` (142-153), `amenities` (157,177), `branches`/`primaryBranchSlug` (55,57,224), `featured`/`popular`/`isNew` (19-25, `StatusBadge`).

---

## 2. `/api/tenants/{id}` Analysis

Note: the actual route uses a **slug** identifier (`/tenants/{tenantSlug}/`), not a numeric id — the identifier passed into this endpoint in the codebase is always a tenant `slug` string.

### File That Initiates the Request
- `src/services/tenant.service.ts` — `tenantService.getTenant(slug)` (~lines 174-186).

### Hook/Service Responsible
- Hook: `usePublicTenant(slug)` (`src/hooks/index.ts:1938-1950`).
- Service: `tenantService.getTenant(slug)`, calling `api.get<Tenant>(ENDPOINTS.TENANTS.DETAIL(resolvedSlug))`.
- Endpoint definition: `ENDPOINTS.TENANTS.DETAIL = (slug) => \`/tenants/${slug}/\`` (`src/services/endpoints.ts:95`).

```tsx
export function usePublicTenant(slug: string) {
  return useQuery({
    queryKey: ['public-tenant', slug],
    queryFn: async () => {
      const tenant = await tenantService.getTenant(slug)
      if (tenant.slug === 'default' && slug !== 'default') return null
      return tenant
    },
    staleTime: STALE_TIME,
    enabled: !!slug,
  })
}
```

### What Triggers the Request
- React Query fires it automatically when the component mounts and `enabled: !!slug` is true (no manual `useEffect`).

### Where the Tenant ID Comes From
- **URL**: Next.js dynamic route params. Specifically:
  - `src/app/[tenantSlug]/page.tsx` — server component extracts `tenantSlug` from `params` (line ~13/53) and passes it to `TenantHomepageClient` as a prop (line 72).
  - `src/app/[tenantSlug]/TenantHomepageClient.tsx:802-803` — calls `usePublicTenant(tenantSlug)` with the prop.
  - Same pattern in `src/app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx:642`.
  - Also used directly (server-side, same route param) in `generateMetadata` of `page.tsx` (lines 13-14, 53-54).
- Not sourced from Auth, a global store, localStorage, or Context — purely from the URL path segment.
- **React Query cache key**: `['public-tenant', slug]`.

### When the Request Executes
- On mount of `TenantHomepageClient` / `BranchHomepageClient` whenever a non-empty `tenantSlug` route param is present.

### Expected Response Structure
Single `Tenant` object (same shape as Section 1).

### Every Response Field Consumed and Where

| Field | Used In |
|---|---|
| `tenant.slug` (compared to `'default'`) | `hooks/index.ts:1944` |
| `tenant.settings` (via `getMarketplaceMeta`) | `TenantHomepageClient.tsx:815` |
| `tenant.businessTypes` | `TenantHomepageClient.tsx:823`, header sub-component `:72` |
| `tenant.slug` | `TenantHomepageClient.tsx:75,211,212` |
| `tenant.name` | `TenantHomepageClient.tsx:134,144,217,870,885` |
| `tenant.id` | `TenantHomepageClient.tsx:832` (passed as `tenantId`) |
| `tenant.settings.theme.primaryColor` | `TenantHomepageClient.tsx:70` |

If the query returns `null` (slug resolves to `'default'`) or is still loading, `TenantHomepageClient` renders `LoadingSkeleton` / `TenantNotFoundState` (lines 812-816) instead of dereferencing tenant fields.

---

## 3. `/api/auth/me` Contract

### File That Calls It
- `src/services/auth.service.ts` — `authService.getMe()` (lines 194-212), calling `api.get(ENDPOINTS.AUTH.ME)` where `ENDPOINTS.AUTH.ME = '/auth/me/'` (`src/services/endpoints.ts:8`).

### When It Is Called
1. **App bootstrap**: `AuthBootstrapper` component (`src/providers/index.tsx:196-284`), mounted near the app root inside `Providers` (~line 295-306). Runs once per app load via a mount-time `useEffect` guarded by a `booted` ref (lines 239-283):
   - First checks for an access token (`getAccessToken()`); if absent, sets loading false and stops.
   - If a token exists, calls `authService.getMe()`:
     ```tsx
     authService.getMe().then((user) => {
       setUser(user)
       setSentryUser({ id: user.id, email: user.email, role: user.role })
       if (user.tenantRoles && user.tenantRoles.length > 0) {
         const tenantId = useTenantStore.getState().tenant.id
         useRbacStore.getState().setTenantRoles(tenantId, user.tenantRoles)
       }
       userService.getFavorites().then(setFavorites).catch(() => {})
     }).catch((err) => {
       const status = (err as any)?.response?.status
       if (status === 401) clearSession()
       setLoading(false)
     })
     ```
   - On HTTP 401, `clearSession()` tears down user/tokens/RBAC/tenant/cart/dine-in/favorites/recently-viewed and the React Query cache. Non-401 errors do not log the user out.
2. **On-demand hook**: `useMe()` (`src/hooks/index.ts:600-609`) — a React Query hook (`queryKey: ['me']`, `retry: false`) usable anywhere it's mounted, independent of the bootstrap flow.

### Complete Expected Response Shape
`User & AuthSessionRbacPayload & { tenantRoles?: Role[] }`

```ts
// User — src/types/index.ts:8-18
export interface User {
  id: string
  email: string
  phone_number?: string
  first_name: string
  last_name: string
  avatar?: string
  role: UserRole
  is_verified: boolean
  created_at: string
}

// AuthSessionRbacPayload — src/types/ownership.ts:102-105
export interface AuthSessionRbacPayload {
  ownership?: Owner[]
  staffAssignments?: StaffAssignment[]
}

// plus, inline on the getMe() return type:
tenantRoles?: Role[]
```

### Every Response Field Consumed and Where

| Field | Consumers |
|---|---|
| `user.id` | `providers/index.tsx:246`; `console/permissions/page.tsx:97,103,104`; `console/users/[id]/page.tsx:201` |
| `user.email` | `providers/index.tsx:246`; `console/permissions/[userId]/page.tsx:161`; `console/users/page.tsx:59,174`; `console/users/[id]/page.tsx:200` |
| `user.role` | `providers/index.tsx:246`; `AppShell.tsx:87`; `console/users/[id]/page.tsx:201`; `login/LoginClientPage.tsx:141` |
| `user.first_name` / `user.last_name` | `AdminHeader.tsx:170-176`; `AppShell.tsx:77-84`; `console/permissions/[userId]/page.tsx:157,160`; `console/users/[id]/page.tsx:152,193-198`; `console/users/page.tsx:58,167-172` |
| `user.avatar` | `AdminHeader.tsx:169`; `AppShell.tsx:76` |
| `user.phone_number` | `console/users/[id]/page.tsx:207` (with `?? '—'` fallback) |
| `user.is_verified` | `console/users/[id]/page.tsx:219,421-422` |
| `user.created_at` | `console/users/[id]/page.tsx:396` |
| `user.tenantRoles` | `providers/index.tsx:253,255` (RBAC hydration) |
| `user.ownership` / `user.staffAssignments` | Not consumed anywhere; present on the type only |

### Which Fields Are Required
Fields accessed without optional chaining or fallback (matching their non-optional typing on `User`): `id`, `email`, `role`, `first_name`, `last_name`, `is_verified`, `created_at`.

Fields treated as optional (guarded with `?.` / `??` / conditional checks, matching their optional typing): `avatar`, `phone_number`, `tenantRoles`, `ownership`, `staffAssignments`.

### What Breaks if a Required Field Is Missing
- Missing `id`: Sentry user context (`setSentryUser`) receives `undefined`; any UI keying or querying by user id (e.g. `console/users/[id]/page.tsx`, `console/permissions/page.tsx`) would render/match incorrectly.
- Missing `email`: Sentry context incomplete; user list/detail views showing email (`console/users/page.tsx`, `console/permissions/[userId]/page.tsx`) would display `undefined`.
- Missing `role`: role-based UI branching (`AppShell.tsx:87`, `console/users/[id]/page.tsx:201`, login redirect logic in `LoginClientPage.tsx:141`) would evaluate against `undefined`, potentially failing role checks or misrouting.
- Missing `first_name`/`last_name`: name displays in `AdminHeader.tsx`, `AppShell.tsx`, and console user pages would render `undefined`/blank text since these are accessed directly without fallback.
- Missing `is_verified`/`created_at`: verification-status and created-date displays in `console/users/[id]/page.tsx` would render `undefined`/`Invalid Date`-type output since no fallback is coded for these.

---

## Required Response Fields (Summary)

| Endpoint | Required Fields | Optional Fields |
|---|---|---|
| `GET /tenants/` (Discover list) | `id`, `name`, `slug`, `businessTypes`, `status` | `settings`, `createdAt`, `ownerId` |
| `GET /tenants/{slug}/` (single tenant) | `id`, `name`, `slug`, `businessTypes` | `settings` |
| `GET /auth/me/` | `id`, `email`, `role`, `first_name`, `last_name`, `is_verified`, `created_at` | `avatar`, `phone_number`, `tenantRoles`, `ownership`, `staffAssignments` |

---

## File References

| Area | File | Purpose |
|---|---|---|
| Discover | `src/app/discover/page.tsx` | Route entry, metadata |
| Discover | `src/app/discover/DiscoverClientPage.tsx` | Main client page logic |
| Discover | `src/hooks/index.ts:1925-1935` | `usePublicTenants()` |
| Discover | `src/services/tenant.service.ts:213-224` | `getTenants()` |
| Discover | `src/services/endpoints.ts:97` | `TENANTS.LIST` |
| Discover | `src/types/index.ts:316-348` | `Tenant` interface |
| Discover | `src/types/marketplace.ts` | `MarketplaceMeta`, filter/sort helpers |
| Single Tenant | `src/hooks/index.ts:1938-1950` | `usePublicTenant(slug)` |
| Single Tenant | `src/services/tenant.service.ts:174-186` | `getTenant(slug)` |
| Single Tenant | `src/services/endpoints.ts:95` | `TENANTS.DETAIL(slug)` |
| Single Tenant | `src/app/[tenantSlug]/page.tsx` | Route param extraction |
| Single Tenant | `src/app/[tenantSlug]/TenantHomepageClient.tsx` | Consumer of `usePublicTenant` |
| Single Tenant | `src/app/[tenantSlug]/[branchSlug]/BranchHomepageClient.tsx:642` | Also consumes `usePublicTenant` |
| Auth Me | `src/services/auth.service.ts:194-212` | `getMe()` |
| Auth Me | `src/services/endpoints.ts:8` | `AUTH.ME` |
| Auth Me | `src/providers/index.tsx:196-284` | `AuthBootstrapper` |
| Auth Me | `src/hooks/index.ts:600-609` | `useMe()` |
| Auth Me | `src/types/index.ts:8-18` | `User` interface |
| Auth Me | `src/types/ownership.ts:102-105` | `AuthSessionRbacPayload` |
