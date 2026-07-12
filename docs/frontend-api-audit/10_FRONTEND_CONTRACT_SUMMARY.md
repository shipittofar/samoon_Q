# 10 — Frontend Contract Summary (Canonical Deliverable)

This is the top-level inventory of every real backend dependency the frontend has today. It is the canonical input for the next audit phase (comparing against actual backend implementation).

## How "real" was determined

Every service in `src/services/*.service.ts` follows the pattern `if (USE_MOCK) {...} else { await api.* }`. Only the `else` branch is counted as real. A method/file is excluded from this contract if it has **no such branch at all** — either it's pure client-side logic, or it explicitly throws/no-ops outside mock mode.

## A. REST endpoints the backend MUST provide (grouped by confidence)

### A1. High confidence — actively used, standard `ENDPOINTS` registry, no undeployed-backend caveat in code
Auth (10 endpoints), Menu (10), Orders — customer (5), Payments — create-intent only (1), Reservations — customer (4), Branches — both legacy + P7.3 (11 distinct), Notifications — legacy (4), Users (7), Tenants (9), Reviews — item + business (12), Loyalty (8), Vendors (7), Promotions (4), Staff (11), Analytics (7), Website Builder (6), Tables (1).

Full path list: `02_API_ENDPOINT_INVENTORY.md`. Full request/response shapes: `03_REQUEST_RESPONSE_CONTRACTS.md`. Full type definitions: `04_TYPESCRIPT_MODEL_REFERENCE.md`.

### A2. Used, but bypass the `ENDPOINTS` registry (hardcoded literal paths) — still real, just inconsistently sourced in the code
- Rich notifications (`notification.service.ts`): `/notifications/rich/`, `/notifications/{id}/`, `/notifications/{id}/archive/`, `/notifications/statistics/`, `/notifications/unread-count/`, `/notifications/summary/`
- Notification preferences (`notification-preferences.service.ts`): `/notifications/preferences/*`
- Audit log (`audit-log.service.ts`): `/audit-logs/*` (6 endpoints)
- Realtime operations (`realtime-operations.service.ts`): `/operations/*` (10 endpoints)

### A3. ⚠️ Used by frontend code, but explicitly documented in-code as **not yet deployed on any backend** — expect 404/500 until implemented
- `admin.service.ts`: `/admin/stats/`, `/orders/{id}/status/` (PATCH), `/reservations/{id}/confirm/`, `/admin/customers/*` (full CRM surface, ~18 endpoints)
- `owner.service.ts`: `/admin/platform/owners/*` (platform-admin scope)
- `staff-assignment.service.ts`: `/admin/staff/*assignments*`

These are real, intentional frontend code — not mock — but the backend contract for them does not exist yet per the frontend's own code comments (which reference `docs/BACKEND_API_CONTRACT.md §39.2` / `§39.5`). **Recommend backend team treat section A3 as the next implementation priority**, since it represents the largest gap between "frontend expects this" and "backend has this."

### A4. Known correctness bugs in the frontend's real-mode URL construction (not a backend problem, but will produce malformed requests)
- `staff-assignment.service.ts revoke()`: derives `staffId` for the DELETE URL from the **mock** in-memory store even when `USE_MOCK=false`.
- `staff.service.ts transferOwnership()`: derives `tenantId` for the POST URL from the **mock** in-memory store even when `USE_MOCK=false`.

## B. WebSocket channels the backend MUST provide

See `09_WEBSOCKET_USAGE.md` for full detail. Nine named channels (`savor-orders`, `savor-notifications`, `admin.operations`, `branch.operations`, `orders.broadcast`, `reservations.broadcast`, `staff.broadcast`, `notifications.broadcast`, `audit.broadcast`), JWT-in-query-param auth, `ping`/`pong` heartbeat protocol. **Exact server-side WS URL paths were not found hardcoded in the frontend** beyond the base (`ws://.../ws{path}`) — the backend/frontend need to agree on the `path` argument passed to `.connect()` at each call site (not fully traceable from the service layer alone; recommend a targeted grep of `.connect(` call sites in `src/hooks/index.ts` and `src/components/**` for the exact strings during backend implementation).

## C. Explicitly OUT OF SCOPE — MOCK-ONLY, do not implement backend support based on frontend evidence alone

These have **zero network calls under any environment configuration** — implementing a backend for them would not be used by the current frontend without additional wiring:

