# Authentication

POST   /auth/login/
POST   /auth/register/
POST   /auth/logout/
POST   /auth/token/refresh/
GET    /auth/me/
POST   /auth/forgot-password/
POST   /auth/reset-password/
POST   /auth/send-otp/
POST   /auth/verify-otp/
POST   /auth/change-password/

# Tenants

GET    /tenants/
GET    /tenants/current/
GET    /tenants/:slug/
POST   /tenants/provision/
POST   /tenants/clone/
POST   /tenants/:slugOrId/activate/
POST   /tenants/:slugOrId/suspend/
POST   /tenants/:slugOrId/archive/
PATCH  /tenants/:slug/settings/
POST   /tenants/:tenantId/transfer-ownership/

# Branches

GET    /branches/
GET    /branches/:id/
POST   /branches/
PATCH  /branches/:id/
POST   /branches/:id/activate/
POST   /branches/:id/deactivate/
POST   /branches/:id/maintenance/
PATCH  /branches/:id/manager/
GET    /branches/:id/metrics/

# Users

PATCH  /users/profile/
POST   /users/avatar/
GET    /users/addresses/
POST   /users/addresses/
DELETE /users/addresses/:id/
GET    /users/favorites/
POST   /users/favorites/:itemId/

# Staff

GET    /tenants/:tenantId/staff/
GET    /staff/:id/
POST   /tenants/:tenantId/staff/invite/
PATCH  /staff/:id/roles/
POST   /staff/:id/activate/
POST   /staff/:id/suspend/
POST   /staff/:id/remove/
GET    /tenants/:tenantId/invites/
POST   /invites/:id/cancel/
POST   /invites/:id/resend/
POST   /invites/:id/accept/

# Menus

GET    /menu/categories/
GET    /menu/items/
POST   /menu/items/
GET    /menu/items/:id/
PATCH  /menu/items/:id/
DELETE /menu/items/:id/
GET    /menu/items/featured/
GET    /menu/items/popular/
GET    /menu/items/search/
GET    /menu/items/:id/related/

# Tables

GET    /tables/:tableId/

# Reservations

GET    /reservations/
POST   /reservations/
GET    /reservations/:id/
POST   /reservations/:id/cancel/
POST   /reservations/:id/confirm/
GET    /reservations/available-slots/

# Orders

GET    /orders/
POST   /orders/
GET    /orders/:id/
POST   /orders/:id/cancel/
PATCH  /orders/:id/status/
POST   /orders/validate-discount/

# Payments

POST   /payments/create-intent/
POST   /payments/confirm/

# Customers

GET    /admin/customers/
GET    /admin/customers/:id/
GET    /admin/customers/:id/stats/
GET    /console/customers/:customerId/reviews/
GET    /admin/business-customers/
GET    /admin/business-customers/:userId/branches/
GET    /admin/customers/:userId/timeline/
GET    /admin/customers/:userId/notes/
POST   /admin/customers/:userId/notes/
PATCH  /admin/notes/:noteId/
DELETE /admin/notes/:noteId/
GET    /admin/customers/:userId/tags/
GET    /admin/tenants/:tenantId/tags/
PATCH  /admin/customers/:userId/tags/
GET    /admin/customers/:userId/analytics/
GET    /admin/customers/:userId/marketing/
GET    /admin/customers/:userId/coupons/
GET    /admin/customers/:userId/payments/
GET    /admin/customers/:userId/orders/
GET    /admin/customers/:userId/reservations/

# Loyalty

GET    /loyalty/account/
GET    /loyalty/transactions/
GET    /loyalty/rewards/
POST   /loyalty/rewards/:rewardId/redeem/
POST   /loyalty/earn/
GET    /admin/loyalty/rewards/
POST   /admin/loyalty/rewards/
PATCH  /admin/loyalty/rewards/:id/

# Vendors

GET    /vendors/
GET    /vendors/:id/
GET    /vendors/:id/stats/
GET    /vendors/:id/settlements/
GET    /admin/vendors/
POST   /admin/vendors/
PATCH  /admin/vendors/:id/
GET    /admin/settlements/
POST   /admin/settlements/

# Promotions

GET    /promotions/
POST   /promotions/
GET    /promotions/active/
PATCH  /promotions/:id/

# Reviews

POST   /reviews/
GET    /menu/items/:itemId/reviews/
GET    /tenants/:tenantId/reviews/
POST   /tenants/:tenantId/reviews/
GET    /tenants/:tenantId/reviews/rating/
GET    /tenants/:tenantId/branches/:branchId/reviews/rating/
GET    /tenants/:tenantId/reviews/:reviewId/
POST   /tenants/:tenantId/reviews/:reviewId/reply/
PATCH  /tenants/:tenantId/reviews/:reviewId/reply/
DELETE /tenants/:tenantId/reviews/:reviewId/reply/
POST   /tenants/:tenantId/reviews/:reviewId/helpful/
PATCH  /tenants/:tenantId/reviews/:reviewId/moderate/
GET    /tenants/:tenantId/reviews/analytics/

# Notifications

GET    /notifications/
POST   /notifications/
GET    /notifications/:id/
DELETE /notifications/:id/
POST   /notifications/:id/read/
POST   /notifications/:id/archive/
POST   /notifications/read-all/
POST   /notifications/register-device/
GET    /notifications/rich/
GET    /notifications/statistics/
GET    /notifications/unread-count/
GET    /notifications/summary/
GET    /notifications/preferences/
POST   /notifications/preferences/
PATCH  /notifications/preferences/:category/
POST   /notifications/preferences/reset/

# Audit Logs

GET    /audit-logs/
POST   /audit-logs/
GET    /audit-logs/:id/
GET    /audit-logs/timeline/
POST   /audit-logs/export/
GET    /audit-logs/statistics/

# Analytics

GET    /admin/analytics/summary/
GET    /admin/analytics/revenue/
GET    /admin/analytics/reservations/
GET    /admin/analytics/loyalty/
GET    /admin/analytics/promotions/
GET    /admin/analytics/vendors/
GET    /admin/analytics/menu/

# Dashboard

GET    /admin/stats/

# Website Builder

GET    /tenants/:tenantSlug/website/layout/
PUT    /tenants/:tenantSlug/website/layout/
POST   /tenants/:tenantSlug/website/publish/
POST   /tenants/:tenantSlug/website/versions/:versionId/restore/
GET    /tenants/:tenantSlug/branches/:branchSlug/website/overrides/
PUT    /tenants/:tenantSlug/branches/:branchSlug/website/overrides/

# Realtime

GET    /operations/snapshot/
GET    /operations/branches/status/
GET    /operations/branches/:branchId/status/
GET    /operations/branches/:branchId/kitchen/
GET    /operations/orders/live/
GET    /operations/reservations/live/
GET    /operations/staff/presence/
GET    /operations/sla-alerts/
GET    /operations/statistics/
POST   /operations/events/

# WebSocket

WS     /orders/:orderId/
WS     /notifications/
