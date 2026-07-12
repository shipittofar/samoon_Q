# 06 — React Query Mapping (+ Zustand Store Cross-Reference)

Includes the Zustand store inventory (section 4) since query/mutation state is tightly coupled to store sync (login/logout teardown, optimistic updates, etc.).


Scope: real (non-mock) frontend. All `useQuery`/`useMutation`/`useInfiniteQuery`/`useQueryClient` calls in `src/` outside `mock/`/`mocks/` and `USE_MOCK` branches. No `useInfiniteQuery` usage exists anywhere in the codebase.

Files with React Query calls (5 total, excluding `src/test/*` and `src/lib/react-query/hydration.ts` which only *documents* usage in a comment):

1. `/home/user/samoon_Q/src/hooks/index.ts` — the single central hooks file (3049 lines); ~150 hooks/functions, the vast majority of all useQuery/useMutation calls.
2. `/home/user/samoon_Q/src/providers/index.tsx` — `useQueryClient()` used once, inside `AuthBootstrapper`.
3. `/home/user/samoon_Q/src/components/admin/AdminTenantSwitcher.tsx` — `useQueryClient()` (imported, not observed calling invalidate directly — see below).
4. `/home/user/samoon_Q/src/components/admin/AdminBranchSwitcher.tsx` — `useQueryClient()` + 7 `invalidateQueries` calls.
5. `/home/user/samoon_Q/src/app/dashboard/addresses/page.tsx` — `useQueryClient()` + 2 `invalidateQueries` calls (page has inline CRUD, not through `src/hooks`).
6. `/home/user/samoon_Q/src/app/console/tenants/[slug]/page.tsx` — consumes hooks from `src/hooks` (uses `useQueryClient`-based hooks indirectly).

---

## 1) Global QueryClient Config

### Browser client — `/home/user/samoon_Q/src/providers/index.tsx` (lines 22–60)
Created via `makeQueryClient()`, singleton on `window` (`browserQueryClient`), fresh instance per server render.
- `queryCache`: custom `QueryCache` with global `onError` → routes to `react-hot-toast`. Ignores `CancelledError`, HTTP 401, and HTTP status 0 (network/cancelled).
- `defaultOptions.queries.staleTime` = `STALE_TIME` = `1000 * 60 * 5` (5 min) — from `/home/user/samoon_Q/src/constants/index.ts:41`.
- `defaultOptions.queries.gcTime` = `CACHE_TIME` = `1000 * 60 * 30` (30 min) — `src/constants/index.ts:42`.
- `defaultOptions.queries.retry`: custom function — no retry on 401, otherwise retry while `count < 2` (max 2 retries).
- `refetchOnWindowFocus`: not set at global level (library default `true` applies unless overridden per-call).
- Devtools (`ReactQueryDevtools`) mounted only in `NODE_ENV === 'development'`.

### Server client — `/home/user/samoon_Q/src/lib/react-query/queryClient.ts`
`createServerQueryClient()` — fresh per-request, no shared singleton (P4.4.1).
- `staleTime`: `1000 * 60 * 5` (5 min, hardcoded, not the `STALE_TIME` constant).
- `retry`: `false` (server never retries).
- `throwOnError`: `false`.
- No `queryCache`/toast wiring (no toast system on server).

### Hydration — `/home/user/samoon_Q/src/lib/react-query/hydration.ts`
Re-exports `dehydrate`/`HydrationBoundary` and `dehydrateClient()` wrapping `dehydrate(queryClient)`. Intended pattern: Server Component calls `createServerQueryClient()` → `prefetchQuery` → `dehydrateClient()` → `<HydrationBoundary state={...}>`. No global option overrides here.

### `src/lib/react-query/index.ts`
Pure re-export barrel: `createServerQueryClient`, `dehydrateClient`, `HydrationBoundary`, `DehydratedState`. No config of its own.

**Note:** No global `refetchOnWindowFocus: false` override was found anywhere — the app relies on the TanStack Query default (`true`), except where individual hooks explicitly set `refetchOnWindowFocus: false` (only `useHealthCheck`, see below).

---

## 2) Queries (grouped by module/feature)

All queries below live in `/home/user/samoon_Q/src/hooks/index.ts` unless noted. Format: `hookName` — queryKey — queryFn (service) — custom options — consumers (where discoverable; most are broadly used across pages/components via the hook, not individually traced).

### Auth
- `useMe` (L600) — `['me']` — `authService.getMe()` — `staleTime: STALE_TIME`, `retry: false`, `meta.onSuccess: setUser` (custom meta convention, not a real RQ callback — must be wired manually by a consumer or global `onSuccess` handler; not observed used elsewhere).

