# 08 — Error Handling Reference

## Global HTTP error handling (`src/services/axios.instance.ts`)

- **401 Unauthorized**: response interceptor attempts one silent token refresh (`POST /auth/token/refresh/` with `{refresh}`, using a raw `axios` call to avoid interceptor recursion). Concurrent 401s during an in-flight refresh are queued (`failedQueue`) and replayed with the new token once refresh completes. On refresh failure: `clearTokens()` + `window.dispatchEvent(new CustomEvent('auth:logout'))` (global session-teardown signal, consumed elsewhere — likely `AuthBootstrapper`).
- **All other statuses**: no global interceptor handling — errors propagate as raw `AxiosError` to the calling service/hook.
- **React Query global handler** (`src/providers/index.tsx`, browser `QueryCache.onError`): routes query errors to `react-hot-toast`, **except**: `CancelledError`, HTTP 401 (already handled above), and HTTP status `0` (network failure / request cancelled) — these are silently ignored, not toasted.
- **Retry policy**: browser QueryClient retries queries up to 2 times, **except** never retries on 401. Server QueryClient (`src/lib/react-query/queryClient.ts`) never retries (`retry: false`).

## Service-level custom error handling (deviations from "let it propagate")

| Service | Behavior |
|---|---|
| `tenant.service.ts` | **Reads** (`getTenant`, `getCurrentTenant`, `getTenants`) wrap the real call in try/catch and silently degrade to `DEFAULT_TENANT` / `[]` on **any** error (network failure, 404, 500, and auth failure all look identical to callers). **Mutations** (`activateTenant`, `suspendTenant`, `archiveTenant`, `transferOwnership`, `updateTenantSettings`) do not swallow — they throw. |
| `tenant-provisioning.service.ts` | `provisionTenant`/`cloneTenant` wrap the real axios call in try/catch and convert any thrown error into a typed `{success:false, errors:[message]}` result rather than rejecting the promise — the only file in the audited set that does this. Both also perform client-side pre-validation (slug/name checks, `validateTenantConfiguration`) that short-circuits with `{success:false, errors}` **before** any network call. |
| `auth.service.ts` | Throws plain `Error` with flag-derived messages (`authentication_disabled`, `email_login_disabled`, `registration_disabled`, `otp_disabled`, `phone_login_disabled`) **before** any HTTP call, when the relevant `configurationService` feature flag is off. These are client-side config gates, not server error responses. |
| `combined.service.ts` `userService.uploadAvatar` | Client-side validation before any call: rejects file types outside `image/jpeg, image/png, image/webp, image/gif` and files `>5MB`, throwing descriptive `Error`s. After a successful POST, throws `Error('Server did not return an avatar URL.')` if the response lacks `avatar_url` — the only service that validates its own success response shape. |
| `audit-log.service.ts` `record()` | Fire-and-forget wrapper that explicitly swallows all errors (`.catch(() => {})`) — "audit failures must never disrupt the primary operation" (per code comment). |
| `notification.service.ts` `notify()` | Same fire-and-forget swallow pattern as `record()`. |
| `realtime-operations.service.ts` `emit()` | Same fire-and-forget swallow pattern. |
| `staff-assignment.service.ts` `revoke()`, `staff.service.ts` `transferOwnership()` | **Not error handling, but a real-mode correctness bug**: both derive a required URL path parameter (`staffId`, `tenantId`) from the **mock** in-memory fixture array even when `USE_MOCK=false`. In real mode with an unpopulated mock store, this resolves to `undefined`, producing a URL containing the literal string `"undefined"` — will manifest as a 404 rather than a clean client-side error. |
| `branch-analytics.service.ts` | Every method explicitly `throw new Error('Network mode not available — set NEXT_PUBLIC_USE_MOCK=true')` when `USE_MOCK` is false — a deliberate hard block rather than attempting (and failing) a real call. |
| `owner.service.ts` `getOwnerByUserIdSync`, `staff.service.ts` `getMembership`/`findStaffMemberByEmail`, `staff-assignment.service.ts` `getEffectiveAssignments` | Return `undefined` (not an error, not a rejected promise) when `USE_MOCK=false` — silent-failure pattern. Per `src/hooks/index.ts` comments, this is the root cause of a documented real-backend login-lockout risk in `useHasDashboardAccess()`. |

## RBAC/authorization error handling

`permission.service.ts`'s `checkPermission()` is an **audit-emitting wrapper** — every permission check (granted or denied) emits an `AuditEvent {permission, granted, roles, tenantId?, userId?, timestamp}` via an in-memory pub/sub (`auditHooks`), consumed by the RBAC audit trail. This happens entirely client-side; there is no server round-trip for permission checks, so a "permission denied" is never a backend error response in this app — it's a local computation result.

`ownership-resolution.service.ts` exports `TenantAccessError` and `assertOwnershipTenantAccess()`/`assertOwnershipBranchAccess()` — these throw synchronously (or after awaiting `branchManagementService`/`tenantService` calls) when a staff member's resolved tenant/branch scope doesn't include the requested resource. Used as a guard wrapped around several `useAdmin*`/`useBranch*` React Query hooks in `src/hooks/index.ts` (e.g. `useAdminBranches`, `useAdminOrders`, `useStaff`) — surfaces as a query error, not a network error.

`branch-access.service.ts` exports `BranchAccessError`, thrown by `assertBranchAccess()` — same pattern, purely local branch-scope enforcement.

## Optimistic mutation rollback pattern (React Query)

Many admin mutations in `src/hooks/index.ts` follow a consistent optimistic-update/rollback shape:
```
onMutate: cancel in-flight queries for the affected key(s) → snapshot current cache via getQueryData/getQueriesData → apply the optimistic patch via setQueryData/setQueriesData
onError: restore the snapshot(s) exactly
onSuccess: invalidateQueries for the affected key(s) (+ often auditLogService.record(...))
```
Applies to: branch status transitions (`useUpdateBranch`, `useActivateBranch`, `useDeactivateBranch`, `useMaintenanceBranch`, `useAssignBranchManager`), admin order/reservation status changes (`useUpdateOrderStatus`, `useConfirmReservation`, `useCancelReservation`), menu item CRUD (`useUpdateMenuItem`, `useDeleteMenuItem`), staff status changes (`useSuspendStaff`, `useActivateStaff`, `useRemoveStaff`), and the favorites toggle (`useToggleFavorite`, store-only rollback via re-toggling).

## What is NOT handled anywhere in the frontend

- No frontend service throws or exposes a typed `ApiError` object consistently — `ApiError {message, code?, errors?}` is defined in `src/types/index.ts` but not actively constructed/thrown by any audited service; real axios error `.response.data` shape from the backend is effectively unvalidated/unparsed by the frontend beyond the global toast handler.
- No client-side retry/backoff for mutations (only queries get the global 2-retry policy).
- No dedicated 403 (Forbidden) handling distinct from 401 — a 403 would simply toast via the generic `QueryCache.onError` handler like any other non-401 error.
