# Console Architecture: Decouple Rendering from Tenant Resolution

**Status: complete.** Tenant availability is now a data dependency of the
Console workspace, never an authentication dependency of it.

## 1. Root Cause

The prior architecture (Phase Z.10) fixed the zero-membership case but
kept a structural flaw: `ConsoleWorkspaceGate` decided whether to render
the **entire** workspace — chrome included — or a full-page replacement
(onboarding / tenant message / access denied). Every non-`'resolved'`
`tenantState` (`'loading'`, `'not_found'`, `'forbidden'`, `'error'`)
unmounted the whole console, including `AdminHeader`/`AdminSidebar`, and
`'error'` (the bucket for network failures, 5xx, timeouts — already
correctly classified separately from `'not_found'`/`'forbidden'` at the
store level) was rendered with the *exact same* full-page message as a
genuine "tenant doesn't exist," with no retry mechanism. A transient
backend hiccup while fetching tenant data looked identical to a routing
bug or a real access denial.

## 2. Current Broken Flow (before this phase)

```
Authentication
    |
    v
AuthGuard (auth only)
    |
    v
ConsoleWorkspaceGate — decides the WHOLE tree:
    |
    +-- hasTenantMembership null/false -> onboarding (full page)
    +-- tenantState loading            -> null (blank page)
    +-- tenantState not_found/forbidden/error -> full-page message,
    |                                            NO shell, NO retry
    +-- tenantState resolved + permission -> full chrome + children
```

A temporary tenant loading failure, API delay, or auth-bootstrap race
landed in the same `error` branch as a genuine backend outage, rendered
with no header, no sidebar, and no way to recover except a full page
reload (which just repeats the same failure).

## 3. New Flow

```
Authentication success
    |
    v
AuthGuard (auth only) — redirect to /login if unauthenticated
    |
    v
console/layout.tsx renders the SHELL unconditionally:
    AdminHeader, AdminBreadcrumbs, AdminContextBar, AdminSidebar
    |
    v
ConsoleWorkspaceGate — decides ONLY what appears inside <main>:
    |
    +-- membership_loading   -> (waiting, shell still visible)
    +-- onboarding           -> "Create your first business" (inline)
    +-- tenant_loading       -> inline spinner, first attempt
    +-- tenant_retrying      -> inline spinner + "Reconnecting... (attempt N)"
    +-- tenant_network_error -> inline message + Retry button (auto-retry exhausted)
    +-- tenant_not_found     -> inline "Tenant not found" (genuine — TenantNotFoundError)
    +-- tenant_access_denied -> inline "Access unavailable" (genuine — TenantForbiddenError / suspended)
    +-- access_denied        -> AccessDenied (RBAC, unchanged)
    +-- resolved              -> {children} — the actual tenant-scoped page
```

`console/layout.tsx` now mounts `AdminHeader`/`AdminContextBar`/
`AdminSidebar` **between** `<AuthGuard>` and `<ConsoleWorkspaceGate>` —
structurally unconditional on tenant state, confirmed by a source-text
test (`phase-Z-11-console-tenant-decoupling.test.tsx`).

## 4. Files Changed

| File | Change |
|---|---|
| `src/stores/index.ts` | `useTenantStore`: new `lastAttemptedSlug` field, set on every `loadTenant()` call (whichever caller chose the slug — subdomain or the Z.8 membership fallback) so a retry can re-attempt the exact same resolution. Reset by `reset()`. |
| `src/components/admin/ConsoleWorkspaceGate.tsx` | Rewritten. No longer decides the whole tree — only `<main>`'s content. New exported pure `resolveConsoleTenantPhase()` (9-state decision, no timers) and `useTenantAutoRetry()` (timer orchestration: schedules, caps, and clears retries). New states: `tenant_loading` vs. `tenant_retrying` vs. `tenant_network_error` (previously all `'error'` → one blocking message). |
| `src/app/console/layout.tsx` | `AdminHeader`/`AdminBreadcrumbs`/`AdminContextBar`/`AdminSidebar` moved OUTSIDE `ConsoleWorkspaceGate` — the shell mounts unconditionally on auth; only `{children}` (via `<main>`) is wrapped by the gate. |
| `src/i18n/locales/{en,fa,ar}.json` | Added `console.tenantLoading`, `tenantRetrying` (`{attempt}` placeholder), `tenantRetryCta`. |
| `src/test/phase-Z-11-console-tenant-decoupling.test.tsx` (new) | 20 tests — see §5. |
| `docs/CONSOLE_ARCHITECTURE_TENANT_DECOUPLING_AUDIT.md` (new, this file) | Full audit trail. |