### Menu (customer-facing)
- `useCategories` (L612) — `['categories', tenantId]` — `menuService.getCategories()` — `staleTime: STALE_TIME, gcTime: CACHE_TIME`
- `useMenuItems(filters?)` (L622) — `['menu-items', tenantId, filters]` — `menuService.getItems(filters)` — `staleTime: STALE_TIME`
- `useMenuItem(id)` (L631) — `['menu-item', id]` — `menuService.getItem(id)` — `staleTime: STALE_TIME`, `enabled: !!id`
- `useFeaturedItems` (L640) — `['featured-items', tenantId]` — `menuService.getFeatured()` — `staleTime: STALE_TIME`
- `useRelatedItems(id)` (L649) — `['related-items', tenantId, id]` — `menuService.getRelated(id)` — `staleTime: STALE_TIME`, `enabled: !!id`
- `useMenuSearch(query)` (L659) — `['menu-search', tenantId, query]` — `menuService.search(query)` — `enabled: query.length >= 2`, `staleTime: 30_000`

### Orders (customer-facing)
- `useOrders` (L670) — `['orders', tenantId]` — `orderService.getOrders()` — `staleTime: 30_000`
- `useOrder(id)` (L679) — `['order', id]` — `orderService.getOrder(id)` — `enabled: !!id`, `staleTime: 10_000`, `refetchInterval: 30_000` (polling)

### Reviews
- `useItemReviews(itemId)` (L705) — `['reviews', itemId]` — `reviewService.getItemReviews(itemId)` — `enabled: Boolean(itemId)`, `staleTime: STALE_TIME`

### Branches (public)
- `useBranches` (L733) — `['branches', tenantId]` — `branchService.getBranches(tenantId)` — `staleTime: CACHE_TIME`
- `useBranch(id)` (L742) — `['branch', id]` — `branchService.getBranch(id)` — `enabled: !!id`, `staleTime: CACHE_TIME`

### Branch Management (admin, P7.3)
- `useAdminBranches(tenantId)` (L757) — `['admin-branches', tenantId]` — `branchManagementService.getBranches(tenantId)` wrapped with `assertOwnershipTenantAccess(email, tenantId)` tenant-isolation check — `staleTime: STALE_TIME`, `enabled: !!tenantId`. Consumer: `/home/user/samoon_Q/src/components/admin/AdminBranchSwitcher.tsx:27`.
- `useAdminBranch(id)` (L770) — `['admin-branch', id]` — `branchManagementService.getBranch(id)` — `enabled: !!id`, `staleTime: STALE_TIME`
- `useAdminBranchMetrics(id)` (L779) — `['admin-branch-metrics', id]` — `branchManagementService.getBranchMetrics(id)` — `enabled: !!id`, `staleTime: 30_000`

### Reservations
- `useReservations` (L923) — `['reservations', tenantId]` — `reservationService.getReservations()` — `staleTime: STALE_TIME`
- `useAvailableSlots(date, branchId)` (L940) — `['available-slots', date, branchId]` — `reservationService.getAvailableSlots(date, branchId)` — `enabled: !!date && !!branchId`, `staleTime: 60_000`

### Health check
- `useHealthCheck` (L965) — `['health']` — inline `fetch('/api/health')` (not a service) — `staleTime: 30_000, gcTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnMount: false`

### User / Addresses / Favorites
- `useAddresses` (L982) — `['addresses']` — `userService.getAddresses()` — `staleTime: STALE_TIME`. Consumer: `/home/user/samoon_Q/src/app/dashboard/addresses/page.tsx:19`.
- `useFavorites` (L990) — `['favorites']` — `userService.getFavorites()`, side-effect syncs into `useFavoritesStore.setFavorites` inside queryFn — `staleTime: STALE_TIME`

### Analytics (admin, P6.13)
- `useAnalyticsSummary` (L1023) — `['analytics-summary', tenantId]` — `analyticsService.getAnalyticsSummary()` — `staleTime: STALE_TIME`
- `useRevenueAnalytics` (L1032) — `['analytics-revenue', tenantId]`
- `useReservationAnalytics` (L1041) — `['analytics-reservations', tenantId]`
- `useLoyaltyAnalytics` (L1050) — `['analytics-loyalty', tenantId]`
- `usePromotionAnalytics` (L1059) — `['analytics-promotions', tenantId]`
- `useVendorAnalytics` (L1068) — `['analytics-vendors', tenantId]`
- `useMenuAnalytics` (L1077) — `['analytics-menu', tenantId]`
  (all six: analytics*Service getters, `staleTime: STALE_TIME`)
- `useAnalyticsComparison(period)` (L2870) — two internal queries: `['analytics-summary','current',period,currentStart]` and `['analytics-summary','previous',period,previousStart]` — `analyticsService.getAnalyticsSummary({dateFrom,...})` — `staleTime: 60_000` each

