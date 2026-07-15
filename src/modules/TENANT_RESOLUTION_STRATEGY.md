# Tenant Resolution Strategy Decision — Phase 1A (P1A.1)

**Status:** Decided  
**Date:** 2026-06-20  
**Roadmap ref:** P1A.1 (model + decision); P1B.3 (implementation)

---

## Decision

**Production:** Subdomain-based resolution — `{tenant-slug}.samoon.app`

**Development / mock mode:** Path-based fallback — resolved from the
`NEXT_PUBLIC_TENANT_SLUG` environment variable, or the `?tenant=<slug>`
query parameter for local multi-tenant testing without DNS overhead.

---

## Rationale

### Subdomain (production)

- Clean URL isolation per tenant — no tenant slug pollutes the path.
- Enables SSL termination per tenant (wildcard cert `*.samoon.app`).
- Allows Nginx / CDN routing to route traffic at the edge without
  touching application code.
- Prevents accidental cross-tenant navigation (a user on `acme.samoon.app`
  cannot drift to `rival.samoon.app` by editing the path).
- Matches the pattern used by every major SaaS product (Shopify, Notion,
  Linear, Vercel) — familiar to future tenants.

### Path-based dev fallback

- Avoids the need to configure local DNS entries or wildcard localhost
  certificates during development.
- `NEXT_PUBLIC_TENANT_SLUG=samoon npm run dev` is sufficient to test a
  specific tenant's experience.
- `?tenant=<slug>` enables switching tenants in a single browser session
  without restarting the dev server.

### Rejected alternatives

| Alternative | Reason rejected |
|-------------|-----------------|
| Path-based in production (`/t/{slug}/...`) | Pollutes all URLs; breaks existing routes (`/menu`, `/checkout`) without redirects or rewrites; worse SEO signal per-tenant |
| Header-based only | Cannot be expressed in a bookmark or shared link; requires all clients to set the header explicitly |

---

## Implementation notes (for Phase 1B — P1B.3)

- `src/middleware.ts` reads the subdomain from `request.headers.get('host')`.
- The resolved slug is injected into the request as a custom header
  `X-Tenant-Slug` so that Server Components and API Route Handlers can
  read it without parsing the host again.
- `useTenantStore.loadTenant(slug)` is called once in the root layout
  (client-side) or via a server action (server-side) with the slug
  extracted from the `X-Tenant-Slug` header.
- Existing routes (`/menu`, `/checkout`, `/dashboard`, etc.) continue to
  resolve identically for the `default` tenant — no URL changes for the
  current single-tenant deployment.
- The `DEFAULT_TENANT` fallback in `src/constants/index.ts` is the safety
  net: if middleware cannot resolve a slug, the app behaves as a
  single-tenant restaurant application, unchanged from before Phase 1A.

---

## Dependency

This decision is a prerequisite for P1B.3. No routing code is written here —
only the model (`Tenant` type, `useTenantStore`, `tenantService`) and this
decision document. P1B.3 owns the `src/middleware.ts` implementation.
