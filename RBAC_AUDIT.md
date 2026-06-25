# RBAC Audit — P8.4.8

> Generated: 2026-06-25  
> Scope: Enterprise role-permission matrix, sidebar navigation, route protection, action gating.

---

## 1. Permission Inventory (31 total)

| Permission | Type | Description |
|---|---|---|
| `orders.view` | Navigation + Action | View orders list and detail |
| `orders.manage` | Action | Create, update, cancel orders |
| `menu.view` | Navigation + Action | View menu items and categories |
| `menu.manage` | Action | Create, edit, delete menu items |
| `reservations.view` | Navigation + Action | View reservations |
| `reservations.manage` | Action | Create, update, cancel reservations |
| `customers.view` | Navigation + Action | View customer profiles and history |
| `customers.manage` | Action | Edit customer data |
| `vendors.view` | Navigation + Action | View vendor list |
| `vendors.manage` | Action | Add, edit vendors |
| `promotions.view` | Navigation + Action | View promotions and discount codes |
| `promotions.manage` | Action | Create, edit, delete promotions |
| `loyalty.view` | Navigation + Action | View loyalty programme |
| `loyalty.manage` | Action | Configure loyalty rules |
| `analytics.view` | Navigation | View analytics dashboards |
| `staff.view` | Navigation + Action | View staff list |
| `staff.manage` | Action | Invite, suspend, remove staff |
| `branches.view` | Navigation + Action | View branch list and analytics |
| `branches.manage` | Action | Create, configure branches |
| `settings.view` | Navigation | View system settings |
| `settings.manage` | Action | Modify system settings |
| `tenant.view` | Navigation | View tenant details |
| `tenant.manage` | Action | Modify tenant ownership (owner-only) |
| `audit.view` | Navigation | View audit logs |
| `audit.export` | Action | Export audit logs |
| `audit.manage` | Action | Manage audit configuration |
| `notifications.view` | Navigation + Action | View notifications |
| `notifications.manage` | Action | Manage notification templates |
| `notifications.preferences` | Action | Set personal notification preferences |
| `operations.view` | Navigation + Action | View operations/kitchen display |
| `operations.manage` | Action | Modify operational settings |

---

## 2. Role → Permission Matrix (P8.4.8)

| Permission | owner | admin | manager | cashier | waiter | kitchen | marketing | support |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| orders.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| orders.manage | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| menu.view | ✓ | ✓ | ✓ | | ✓ | | | |
| menu.manage | ✓ | ✓ | ✓ | | | | | |
| reservations.view | ✓ | ✓ | ✓ | | ✓ | | | ✓ |
| reservations.manage | ✓ | ✓ | ✓ | | ✓ | | | |
| customers.view | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ |
| customers.manage | ✓ | ✓ | ✓ | | | | | |
| vendors.view | ✓ | ✓ | | | | | | |
| vendors.manage | ✓ | ✓ | | | | | | |
| promotions.view | ✓ | ✓ | | | | | ✓ | |
| promotions.manage | ✓ | ✓ | | | | | ✓ | |
| loyalty.view | ✓ | ✓ | | | | | ✓ | |
| loyalty.manage | ✓ | ✓ | | | | | ✓ | |
| analytics.view | ✓ | ✓ | | | | | ✓ | |
| staff.view | ✓ | ✓ | ✓ | | | | | |
| staff.manage | ✓ | ✓ | ✓ | | | | | |
| branches.view | ✓ | ✓ | ✓ | | | | | ✓ |
| branches.manage | ✓ | ✓ | | | | | | |
| settings.view | ✓ | ✓ | | | | | | |
| settings.manage | ✓ | ✓ | | | | | | |
| tenant.view | ✓ | ✓ | | | | | | |
| tenant.manage | ✓ | | | | | | | |
| audit.view | ✓ | ✓ | | | | | | |
| audit.export | ✓ | ✓ | | | | | | |
| audit.manage | ✓ | ✓ | | | | | | |
| notifications.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| notifications.manage | ✓ | ✓ | | | | | | |
| notifications.preferences | ✓ | ✓ | | | | | | |
| operations.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| operations.manage | ✓ | ✓ | | | | | | |
| **Total** | **31** | **30** | **13** | **5** | **9** | **3** | **7** | **4** |

---

## 3. Sidebar Navigation Items by Role

### owner / admin (identical sidebar)
Orders, Menu, Customers, Reservations, Analytics, Audit Logs, Vendors, Promotions, Loyalty, Staff, Branches, Branch Analytics, Kitchen Display, Notifications, Operations, Settings, Tenants (owner only for tenant.manage actions)

### manager (13 permissions)
Orders, Menu, Customers, Reservations, Staff, Branches, Kitchen Display, Notifications, Operations

### cashier (5 permissions)
Orders, Customers, Kitchen Display, Notifications, Operations

### waiter (9 permissions — unchanged)
Orders, Menu, Customers, Reservations, Kitchen Display, Notifications, Operations

### kitchen (3 permissions)
Orders (view only), Kitchen Display, Notifications

### marketing (7 permissions)
Analytics, Customers, Promotions, Loyalty, Notifications

### support (4 permissions)
Customers, Reservations, Branches, Notifications

---

## 4. Route Protection Matrix

All admin routes are triple-gated:
1. **Middleware** — JWT token presence check (redirects to `/login`)
2. **AuthGuard** — `dashboard:access` legacy permission (redirects to `/`)
3. **PermissionGuard** — P7 permission (renders `<AccessDenied />`)

| Route | Required Permission | Notes |
|---|---|---|
| /admin/orders | orders.view | |
| /admin/orders/[id] | orders.view | |
| /admin/menu | menu.view | |
| /admin/customers | customers.view | |
| /admin/customers/[id] | customers.view | |
| /admin/reservations | reservations.view | |
| /admin/analytics | analytics.view | |
| /admin/audit-logs | audit.view | |
| /admin/staff | staff.view | |
| /admin/loyalty | loyalty.view | |
| /admin/notifications | notifications.view | |
| /admin/settings | settings.view | |
| /admin/tenants | tenant.view | |
| /admin/vendors/[id] | vendors.view | |
| /admin/operations | operations.view | |
| /admin/kitchen | operations.view | |
| /admin/branches | branches.view | |
| /admin/branches/analytics | analytics.view | |
| /admin/promotions | promotions.view | |

---

## 5. Change Log (P8.4.8 vs P8.4.6)

| Role | Before | After | Removed |
|---|---|---|---|
| manager | 24 | 13 | vendors.view/manage, promotions.view/manage, loyalty.view/manage, analytics.view, settings.view, audit.view, notifications.preferences, operations.manage |
| cashier | 8 | 5 | menu.view, reservations.view, notifications.preferences |
| kitchen | 6 | 3 | orders.manage, menu.view, notifications.preferences |
| marketing | 10 | 7 | menu.view, operations.view, notifications.preferences |
| support | 12 | 4 | orders.view, menu.view, vendors.view, analytics.view, settings.view, audit.view, notifications.preferences, operations.view |
| owner | 31 | 31 | — |
| admin | 30 | 30 | — |
| waiter | 9 | 9 | — |