### QR / Table
- `useQRExperience(businessType?)` (L1087) — `['qr-experience', businessType ?? 'default']` — `qrExperienceService.getQRExperience(businessType)` — `staleTime: STALE_TIME`
- `useTableInfo(tableId)` (L1096) — `['table-info', tableId]` — `tableService.getTableInfo(tableId)` — `enabled: !!tableId`, `staleTime: STALE_TIME`

### Admin dashboard (P5.1)
- `useAdminStats` (L1107) — `['admin-stats', tenantId]` — `adminService.getStats()` — `staleTime: 60_000`
- `useAdminOrders(filters)` (L1125) — `['admin-orders', tenantId, filters]` — `adminService.getAdminOrders(filters)` wrapped w/ `assertOwnershipTenantAccess` — `staleTime: 30_000`, `enabled: !!tenantId`
- `useAdminReservations(filters)` (L1177) — `['admin-reservations', tenantId, filters]` — `adminService.getAdminReservations(filters)` w/ tenant-access check — `staleTime: 30_000`, `enabled: !!tenantId`
- `useAdminReservation(id)` (L1190) — `['admin-reservation', id]` — `adminService.getAdminReservation(id)` — `enabled: !!id`, `staleTime: 10_000`
- `useAdminCustomers(filters)` (L1267) — `['admin-customers', tenantId, filters]` — `adminService.getCustomers(...)` — `staleTime: STALE_TIME`, `enabled: !!tenantId`
- `useAdminCustomer(id)` (L1277) — `['admin-customer', tenantId, id]` — `adminService.getCustomer(id, tenantId)` — `enabled: !!id && !!tenantId`, `staleTime: STALE_TIME`
- `useAdminCustomerStats(id)` (L1287) — `['admin-customer-stats', tenantId, id]`
- `useAdminCustomerReviews(id)` (L1297) — `['admin-customer-reviews', tenantId, id]`

### Customer 360°/CRM (P8.9.6/P8.9.7)
- `useBusinessCustomer(userId)` (L1309) — `['business-customer', tenantId, userId]` — `adminService.getBusinessCustomer(...)`
- `useBranchCustomers(userId)` (L1319) — `['branch-customers', tenantId, userId]`
- `useCustomerLoyalty(userId)` (L1329) — `['customer-loyalty', tenantId, userId]` — `loyaltyService.getAccount(userId, tenantId)`
- `useCustomerTimeline(userId)` (L1341) — `['customer-timeline', tenantId, userId]`
- `useCustomerNotes(userId)` (L1351) — `['customer-notes', tenantId, userId]` — `staleTime: 0` (always stale)
- `useCustomerTags(userId)` (L1390) — `['customer-tags', tenantId, userId]`
- `useTenantTagDefinitions` (L1400) — `['tenant-tags', tenantId]` — `staleTime: CACHE_TIME`
- `useCustomerAnalytics(userId)` (L1419) — `['customer-analytics', tenantId, userId]`
- `useCustomerMarketing(userId)` (L1429) — `['customer-marketing', tenantId, userId]`
- `useCustomerCoupons(userId)` (L1439) — `['customer-coupons', tenantId, userId]`
- `useCustomerPayments(userId)` (L1449) — `['customer-payments', tenantId, userId]`
- `useCustomerOrders360(userId)` (L1459) — `['customer-orders-360', tenantId, userId]`
- `useCustomerReservations360(userId)` (L1469) — `['customer-reservations-360', tenantId, userId]`
  (all `enabled: !!userId && !!tenantId`, `staleTime: STALE_TIME` unless noted)

### Vendors (P6.11)
- `useVendors` (L1604) — `['vendors', tenantId]` — `vendorService.getVendors()` — `staleTime: STALE_TIME`
- `useVendor(id)` (L1613) — `['vendor', id]` — `enabled: !!id`, `staleTime: STALE_TIME`
- `useVendorStats(id)` (L1650) — `['vendor-stats', id]` — `staleTime: 60_000`
- `useVendorSettlements(id)` (L1659) — `['vendor-settlements', id]` — `staleTime: STALE_TIME`

### Promotions (P6.10)
- `usePromotions` (L1681) — `['promotions', tenantId]` — `staleTime: STALE_TIME`
- `useActivePromotions` (L1690) — `['active-promotions', tenantId]` — `staleTime: 30_000, refetchInterval: 60_000` (polling)

### Loyalty (P6.9)
- `useLoyaltyAccount` (L1747) — `['loyalty-account', tenantId]` — `staleTime: 30_000`
- `useLoyaltyTransactions` (L1756) — `['loyalty-transactions', tenantId]` — `staleTime: 30_000`
- `useLoyaltyRewards` (L1765) — `['loyalty-rewards', tenantId]` — `staleTime: STALE_TIME`
- `useAdminLoyaltyRewards` (L1796) — `['admin-loyalty-rewards', tenantId]` — `staleTime: STALE_TIME`

