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
    CHANGE_PASSWORD: '/auth/change-password/',
  },

  // Menu
  MENU: {
    CATEGORIES: '/menu/categories/',
    CATEGORY: (id: string) => `/menu/categories/${id}/`,
    ITEMS: '/menu/items/',
    ITEM: (id: string) => `/menu/items/${id}/`,
    ITEM_BY_SLUG: (slug: string) => `/menu/items/${slug}/`,
    FEATURED: '/menu/items/featured/',
    POPULAR: '/menu/items/popular/',
    SEARCH: '/menu/items/search/',
    RELATED: (id: string) => `/menu/items/${id}/related/`,
  },

  // Orders
  ORDERS: {
    LIST: '/orders/',
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
    UPDATE_PROFILE: '/users/profile/',
    AVATAR_UPLOAD: '/users/avatar/',
    ADDRESSES: '/users/addresses/',
    ADDRESS: (id: string) => `/users/addresses/${id}/`,
    FAVORITES: '/users/favorites/',
    TOGGLE_FAVORITE: (itemId: string) => `/users/favorites/${itemId}/`,
  },

  // Tenants (Phase 1A — P1A.1)
  TENANTS: {
    DETAIL: (slug: string) => `/tenants/${slug}/`,
    CURRENT: '/tenants/current/',
  },

  // Reviews
  REVIEWS: {
    CREATE: '/reviews/',
    LIST: '/reviews/',
    ITEM_REVIEWS: (itemId: string) => `/menu/items/${itemId}/reviews/`,
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
    CUSTOMER_STATS: (id: string) => `/admin/customers/${id}/stats/`,
  },
} as const
