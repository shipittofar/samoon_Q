export const ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login/',
    REGISTER: '/auth/register/',
    LOGOUT: '/auth/logout/',
    REFRESH: '/auth/token/refresh/',
    ME: '/auth/me/',
    FORGOT_PASSWORD: '/auth/forgot-password/',
    RESET_PASSWORD: '/auth/reset-password/',
    VERIFY_OTP: '/auth/verify-otp/',
    SEND_OTP: '/auth/send-otp/',
    SWITCH_TENANT: '/authorization/switch-tenant/',
    CHANGE_PASSWORD: '/auth/change-password/',
    VERIFY_EMAIL_REQUEST: '/auth/verify-email/request/',
    VERIFY_EMAIL_CONFIRM: '/auth/verify-email/confirm/',
  },

  // Menu
  MENU: {
    CATEGORIES: '/menu/categories/',
    CATEGORY: (id: string) => `/menu/categories/${id}/`,
    CONSOLE_CATEGORY: (branchId: string) => `/menu/console-categories/${branchId}/`,
    ITEMS: '/menu/items/',
    ITEM: (id: string) => `/menu/items/${id}/`,
    ITEM_BY_SLUG: (slug: string) => `/menu/items/${slug}/`,
    FEATURED: '/menu/items/featured/',
    POPULAR: '/menu/items/popular/',
    SEARCH: '/menu/items/search/',
    RELATED: (id: string) => `/menu/items/${id}/related/`,
    EXTRA_GROUPS: '/menu/extra-groups/',
    EXTRA_GROUP: (id: string) => `/menu/extra-groups/${id}/`,
    EXTRAS: '/menu/extras/',
    EXTRA: (id: string) => `/menu/extras/${id}/`,
  },

  // Orders
  ORDERS: {
    LIST: '/orders/',
    CONSOLE_ORDER_TENANT_BRANCH_LIST: (tenantId: string, branchId: string) =>
      `/orders/console-orders/tenants/${tenantId}/branches/${branchId}/`,
    CREATE: '/orders/',
    DETAIL: (id: string) => `/orders/${id}/`,
    CANCEL: (id: string) => `/orders/${id}/cancel/`,
    REORDER: (id: string) => `/orders/${id}/reorder/`,
    TRACK: (id: string) => `/orders/${id}/track/`,
    VALIDATE_DISCOUNT: '/orders/validate-discount/',
    STATUS: (id: string) => `/orders/${id}/status/`,
  },

  // Payments (P4.1 — Stripe PaymentIntent)
  PAYMENTS: {
    CREATE_INTENT: '/payments/create-intent/',
    CONFIRM: '/payments/confirm/',
  },

  // Reservations
  RESERVATIONS: {
    LIST: '/reservations/',
    CREATE: '/reservations/',
    DETAIL: (id: string) => `/reservations/${id}/`,
    CANCEL: (id: string) => `/reservations/${id}/cancel/`,
    CONFIRM: (id: string) => `/reservations/${id}/confirm/`,
    AVAILABLE_SLOTS: '/reservations/available-slots/',
  },

  // Branches
  BRANCHES: {
    LIST: '/branches/',
    DETAIL: (id: string) => `/branches/${id}/`,
    NEARBY: '/branches/nearby/',
    // P7.3 — Branch Management
    GET: (id: string) => `/tenants/branches/${id}/`,
    CREATE: '/branches/',
    UPDATE: (id: string) => `/branches/${id}/`,
    ACTIVATE: (id: string) => `/branches/${id}/activate/`,
    DEACTIVATE: (id: string) => `/branches/${id}/deactivate/`,
    MAINTENANCE: (id: string) => `/branches/${id}/maintenance/`,
    ASSIGN_MANAGER: (id: string) => `/branches/${id}/manager/`,
    METRICS: (id: string) => `/branches/${id}/metrics/`,
    DELETE: (id: string) => `/branches/${id}/`,
    SET_DEFAULT: (id: string) => `/branches/${id}/default/`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications/',
    MARK_READ: (id: string) => `/notifications/${id}/read/`,
    MARK_ALL_READ: '/notifications/read-all/',
    DELETE: (id: string) => `/notifications/${id}/`,
    REGISTER_DEVICE: '/notifications/register-device/',
  },

  // Users
  USERS: {
    PROFILE: '/users/profile/',
    // UPDATE_PROFILE: '/users/profile/',
    UPDATE_PROFILE: '/auth/profile/update/',
    // AVATAR_UPLOAD: '/users/avatar/',
    AVATAR_UPLOAD: '/auth/profile/avatar/',
    ADDRESSES: '/users/addresses/',
    ADDRESS: (id: string) => `/users/addresses/${id}/`,
    FAVORITES: '/users/favorites/',
    TOGGLE_FAVORITE: (itemId: string) => `/users/favorites/${itemId}/`,
  },

  // Tenants (Phase 1A — P1A.1 / P6.14 — Provisioning / P6.15 — Management)
  TENANTS: {
    /** Legacy slug path — mock mode only. Production public routes use resolvePublicTenantId + DETAIL_BY_ID. */
    DETAIL_BY_SLUG: (slug: string) => `/tenants/${slug}/`,
    /** All post-bootstrap tenant lookups and mutations — canonical id only. */
    DETAIL_BY_ID: (tenantId: string) => `/tenants/${tenantId}/`,
    CURRENT: '/tenants/current/',
    LIST: '/tenants/',
    PROVISION: '/tenants/provision/',
    CLONE: '/tenants/clone/',
    ACTIVATE: (tenantId: string) => `/tenants/${tenantId}/activate/`,
    BRANCHES: (tenantId: string) => `/tenants/${tenantId}/branches/`,
    BRANCH_DETAIL: (tenantId: string, branchId: string) =>
      `/tenants/${tenantId}/branches/${branchId}/`,
    SUSPEND: (tenantId: string) => `/tenants/${tenantId}/suspend/`,
    ARCHIVE: (tenantId: string) => `/tenants/${tenantId}/archive/`,
    SETTINGS: (tenantId: string) => `/tenants/${tenantId}/settings/`,
    TRANSFER_OWNERSHIP: (tenantId: string) => `/tenants/${tenantId}/transfer-ownership/`,
  },

  // Reviews (menu-item level)
  REVIEWS: {
    CREATE: '/reviews/',
    LIST: '/reviews/',
    ITEM_REVIEWS: (itemId: string) => `/menu/items/${itemId}/reviews/`,
  },

  // Website Builder (P8.8.6)
  WEBSITE_BUILDER: {
    LAYOUT: (tenantId: string) => `/tenants/${tenantId}/website/layout/`,
    PUBLISH: (tenantId: string) => `/tenants/${tenantId}/website/publish/`,
    RESTORE: (tenantId: string, versionId: string) => `/tenants/${tenantId}/website/versions/${versionId}/restore/`,
    VERSIONS: (tenantId: string) => `/tenants/${tenantId}/website/versions/`,
    BRANCH_OVERRIDES: (tenantId: string, branchId: string) => `/tenants/${tenantId}/branches/${branchId}/website/overrides/`,
    MEDIA_UPLOAD: (tenantId: string) => `/tenants/${tenantId}/website/media/`,
  },

  // Business Reviews (tenant/branch level — P8.8.5)
  BUSINESS_REVIEWS: {
    LIST: (tenantId: string) => `/tenants/${tenantId}/reviews/`,
    RATING: (tenantId: string) => `/tenants/${tenantId}/reviews/rating/`,
    BRANCH_RATING: (tenantId: string, branchId: string) => `/tenants/${tenantId}/branches/${branchId}/reviews/rating/`,
    CREATE: (tenantId: string) => `/tenants/${tenantId}/reviews/`,
    DETAIL: (tenantId: string, reviewId: string) => `/tenants/${tenantId}/reviews/${reviewId}/`,
    REPLY: (tenantId: string, reviewId: string) => `/tenants/${tenantId}/reviews/${reviewId}/reply/`,
    HELPFUL: (tenantId: string, reviewId: string) => `/tenants/${tenantId}/reviews/${reviewId}/helpful/`,
    MODERATE: (tenantId: string, reviewId: string) => `/tenants/${tenantId}/reviews/${reviewId}/moderate/`,
    ANALYTICS: (tenantId: string) => `/tenants/${tenantId}/reviews/analytics/`,
  },

  // Table
  TABLE: {
    INFO: (tableId: string) => `/tables/${tableId}/`,
    ORDER: (tableId: string) => `/tables/${tableId}/order/`,
  },

  // Loyalty (P6.9)
  LOYALTY: {
    ACCOUNT: '/loyalty/account/',
    TRANSACTIONS: '/loyalty/transactions/',
    REWARDS: '/loyalty/rewards/',
    REDEEM: (rewardId: string) => `/loyalty/rewards/${rewardId}/redeem/`,
    EARN: '/loyalty/earn/',
    ADMIN_REWARDS: '/admin/loyalty/rewards/',
    ADMIN_REWARD: (id: string) => `/admin/loyalty/rewards/${id}/`,
  },

  // Vendor Management (P6.11) — food_court only
  VENDORS: {
    LIST: '/vendors/',
    DETAIL: (id: string) => `/vendors/${id}/`,
    STATS: (id: string) => `/vendors/${id}/stats/`,
    SETTLEMENTS: (id: string) => `/vendors/${id}/settlements/`,
    ADMIN_LIST: '/admin/vendors/',
    ADMIN_DETAIL: (id: string) => `/admin/vendors/${id}/`,
    ADMIN_SETTLEMENTS: '/admin/settlements/',
  },

  // Promotions (P6.10)
  PROMOTIONS: {
    LIST: '/promotions/',
    ACTIVE: '/promotions/active/',
    DETAIL: (id: string) => `/promotions/${id}/`,
    ACTIVATE: (id: string) => `/promotions/${id}/activate/`,
  },

  // Admin (P5.1) — backend-gated endpoints; mocked until API is deployed
  ADMIN: {
    STATS: '/admin/stats/',
    ORDERS: '/admin/orders/',
    RESERVATIONS: '/admin/reservations/',
    CUSTOMERS: '/admin/customers/',
    CUSTOMER_DETAIL: (id: string) => `/admin/customers/${id}/`,
    CUSTOMER_STATS: (id: string) => `/admin/customers/${id}/stats/`,
  },

  // Analytics (P6.13) — cross-module analytics dashboard
  ANALYTICS: {
    SUMMARY: '/admin/analytics/summary/',
    REVENUE: '/admin/analytics/revenue/',
    RESERVATIONS: '/admin/analytics/reservations/',
    LOYALTY: '/admin/analytics/loyalty/',
    PROMOTIONS: '/admin/analytics/promotions/',
    VENDORS: '/admin/analytics/vendors/',
    MENU: '/admin/analytics/menu/',
  },
  // Staff Management (P7.2)
  STAFF: {
    LIST: (tenantId: string) => `/tenants/${tenantId}/staff/`,
    DETAIL: (id: string) => `/staff/${id}/`,
    INVITE: (tenantId: string) => `/tenants/${tenantId}/staff/invite/`,
    UPDATE_ROLES: (id: string) => `/staff/${id}/roles/`,
    ACTIVATE: (id: string) => `/staff/${id}/activate/`,
    SUSPEND: (id: string) => `/staff/${id}/suspend/`,
    REMOVE: (id: string) => `/staff/${id}/remove/`,
    INVITES: (tenantId: string) => `/tenants/${tenantId}/invites/`,
    CANCEL_INVITE: (id: string) => `/invites/${id}/cancel/`,
    RESEND_INVITE: (id: string) => `/invites/${id}/resend/`,
    ACCEPT_INVITE: (id: string) => `/invites/${id}/accept/`,
    TRANSFER_OWNERSHIP: (tenantId: string) => `/tenants/${tenantId}/transfer-ownership/`,
  },
} as const