### Tenant Provisioning/Management (P6.14/P6.15)
- `useTenantTemplates` (L1859) — `['tenant-templates']` — `staleTime: Infinity` (never refetches)
- `useTenants` (L1909) — `['tenants']` — `tenantService.getTenants()` — `staleTime: STALE_TIME`, `enabled: canView` (RBAC-gated). Consumer: `/home/user/samoon_Q/src/components/admin/AdminTenantSwitcher.tsx:38`.
- `usePublicTenants` (L1925) — `['public-tenants']` — same service, `select` filters to active/trial tenants excluding `default` slug
- `usePublicTenant(slug)` (L1938) — `['public-tenant', slug]` — `enabled: !!slug`
- `usePublicBranch(tenantSlug, branchSlug)` (L1953) — `['public-branch', tenantSlug, branchSlug]` — `enabled: !!tenantSlug && !!branchSlug`

### Staff Management (P7.2)
- `useStaff(tenantId)` (L2028) — `['staff', tenantId]` — `staffService.getStaff(tenantId)` w/ `assertOwnershipTenantAccess` — `staleTime: STALE_TIME`, `enabled: !!tenantId`
- `useStaffMember(id)` (L2041) — `['staff-member', id]` — `enabled: !!id`
- `useInvites(tenantId)` (L2050) — `['staff-invites', tenantId]` — `enabled: !!tenantId`

### Branch Routing/Isolation (P7.4)
- `useAccessibleBranches(context, allBranches)` (L2250) — `['accessible-branches', tenantId, staffId, roles, branchIds]` — local computation via `branchAccessService.getAccessibleBranches` — `enabled: !!tenantId && !!staffId`
- `useBranchOrders(branchId)` (L2295) — `['branch-orders', branchId]` — `adminService.getAdminOrders({branch_id})` w/ `assertOwnershipBranchAccess` — `enabled: !!branchId`
- `useBranchReservations(branchId)` (L2311) — `['branch-reservations', branchId]` — similarly access-checked
- `useBranchAnalytics(branchId)` (L2327) — `['branch-analytics', branchId]` — parallel `Promise.all` of 3 branchAnalyticsService calls — `staleTime: 30_000`

### Audit Log (P7.5)
- `useAuditLogs(filter)` (L2348) — `['audit-logs', filter]` — `staleTime: 15_000`
- `useAuditLog(id)` (L2358) — `['audit-log', id]` — `enabled: !!id`
- `useAuditTimeline(filter)` (L2368) — `['audit-timeline', filter]` — `staleTime: 15_000`
- `useAuditStatistics(filter)` (L2378) — `['audit-statistics', filter]` — `staleTime: 30_000`

### Notifications (P7.6)
- `useNotifications(filter)` (L2397) — `['rich-notifications', filter]` — `staleTime: 10_000`
- `useUnreadNotifications(filter)` (L2407) — `['rich-notifications-unread', filter]`
- `useNotification(id)` (L2417) — `['rich-notification', id]` — `enabled: !!id`
- `useUnreadNotificationCount(filter)` (L2427) — `['notification-unread-count', filter]` — `refetchInterval: 30_000` (polling)
- `useNotificationStatistics(filter)` (L2438) — `['notification-statistics', filter]` — `staleTime: 30_000`
- `useNotificationSummary(tenantId?, branchId?)` (L2448) — `['notification-summary', tenantId, branchId]` — `refetchInterval: 30_000`
- `useNotificationPreferences(userId, tenantId, branchId?)` (L2459) — `['notification-preferences', userId, tenantId, branchId]` — `staleTime: 60_000`, `enabled: !!userId && !!tenantId`

### Realtime Operations (P7.7) — all poll-based (`refetchInterval`), all wrapped with `assertOperationsScopeAccess`/`assertOwnershipBranchAccess`
- `useOperationsDashboard(scope)` (L2576) — `['operations-dashboard', tenantId, branchId]` — `refetchInterval: 15_000`
- `useLiveOrders(scope)` (L2589) — `['live-orders', tenantId, branchId]` — `refetchInterval: 10_000`
- `useLiveReservations(scope)` (L2602) — `['live-reservations', tenantId, branchId]` — `refetchInterval: 10_000`
- `useBranchStatus(scope)` (L2615) — `['branch-status', tenantId, branchId]` — `refetchInterval: 20_000`
- `useKitchenStatus(branchId, tenantId)` (L2628) — `['kitchen-status', tenantId, branchId]` — `refetchInterval: 8_000`
- `useStaffPresence(scope)` (L2641) — `['staff-presence', tenantId, branchId]` — `refetchInterval: 30_000`
- `useSLAAlerts(scope)` (L2654) — `['sla-alerts', tenantId, branchId]` — `refetchInterval: 15_000`
- `useRealtimeStatistics(scope)` (L2667) — `['realtime-statistics', tenantId, branchId]` — `refetchInterval: 30_000`
- `useOperationsStream(scope, limit=50)` (L2680) — `['operations-stream', tenantId, branchId, limit]` — `refetchInterval: 10_000`