| Service/Area | Reason |
|---|---|
| `permission.service.ts` | 100% client-side RBAC (role→permission matrix hardcoded), no `api` import at all |
| `rbac-audit.service.ts` | Delegates to a Zustand store, not a backend |
| `ownership.service.ts`, `ownership-resolution.service.ts`, `ownership-migration.service.ts` | Pure client-side derivation/validation logic |
| `branch-access.service.ts`, `order-routing.service.ts` | Pure client-side filtering/routing logic |
| `audit-event-registry.ts`, `notification-event-registry.ts`, `realtime-event-registry.ts` | Static config registries |
| `feature-flags.service.ts` | Pure client-side merge of module defaults + tenant settings (persistence happens via `TENANTS.SETTINGS`, not a dedicated flags endpoint) |
| `qr-experience.service.ts` | Static lookup table, no backend concept |
| `branch-analytics.service.ts` | Explicitly throws outside mock mode — dead on arrival in real mode |
| `tenant-provisioning.service.ts` catalog methods | `getTemplates`, `getTemplate`, `getCapabilityPreset`, `generateBrandingDefaults`, `generateFeatureFlags`, `generateModuleConfiguration`, `generateDefaultConfiguration`, `validateTenantConfiguration` — pure local computation (only `provisionTenant`/`cloneTenant` are real) |
| `console/permissions/*`, `console/roles/*`, `console/settings/configuration/*`, entire `platform-admin/*` tree | Pages with zero backend dependency, confirmed at the page level |
| `owner.service.getOwnerByUserIdSync()`, `staff.service.getMembership()`, `staff.service.findStaffMemberByEmail()`, `staff-assignment.service.getEffectiveAssignments()` | Structurally mock-only — return `undefined`/mock data with no real-mode implementation despite living in an otherwise dual-mode file |

## D. Cross-cutting contract issues for backend team to resolve

1. **Two `Branch` shapes expected from what may be the same resource** — legacy flat snake_case vs. P7.3 nested camelCase (see `07_SHARED_TYPES_REFERENCE.md`). Backend needs one canonical shape; frontend has technical debt requiring reconciliation regardless.
2. **Two/three notification systems** hitting different paths for overlapping concepts (`/notifications/*` vs `/notifications/rich/*` vs `/notifications/preferences/*`).
3. **Pagination envelope inconsistency**: most endpoints expect `{count, next, previous, results}` (DRF standard), but P7.x endpoints (notifications, audit logs) expect `{results, count, page, pageSize, totalPages}`.
4. **Auth model**: bearer JWT in `Authorization` header (access token from `localStorage`) + CSRF token cookie/header for session-based flows layered on top — backend must support **both** JWT and Django session/CSRF simultaneously (evidenced by `withCredentials: true` + CSRF header logic co-existing with bearer-token logic).
5. **No dedicated "permission check" or "RBAC" endpoint exists in the frontend's calls at all** — if the backend is meant to be the source of truth for authorization, the frontend currently does not consult it; this is a design decision the backend/product team needs to make explicitly (either the frontend needs new RBAC-fetching endpoints, or authorization truly is enforced only by role-scoped data endpoints returning 403/filtered results).
6. **WebSocket path strings are not fully documented** in the service layer — needs a supplementary trace of hook/component call sites before backend WS routing can be finalized.

## E. Document index

| File | Contents |
|---|---|
| `01_FRONTEND_ARCHITECTURE.md` | Stack, layering, auth model, cross-cutting inconsistencies |
| `02_API_ENDPOINT_INVENTORY.md` | Every real endpoint, grouped by domain, with ⚠️/literal-path flags |
| `03_REQUEST_RESPONSE_CONTRACTS.md` | Per-endpoint request/response shape summary |
| `04_TYPESCRIPT_MODEL_REFERENCE.md` | Full ~180-type catalog, one entry per interface/type/enum, with endpoint ownership |
| `05_PAGE_TO_API_MAPPING.md` | Every page → hooks → services → endpoints, customer + admin |
| `06_REACT_QUERY_MAPPING.md` | Every useQuery/useMutation, query keys, cache config, invalidation graph, Zustand stores |
| `07_SHARED_TYPES_REFERENCE.md` | Cross-cutting/duplicated types, re-export gaps |
| `08_ERROR_HANDLING_REFERENCE.md` | Global + per-service error handling, known bugs, optimistic-update rollback pattern |
| `09_WEBSOCKET_USAGE.md` | Full WebSocket protocol, channels, auth, reconnect logic |
| `10_FRONTEND_CONTRACT_SUMMARY.md` | This document |