`AuthGuard`, `TenantBootstrapper`, `tenant.service.ts`'s error
classification (`TenantNotFoundError`/`TenantForbiddenError`/unclassified
→ `'error'`), `normalizeTenantPermissions()`, and every `enabled: !!tenantId`
React Query gate throughout `hooks/index.ts` are **unchanged** — the
classification was already correct; only the Console-level *presentation*
of a non-`'resolved'` state, and the shell's independence from it, needed
fixing.

## 5. Tests Added (`phase-Z-11-console-tenant-decoupling.test.tsx`, 20 tests)

- **`resolveConsoleTenantPhase()`** — pure coverage of all 10 phase
  outcomes (membership_loading, onboarding, tenant_not_found,
  tenant_access_denied, tenant_loading, tenant_retrying ×2 branches,
  tenant_network_error, access_denied, resolved).
- **Shell preservation** — source-text proof that the shell mounts
  outside `ConsoleWorkspaceGate`, and only `{children}` is inside it; a
  component-level assertion that a tenant API failure renders an inline
  retry state (never `tenantNotFoundTitle`), with tenant-scoped content
  withheld.
- **Retry behavior** — auto-retry fires `tenantService.getTenant()` again
  after `TENANT_RETRY_DELAY_MS` (fake timers); a manual retry click
  re-invokes it immediately; auto-retry stops at `TENANT_MAX_AUTO_RETRIES`
  (no infinite duplicate requests) while manual retry stays available.
- **Successful resolution after failure** — re-render with
  `tenantState: 'resolved'` clears the error UI and renders `children`.
- **Empty tenant state** — zero memberships renders onboarding, never
  `"Tenant not found"`, and never leaks tenant-scoped content.
- **Invalid tenant** — `not_found` and `forbidden` render their own
  distinct messages, neither showing a retry button (they are not
  retryable failures).

## 6. Remaining Places Console *Could* Still Be Blocked by Tenant Resolution

- **`membership_loading`** (`hasTenantMembership === null`) still renders
  `null` inside `<main>` — the shell is visible, but the content area is
  blank until the session resolves. This is a brief, unavoidable window
  (same duration as the auth bootstrap itself) rather than a block — no
  UI change was requested for it beyond "don't show onboarding
  prematurely," which is preserved.
- **Individual `/console/*` pages** (menu, orders, inventory, etc.) are
  only reachable via `{children}` in the `'resolved'` phase — by
  construction they can never mount with an undefined/stale/fake
  `tenant.id`, since `ConsoleWorkspaceGate` withholds `children` for
  every other phase. Their own data-fetching hooks additionally gate on
  `enabled: !!tenantId` (already present throughout `hooks/index.ts`,
  unchanged by this phase) as defense in depth.
- **`TenantBootstrapper`'s initial subdomain-based `loadTenant()` call**
  still runs once, unconditionally, at app boot, independent of
  `/console` — this is correct and intentional (it also serves the
  public storefront) and is not something Console should suppress.
- No other code path merges a transient failure into a blocking,
  non-retryable state — this was the only such path in the app (the sole
  consumer of `requireResolvedTenant`/tenant-gated full-page rendering
  was Console).

## 7. Verification

- `npx tsc --noEmit -p .` — zero new errors (identical to the established
  baseline).
- `npx vitest run` — full suite; only the same pre-existing baseline
  failures (see commit message for the exact count).
- `npm run build` — production build verified clean.