### Feature Flags (P7.8 Phase D)
- `useFeatureFlags` (L2696) — `['feature-flags', tenant?.id]` — `featureFlagsService.listFlags(tenant)` — `enabled: !!tenant`, `staleTime: 60_000`

### Business Reviews (P8.8.5)
- `useBusinessReviews(tenantId, filters)` (L2909) — `['business-reviews', tenantId, filters]` — `staleTime: STALE_TIME, gcTime: CACHE_TIME`, `enabled: Boolean(tenantId)`
- `useRatingBreakdown(tenantId, branchId?)` (L2922) — `['business-reviews', tenantId, 'rating', branchId ?? null]`
- `useReviewAnalytics(tenantId)` (L2974) — `['business-reviews', tenantId, 'analytics']`

### Website Builder (P8.8.6)
- `useHomepageLayout(tenantSlug)` (L2989) — `['website-builder', tenantSlug, 'layout']` — `staleTime: STALE_TIME, gcTime: CACHE_TIME`
- `useBranchOverrides(tenantSlug, branchSlug)` (L3030) — `['website-builder', tenantSlug, 'branch-overrides', branchSlug]`

---

## 3) Mutations (grouped by module/feature)

### Auth
- `useLogin` (L510) — `authService.login(creds)` — `onSuccess`: `setUser(user)`; if `p7Roles` present, seeds `useRbacStore.setTenantRoles(tenantId, p7Roles)`. No invalidation.
- `useRegister` (L528) — `authService.register(data)` — same `onSuccess` pattern as `useLogin`.
- `useSendOTP` (L543) — `authService.sendOTP(payload)` — no callbacks.
- `useVerifyOTP` (L563) — `authService.verifyOTP(payload)` — `onSuccess`: if `is_new_user` returns early (no session init); else `setUser` + seed RBAC roles.
- `useLogout` (L578) — `authService.logout()` — `onSettled`: full session teardown — `logout()`, `useRbacStore._resetStore()`, `useBranchStore.setAdminActiveBranch(null)`, `useCartStore.clearCart()`, `useDineInStore.clearTable()`, `useFavoritesStore.setFavorites([])`, `useRecentlyViewedStore.clear()`, `qc.clear()` (clears entire cache).

### Orders
- `useCreateOrder` (L689) — `orderService.createOrder(payload)` — `onSuccess`: invalidates `['orders']`.
- `useValidateDiscount` (L697) — `orderService.validateDiscountCode(code, subtotal)` — no callbacks (pure computation mutation).

### Reviews
- `useCreateReview(itemId)` (L714) — `reviewService.createReview(itemId, payload)` — `onSuccess`: invalidates `['reviews', itemId]`.

### Payments
- `useCreatePaymentIntent` (L725) — `paymentService.createPaymentIntent(payload)` — no callbacks.

### Branch Management (admin, P7.3) — heavy optimistic-update usage
- `useCreateBranch(tenantId)` (L788) — `branchManagementService.createBranch` — `onSuccess`: invalidates `['admin-branches', tenantId]`.
- `useUpdateBranch` (L799) — `branchManagementService.updateBranch(id, payload)` — **optimistic**: `onMutate` cancels `['admin-branch', id]`, snapshots via `getQueryData`, merges patch fields into cache via `setQueryData`; `onError` rolls back from snapshot; `onSuccess` invalidates `['admin-branch', id]` + `['admin-branches']`.
- `useActivateBranch` / `useDeactivateBranch` / `useMaintenanceBranch` (L830/852/874) — same optimistic pattern, each sets `status` field directly (`'active'`/`'inactive'`/`'maintenance'`), rollback on error, invalidate `['admin-branch', id]` + `['admin-branches']` on success.
- `useAssignBranchManager` (L896) — optimistic `managerId` update, same rollback/invalidate pattern.

### Reservations
- `useCreateReservation` (L932) — `reservationService.create(payload)` — `onSuccess`: invalidates `['reservations']`.

### Admin Orders/Reservations
- `useUpdateOrderStatus` (L1138) — `adminService.updateOrderStatus(id, status)` — **optimistic**: `onMutate` cancels `['admin-orders']`, snapshots ALL matching queries via `getQueriesData`, patches status across all cached pages via `setQueriesData`; `onError` restores each snapshot; `onSuccess` invalidates `['admin-orders']` + `['orders']` and records an audit-log entry (`auditLogService.record('ORDER_STATUS_CHANGED', ...)`).
- `useConfirmReservation` (L1199) — `adminService.confirmReservation(id)` — same multi-query optimistic pattern (sets status to `'confirmed'`), invalidates `['admin-reservations']` + `['reservations']`, audit-logs `RESERVATION_CONFIRMED`.
- `useCancelReservation` (L1233) — `reservationService.cancelReservation(id)` — same pattern → `'cancelled'`, invalidates same keys, audit-logs `RESERVATION_CANCELLED`.

### Customer Notes/Tags (P8.9.7)
- `useCreateCustomerNote(userId)` (L1361) — `onSuccess`: invalidates `['customer-notes', tenantId, userId]`.
- `useUpdateCustomerNote(userId)` (L1371) — same invalidation.
- `useDeleteCustomerNote(userId)` (L1381) — same invalidation.
- `useUpdateCustomerTags(userId)` (L1410) — invalidates `['customer-tags', tenantId, userId]`.

### Bulk Operations (P7.14)
- `useBulkUpdateOrderStatus` (L1481) — `Promise.all` of `adminService.updateOrderStatus` — `onSuccess`: invalidates `['admin-orders']` + `['orders']`.
- `useBulkCancelOrders` (L1493) — same, status forced to `'cancelled'`.
- `useBulkConfirmReservations` (L1505) — invalidates `['admin-reservations']` + `['reservations']`.
- `useBulkCancelReservations` (L1517) — same invalidation.
- `useBulkExportCustomers` (L1529) — client-only CSV blob download, no server call/invalidation.

### Menu Admin (P5.1)
- `useCreateMenuItem` (L1565) — `menuService.createItem(payload)` — `onSuccess`: invalidates `['menu-items']` + `['categories']`.
- `useUpdateMenuItem` (L1576) — **optimistic**: `onMutate` snapshots all `['menu-items']` query pages, patches item in place; `onError` rollback; `onSuccess` invalidates `['menu-items']` + `['menu-item', id]`.
- `useDeleteMenuItem` (L1833) — **optimistic**: removes item from all `['menu-items']` pages, decrements `count`; rollback on error; `onSuccess` invalidates `['menu-items']`.

### Vendors (P6.11)
- `useCreateVendor` (L1622) — invalidates `['vendors']`.
- `useUpdateVendor` (L1630) — invalidates `['vendors']` + `['vendor', id]`.
- `useDisableVendor` (L1642) — invalidates `['vendors']`.
- `useCreateSettlement` (L1668) — invalidates `['vendor-settlements', vendorId]` + `['vendor-stats', vendorId]`.

### Promotions (P6.10)
- `useCreatePromotion` / `useUpdatePromotion` / `useDisablePromotion` / `useActivatePromotion` (L1700–1743) — each invalidates `['promotions']` + `['active-promotions']` on success.

### Loyalty (P6.9)
- `useRedeemReward` (L1774) — invalidates `['loyalty-account']` + `['loyalty-transactions']`.
- `useEarnPoints` (L1785) — same invalidation.
- `useAdminCreateReward` / `useAdminUpdateReward` / `useAdminDisableReward` (L1805–1829) — each invalidates `['admin-loyalty-rewards']`.

### Tenant Provisioning/Settings (P6.14)
- `useProvisionTenant` (L1867) — invalidates `['tenant-templates']`.
- `useCloneTenant` (L1876) — invalidates `['tenant-templates']`.
- `useUpdateTenantSettings` (L1892) — `onSuccess`: writes result straight into `useTenantStore.setTenant(updated)` (store sync, not just cache), then invalidates `['tenant']`.

### Tenant Management (P6.15)
- `useActivateTenant` / `useSuspendTenant` / `useArchiveTenant` (L1967/1985/2003) — each invalidates `['tenants']` and calls `auditLogService.record(...)` with before/after status.

### Staff Management (P7.2)
- `useInviteStaff(tenantId)` (L2059) — invalidates `['staff-invites', tenantId]`, audit-logs `STAFF_CREATED`.
- `useUpdateStaffRoles` (L2078) — reads cached `['staff-member', id]` to find `tenantId`, invalidates `['staff', tenantId]` + `['staff-member', id]`, audit-logs `STAFF_UPDATED`.
- `useSuspendStaff` / `useActivateStaff` / `useRemoveStaff` (L2102/2132/2162) — **optimistic** status patch on `['staff-member', id]`, rollback on error, invalidate `['staff-member', id]` on success, audit-log respective event.
- `useTransferOwnership(tenantId)` (L2192) — invalidates `['staff', tenantId]`, audit-logs `OWNERSHIP_TRANSFERRED`.
- `useCancelInvite(tenantId)` / `useResendInvite(tenantId)` (L2217/2225) — invalidate `['staff-invites', tenantId]`.
- `useAcceptInvite` (L2233) — invalidates `['staff-invites']` (all).

### Audit Log (P7.5)
- `useExportAuditLogs` (L2388) — `auditLogService.exportAuditLogs(request)` — no callbacks (returns file content).

### Notifications (P7.6)
- `useUpdateNotificationPreference` (L2469) — invalidates `['notification-preferences', userId, tenantId]`.
- `useMarkNotificationRead` (L2488) — invalidates `['rich-notifications']` + `['notification-unread-count']` + `['notification-summary']`.
- `useMarkAllNotificationsRead` (L2501) — same 3-key invalidation.
- `useArchiveNotification` (L2514) — invalidates `['rich-notifications']`.
- `useDeleteNotification` (L2525) — invalidates `['rich-notifications']` + `['notification-unread-count']`.
- `useResetNotificationPreferences` (L2537) — invalidates `['notification-preferences', userId, tenantId]`.

### Feature Flags (P7.8 Phase D)
- `useUpdateFeatureFlag` (L2709) — mutationFn synchronously mutates `useTenantStore` (`setTenant`, `setFeatureFlags`) then resolves; `onSuccess` invalidates `['feature-flags']`. Effectively a store-sync mutation wrapped in RQ form for consistent loading/error state.

### Analytics Export/Favorites/User
- `useExportAnalytics` (L2828) — client-side export (CSV/JSON/PDF download), no server invalidation.
- `useToggleFavorite` (L1003) — **optimistic, store-only** (no server cache involved): `onMutate` calls `useFavoritesStore.toggleFavorite(itemId)` directly; `onError` calls it again to roll back (toggle is its own inverse).

### Business Reviews (P8.8.5)
- `useCreateBusinessReview(tenantId)` (L2932) — invalidates `['business-reviews', tenantId]`.
- `useReplyToReview(tenantId)` (L2942) — same invalidation.
- `useMarkHelpful(tenantId)` (L2953) — same invalidation.
- `useModerateReview(tenantId)` (L2963) — same invalidation.

### Website Builder (P8.8.6)
- `useSaveLayout(tenantSlug)` (L2999) — `onSuccess`: writes result directly via `setQueryData(['website-builder', tenantSlug, 'layout'], saved)` (no invalidation — direct cache write).
- `usePublishLayout(tenantSlug)` (L3009) — `setQueryData` for layout + invalidates `['tenant', tenantSlug]` (published site affects tenant record).
- `useRestoreVersion(tenantSlug)` (L3020) — `setQueryData` for layout.
- `useSaveBranchOverrides(tenantSlug, branchSlug)` (L3040) — `setQueryData(['website-builder', tenantSlug, 'branch-overrides', branchSlug], saved)`.

### Component-local mutations (outside `src/hooks/index.ts`)

**`/home/user/samoon_Q/src/components/admin/AdminBranchSwitcher.tsx`** (lines ~30–60): inline branch-switch handler using `qc` directly (no `useMutation` wrapper observed — plain async handler) that invalidates on switch: `['admin-orders']`, `['admin-reservations']`, `['admin-customers']`, `['admin-stats']`, `['analytics-summary']`, `['analytics-revenue']`, `['analytics-reservations']`. Consumes `useAdminBranches(tenant.id)` for its list and `useBranchStore` for `adminActiveBranch`.

**`/home/user/samoon_Q/src/app/dashboard/addresses/page.tsx`**: inline CRUD (add/delete address) using `qc.invalidateQueries({ queryKey: ['addresses'] })` twice (lines 32, 43) after add/delete calls — not routed through a `src/hooks` mutation hook, calls the service directly in the page. Consumes `useAddresses()` for the list.

**`/home/user/samoon_Q/src/components/admin/AdminTenantSwitcher.tsx`**: imports `useQueryClient()` (line 39) but no direct `invalidateQueries`/`setQueryData` call was found in this file — likely reserved for future use or relies on `qc.clear()`/hooks elsewhere; consumes `useTenants()` for its list.

---

## 4) Zustand Stores

### `/home/user/samoon_Q/src/stores/index.ts` (all stores) + `/home/user/samoon_Q/src/platform-admin/store.ts`

| Store | State | Key Actions | Persist? | Syncs w/ server data? |
|---|---|---|---|---|
| **useAuthStore** (L50) | `user: User\|null`, `isAuthenticated`, `isLoading` | `setUser`, `setLoading`, `logout` | No persist (in-memory only; rehydrated via `authService.getMe()` in `AuthBootstrapper` on boot) | Yes — `setUser` populated from `useMe()`/`useLogin()`/`useRegister()`/`useVerifyOTP()` mutation results and `AuthBootstrapper`'s `getMe()` call |
| **useCartStore** (L79) | `items: CartItem[]`, `discountCode`, `discountAmount`, `isOpen` | `addItem`, `removeItem`, `updateQuantity`, `updateNotes`, `clearCart`, `setDiscount`, `setOpen`, derived getters `getSubtotal/getTax/getServiceCharge/getTotal/getItemCount` | Yes — `persist` with **custom debounced localStorage adapter** (`createDebouncedStorage`, 50ms debounce), key = `CART_KEY` | No — purely client-side cart state, no RQ involvement (checkout submits via `useCreateOrder` mutation but cart itself isn't server-synced) |
| **useThemeStore** (L159) | `theme: 'light'\|'dark'\|'system'` | `setTheme` (also toggles DOM class) | Yes — `persist`, key = `THEME_KEY` | No |
| **useLangStore** (L181) | `locale: string` | `setLocale` (sets `<html lang/dir>`, writes `NEXT_LOCALE` cookie) | Yes — `persist`, key = `LANG_KEY` | No |
| **useTenantStore** (L268) | `tenant: Tenant`, `isLoading`, `tenantState: TenantLifecycle`, `rbacInitialized`, `featureFlagsInitialized`, `featureFlags: Record<string,boolean>` | `setTenant`, `loadTenant(slug)` (calls `tenantService.getTenant`), `setRbacInitialized`, `setFeatureFlagsInitialized`, `setFeatureFlags`, `reset` | Yes — `persist`, key = `TENANT_KEY`, **`partialize`: only `tenant` field persisted**; version 1 with `migrate` resetting to `DEFAULT_TENANT` | Yes — `loadTenant()` calls `tenantService.getTenant(slug)` directly (not via RQ); bootstrap coordinator for RBAC/feature-flag readiness signals |
| **useBranchStore** (L325) | `activeBranch: Branch\|null` (public), `adminActiveBranch: AdminBranch\|null` (admin) | `setActiveBranch`, `setAdminActiveBranch` | Yes — `persist`, key = `BRANCH_KEY` | No direct RQ sync (set by `AdminBranchSwitcher` component using `useAdminBranches()` query data) |
| **useNotificationStore** (L347) | `notifications: Notification[]`, `unreadCount` | `setNotifications`, `addNotification`, `markRead`, `markAllRead` | No persist | Appears to be a legacy/simple notification store separate from the richer RQ-backed `useNotifications`/`notificationRichService` hooks (P7.6) — not obviously wired to those hooks in the reviewed code |
| **useFavoritesStore** (L377) | `favorites: Set<string>` | `toggleFavorite`, `isFavorite`, `setFavorites` | Yes — `persist` with **custom storage adapter** serializing `Set`↔`Array`, key = `'savor-favorites'` | Yes — `setFavorites` populated from `useFavorites()` query and `AuthBootstrapper`'s `userService.getFavorites()` call; `useToggleFavorite()` mutation drives `toggleFavorite` optimistically (store-only, no cache write) |
| **useRecentlyViewedStore** (L419) | `items: MenuItem[]` (max 10) | `addItem`, `clear` | Yes — `persist`, key = `'savor-recently-viewed'` | No |
| **useRbacStore** (L499) | `tenantRoles: TenantRoleAssignment[]`, `userOverrides: UserPermissionOverride[]`, `customRoles: CustomRoleTemplate[]`, `rbacAuditLog: RbacAuditEvent[]` (capped 500) | `setTenantRoles`, `addRole`, `removeRole`, `clearRoles`, `getRolesForTenant`, `setUserOverride`, `clearUserOverride`, `getUserOverride`, `addCustomRole`, `updateCustomRole`, `deleteCustomRole`, `getCustomRoles`, `addRbacAuditEvent`, `getRbacAuditLog`, `clearRbacAuditLog`, `_resetStore` | Yes — `persist`, key = `'savor-rbac'`, **no `partialize`** — fully persisted (documented as a deliberate transitional gap in code comments, pending backend endpoint for overrides) | Yes — `setTenantRoles` populated from login/register/verify-OTP mutation results and `AuthBootstrapper`'s session-restore path (`authService.getMe()` → `user.tenantRoles`) |
| **useDineInStore** (L607) | `tableNumber: number\|null` | `setTableNumber`, `clearTable` | Yes — `persist`, key = `DINE_IN_KEY` | No |
| **usePlatformAdminStore** (`src/platform-admin/store.ts`) | `platformRole: PlatformRole` (default `'platform_super_admin'`) | `setPlatformRole` | Yes — `persist`, key = `'platform-admin-store'` | No (mock-mode-friendly default; documented as should eventually derive from authenticated platform user record) |

**Cross-cutting note:** `AuthBootstrapper` and `useLogout()` both perform a full coordinated teardown/hydration across `useAuthStore`, `useRbacStore`, `useBranchStore`, `useCartStore`, `useDineInStore`, `useFavoritesStore`, `useRecentlyViewedStore`, and the React Query cache (`qc.clear()`), keeping stores and server cache in lockstep on login/logout.
