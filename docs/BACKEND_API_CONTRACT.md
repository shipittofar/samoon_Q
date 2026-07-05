# Backend API Contract — Savor Restaurant SaaS

> **Single source of truth for backend development.**
> Generated from frontend source code. All types, endpoints, and business rules are
> derived from `src/types/index.ts`, `src/services/`, `src/hooks/`, and runtime service usage.
>
> Last updated: 2026-07-04 (P9.0: added §36 Platform Configuration API contract)

---

## Table of Contents

1. [Base Configuration](#1-base-configuration)
2. [Authentication](#2-authentication-endpoints)
3. [Menu](#3-menu-endpoints)
4. [Orders](#4-order-endpoints)
5. [Reservations](#5-reservation-endpoints)
6. [Payments](#6-payment-endpoints)
7. [Branches / Locations](#7-branch--location-endpoints)
8. [Users / Profile](#8-user--profile-endpoints)
9. [Notifications](#9-notification-endpoints)
10. [Tenants](#10-tenant-endpoints)
11. [Reviews](#11-review-endpoints)
12. [Tables](#12-table-endpoints)
13. [Admin — Dashboard & Stats](#13-admin-endpoints)
14. [Analytics](#14-analytics-endpoints) *(added P7.13)*
15. [Bulk Operations](#15-bulk-operation-endpoints) *(added P7.14)*
16. [Staff Management](#16-staff-management-endpoints) *(added P7.2)*
17. [Audit Logs](#17-audit-log-endpoints) *(added P7.5)*
18. [Kitchen Display](#18-kitchen-display-endpoints) *(added P7.13)*
19. [Loyalty & Promotions](#19-loyalty--promotion-endpoints) *(added P6)*
20. [Vendors](#20-vendor-endpoints) *(added P6)*
21. [Feature Flags](#21-feature-flag-endpoints) *(added P1B)*
22. [WebSocket Channels](#22-websocket-channels)
23. [Pagination Contract](#23-pagination-contract)
24. [Error Response Contract](#24-error-response-contract)
25. [Security & Headers](#25-security--headers)
26. [Business Rules](#26-business-rules)
19. [RBAC Permission Matrix](#19-rbac-permission-matrix)
20. [Environment Variables](#20-environment-variables)
21. [Endpoint Classification Summary](#21-endpoint-classification-summary)
36. [Platform Configuration API](#36-platform-configuration-api-p90) *(added P9.0 — contract only, no backend yet)*

---

## 1. Base Configuration

```
REST Base URL : process.env.NEXT_PUBLIC_API_BASE_URL  (default: http://localhost:8000/api)
WebSocket URL : process.env.NEXT_PUBLIC_WS_BASE_URL   (default: ws://localhost:8000/ws)
```

**Source:** `src/lib/env.ts`, `src/services/axios.instance.ts`

### Token Lifecycle

| Token | Storage | Lifetime | Notes |
|-------|---------|---------|-------|
| `access` | `localStorage["access_token"]` + cookie (not HttpOnly, SameSite=Strict) | Short-lived | Sent as `Authorization: Bearer {token}` |
| `refresh` | `localStorage["refresh_token"]` | Long-lived | Used only in `POST /auth/token/refresh/` |

The axios interceptor automatically calls `POST /auth/token/refresh/` on any 401 response, swaps the tokens, and retries the original request once. If refresh also fails, the user is logged out.

---

## 2. Authentication Endpoints

> **P8.9.3 Contract** — Phone-first auth with backward-compatible legacy endpoints.
> All new endpoints are under `/auth/phone/` prefix to avoid breaking changes.

---

### 2.0 Design Principles

1. **Phone-first, email-optional** — phone-only accounts are fully supported; `email` is nullable
2. **Challenge-bound OTPs** — OTPs are tied to a `challenge_id`, not just a phone number
3. **Refresh token rotation** — every refresh issues a new token pair; stolen tokens are detected via family revocation
4. **Device sessions** — each login is tracked per device; users can view and revoke sessions
5. **`next_step` extension point** — the verify response carries a `next_step` field for future MFA without a new endpoint
6. **Superset responses** — all new fields are additive; old clients ignoring new fields remain functional

---

### 2.A Shared Schemas

#### AuthResponse
```json
{
  "user": { "...": "see User object below" },
  "tokens": {
    "access": "eyJ...",
    "refresh": "eyJ..."
  },
  "p7_roles": ["owner", "admin"],
  "device_id": "dev_uuid",
  "is_new_user": false
}
```

#### User Object (updated — email nullable)
```json
{
  "id": "u1",
  "email": "user@example.com",
  "phone": "+14155550101",
  "first_name": "Alice",
  "last_name": "Johnson",
  "avatar": null,
  "role": "customer",
  "is_verified": true,
  "phone_verified_at": "2024-01-15T00:00:00Z",
  "email_verified_at": null,
  "created_at": "2024-01-15T00:00:00Z"
}
```

> `email` is `null` for phone-only accounts. `phone` is `null` for email-only accounts.
> At least one of `email` or `phone` must be non-null.

#### JWT Payload (updated)
```json
{
  "sub": "user_id",
  "exp": 1234567890,
  "iat": 1234567890,
  "jti": "uuid-v4",
  "phone": "+14155550101",
  "email": null,
  "role": "customer",
  "tenant": "savor",
  "device": "device_uuid"
}
```

#### Error Response
```json
{
  "code": "OTP_INVALID",
  "message": "The code you entered is incorrect.",
  "retry_after": null,
  "attempts_remaining": 4,
  "recovery": null
}
```

---

### 2.1 POST /auth/phone/start

Initiate phone authentication. Sends an OTP and returns a `challenge_id`.

**Authentication:** Public

**Request Body:**
```json
{ "phone": "+14155550101" }
```

**Success Response `200`:**
```json
{
  "challenge_id": "chal_uuid",
  "expires_at": "2024-01-15T00:10:00Z",
  "resend_after": "2024-01-15T00:01:00Z"
}
```

**Error Responses:**
| Status | Code | Meaning |
|---|---|---|
| 400 | `PHONE_INVALID` | Not a valid E.164 phone number |
| 429 | `RATE_LIMITED` | Too many OTP requests; `retry_after` set |

---

### 2.2 POST /auth/phone/verify

Verify the OTP code. Returns full auth response or profile completion token for new users.

**Authentication:** Public

**Request Body:**
```json
{
  "challenge_id": "chal_uuid",
  "phone": "+14155550101",
  "otp": "123456"
}
```

**Success Response `200` — existing user:**
```json
{
  "next_step": "complete",
  "user": { "...": "User object" },
  "tokens": { "access": "eyJ...", "refresh": "eyJ..." },
  "p7_roles": ["owner"],
  "device_id": "dev_uuid",
  "is_new_user": false
}
```

**Success Response `200` — new user:**
```json
{
  "next_step": "complete_profile",
  "profile_token": "tmp_token_used_once",
  "is_new_user": true
}
```

> `profile_token` is a short-lived (15 min) single-use token for `POST /auth/complete-profile`.
> `next_step` is the extension point for future MFA steps.

**Error Responses:**
| Status | Code | Meaning |
|---|---|---|
| 400 | `OTP_INVALID` | Wrong code; `attempts_remaining` returned |
| 400 | `OTP_EXPIRED` | Challenge expired; start a new one |
| 400 | `CHALLENGE_NOT_FOUND` | Unknown `challenge_id` |
| 429 | `TOO_MANY_ATTEMPTS` | Max attempts exceeded |

---

### 2.3 POST /auth/phone/resend

Request a new OTP for an existing challenge (respects cooldown).

**Authentication:** Public

**Request Body:**
```json
{ "challenge_id": "chal_uuid", "phone": "+14155550101" }
```

**Success Response `200`:**
```json
{
  "challenge_id": "chal_uuid_new",
  "expires_at": "2024-01-15T00:10:00Z",
  "resend_after": "2024-01-15T00:01:00Z"
}
```

> A new `challenge_id` is issued; the old one is invalidated.

**Error Responses:**
| Status | Code | Meaning |
|---|---|---|
| 429 | `RESEND_TOO_SOON` | Cooldown not elapsed; `retry_after` set |
| 429 | `RATE_LIMITED` | Daily resend cap hit |

---

### 2.4 POST /auth/complete-profile

Complete registration for new phone users. Requires `profile_token` from verify step.

**Authentication:** `profile_token` in `Authorization: Bearer` header

**Request Body:**
```json
{
  "first_name": "Alice",
  "last_name": "Johnson"
}
```

**Success Response `201`:** Full `AuthResponse` (same as existing user verify).

**Error Responses:**
| Status | Code | Meaning |
|---|---|---|
| 401 | `PROFILE_TOKEN_INVALID` | Token invalid or expired |
| 400 | `VALIDATION_ERROR` | Required fields missing |

---

### 2.5 POST /auth/logout

Invalidate the current session's access token (add `jti` to blocklist) and refresh token.

**Authentication:** Customer / Staff / Admin

**Request Body:** Empty  
**Success Response:** `200 OK` (empty body)

---

### 2.6 POST /auth/logout-all

Revoke all sessions for the account. Increments `token_revoke_version`; all existing JWTs become invalid.

**Authentication:** Customer / Staff / Admin

**Request Body:**
```json
{ "except_current": true }
```

**Success Response `200`:**
```json
{ "sessions_revoked": 3 }
```

---

### 2.7 GET /auth/session

Returns metadata about the current session. Used for session health checks.

**Authentication:** Customer / Staff / Admin

**Success Response `200`:**
```json
{
  "user_id": "u1",
  "device_id": "dev_uuid",
  "issued_at": "2024-01-15T00:00:00Z",
  "expires_at": "2024-01-15T00:15:00Z",
  "is_valid": true
}
```

---

### 2.8 GET /auth/devices

List all active sessions (devices) for the current user.

**Authentication:** Customer / Staff / Admin

**Success Response `200`:**
```json
[
  {
    "device_id": "dev_uuid",
    "user_agent": "Mozilla/5.0 ...",
    "ip_address": "203.0.113.1",
    "last_active_at": "2024-01-15T00:00:00Z",
    "created_at": "2024-01-14T09:00:00Z",
    "is_current": true
  }
]
```

---

### 2.9 DELETE /auth/devices/{device_id}

Revoke a specific device session (remote logout).

**Authentication:** Customer / Staff / Admin

**Success Response `200`:**
```json
{ "revoked": true }
```

**Error Responses:**
| Status | Code | Meaning |
|---|---|---|
| 404 | `DEVICE_NOT_FOUND` | Device does not belong to user |

---

### 2.10 GET /auth/me

Returns the authenticated user object.

**Authentication:** Customer / Staff / Admin

**Success Response `200`:** `User` object (updated schema with nullable email, `phone_verified_at`, `email_verified_at`).

---

### 2.11 POST /auth/token/refresh

Silent token refresh with rotation. Implements token family revocation.

**Authentication:** Public (refresh token in body)

**Request Body:**
```json
{ "refresh": "eyJ..." }
```

**Success Response `200`:**
```json
{ "access": "eyJ...", "refresh": "eyJ..." }
```

> **Rotation algorithm:**
> 1. Validate refresh token signature and `exp`
> 2. Look up `RefreshSession` by `jti`
> 3. If `used_at IS NOT NULL` → family was stolen; revoke all tokens in family → return `403 FAMILY_REVOKED`
> 4. Mark current token `used_at = now()`
> 5. Issue new access token (15 min) + new refresh token (30 days) in same family
> 6. Return new pair

**Error Responses:**
| Status | Code | Meaning |
|---|---|---|
| 401 | `REFRESH_INVALID` | Token not found or signature invalid |
| 401 | `REFRESH_EXPIRED` | Refresh token past expiry |
| 403 | `FAMILY_REVOKED` | Reuse detected; all sessions killed |

---

### 2.12 POST /auth/change-phone

Initiate a phone number change. Sends OTP to the new number.

**Authentication:** Customer / Staff / Admin

**Request Body:**
```json
{ "new_phone": "+14155550199" }
```

**Success Response `200`:**
```json
{ "challenge_id": "chal_uuid", "expires_at": "2024-01-15T00:10:00Z" }
```

---

### 2.13 POST /auth/verify-phone-change

Confirm the new phone number with the OTP.

**Authentication:** Customer / Staff / Admin

**Request Body:**
```json
{ "challenge_id": "chal_uuid", "otp": "123456" }
```

**Success Response `200`:**
```json
{ "phone": "+14155550199", "phone_verified_at": "2024-01-15T00:05:00Z" }
```

---

### 2.14 POST /auth/delete-account

Soft-delete the account. 30-day recovery window before permanent deletion.

**Authentication:** Customer / Staff / Admin

**Request Body:**
```json
{ "confirmation": "DELETE" }
```

**Success Response `200`:**
```json
{ "scheduled_deletion_at": "2024-02-14T00:00:00Z" }
```

---

### 2.15 POST /auth/login (legacy — preserved)

**Method:** `POST`  
**Path:** `/auth/login/`  
**Authentication:** Public  
**Tenant Aware:** Yes (X-Tenant-Slug header)

**Request Body:**
```json
{ "email": "user@example.com", "password": "secret123" }
```

**Success Response `200`:**
```json
{
  "user": { "...": "User object" },
  "tokens": { "access": "eyJ...", "refresh": "eyJ..." },
  "p7_roles": ["owner"]
}
```

> `p7_roles` added to legacy response for frontend compatibility (P8.9.3).

---

### 2.16 POST /auth/register (legacy — preserved)

**Method:** `POST`  
**Path:** `/auth/register/`  
**Authentication:** Public

**Request Body:**
```json
{
  "email": "new@example.com",
  "phone": "+1234567890",
  "password": "Secret123!",
  "confirm_password": "Secret123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Success Response `201`:** Full `AuthResponse`.

---

### 2.17 POST /auth/send-otp (legacy — preserved)

**Path:** `/auth/send-otp/`  
**Request Body:** `{ "phone": "+1234567890" }`  
**Success Response `200`:** `{ "message": "OTP sent" }`

> Deprecated in favour of `/auth/phone/start`. Preserved for clients that haven't migrated.

---

### 2.18 POST /auth/verify-otp (legacy — preserved)

**Path:** `/auth/verify-otp/`  
**Request Body:** `{ "phone": "+1234567890", "otp": "123456" }`  
**Success Response `200`:** `AuthResponse` (with `p7_roles`, `is_new_user`).

> Deprecated in favour of `/auth/phone/verify`. Preserved for clients that haven't migrated.

---

### 2.19 POST /auth/forgot-password, 2.20 POST /auth/reset-password, 2.21 POST /auth/change-password (legacy — preserved)

Unchanged from original contract. See original sections 2.6–2.10.

---

### 2.D OTP Architecture

| Property | Value |
|---|---|
| Length | 6 digits |
| Expiry | 10 minutes |
| Max attempts per challenge | 5 |
| Cooldown between resends | 60 seconds |
| Daily resend cap per phone | 10 |
| Storage | HMAC-SHA256 of OTP, never plaintext |
| Binding | `challenge_id` + phone (not phone alone) |

**PhoneChallenge SQL schema:**
```sql
CREATE TABLE phone_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(20) NOT NULL,
  otp_hash    VARCHAR(64) NOT NULL,
  attempts    SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 5,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  INDEX (phone, created_at),
  INDEX (expires_at)
);
```

---

### 2.E Session Architecture

| Token | Lifetime | Storage |
|---|---|---|
| Access token | 15 minutes | Non-HttpOnly cookie + localStorage |
| Refresh token | 30 days | localStorage (current) |

**RefreshSession SQL schema:**
```sql
CREATE TABLE refresh_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   UUID NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
  family_id   UUID NOT NULL,
  jti         UUID NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  INDEX (user_id),
  INDEX (family_id),
  INDEX (jti)
);
```

**Revocation strategy:**
- Single token: add `jti` to blocklist (Redis TTL = access token lifetime)
- All sessions: increment `users.token_revoke_version`; JWTs with lower version are rejected
- Family reuse: `UPDATE refresh_sessions SET used_at = now() WHERE family_id = ? AND used_at IS NULL`

---

### 2.F Phone Normalization

All phone numbers MUST be stored and compared in E.164 format (`+{country_code}{number}`).

| Input | Normalized |
|---|---|
| `(415) 555-0101` | `+14155550101` |
| `415-555-0101` | `+14155550101` |
| `+1 415 555 0101` | `+14155550101` |
| `00441234567890` | `+441234567890` |

Backend MUST use `libphonenumber` (or `google-libphonenumber` for Node) for normalization and validation before storing or comparing.

Duplicate detection: if a normalized phone already exists when creating a new account, return the existing account's auth flow (no enumeration).

---

### 2.G Security Controls

| Threat | Control |
|---|---|
| OTP brute force | 5 attempts per challenge; exponential backoff 1s→2s→4s→8s→16s |
| SMS flooding | 60s resend cooldown, 10/day cap per phone, 20/day cap per IP |
| Phone enumeration | `send-otp` always returns `200` regardless of whether phone is registered |
| Token theft | Refresh family revocation kills all sessions on reuse detection |
| Replay | `challenge_id` single-use; `jti` blocklist for access tokens |
| Account takeover | `logout-all` with `token_revoke_version` increment |
| Concurrent OTPs | New `challenge_id` per send; old challenge invalidated on new send |

---

### 2.H Error Code Reference

| Code | HTTP | Meaning |
|---|---|---|
| `PHONE_INVALID` | 400 | Not a valid E.164 number |
| `OTP_INVALID` | 400 | Wrong code |
| `OTP_EXPIRED` | 400 | Challenge expired |
| `CHALLENGE_NOT_FOUND` | 400 | Unknown `challenge_id` |
| `TOO_MANY_ATTEMPTS` | 429 | Max OTP attempts exceeded |
| `RESEND_TOO_SOON` | 429 | Within cooldown window |
| `RATE_LIMITED` | 429 | IP or phone rate limit hit |
| `PROFILE_TOKEN_INVALID` | 401 | `profile_token` invalid or expired |
| `REFRESH_INVALID` | 401 | Refresh token not found |
| `REFRESH_EXPIRED` | 401 | Refresh token past `exp` |
| `FAMILY_REVOKED` | 403 | Token reuse detected; all sessions revoked |
| `DEVICE_NOT_FOUND` | 404 | Device not in user's session list |
| `INVALID_CREDENTIALS` | 400 | Email/password mismatch (legacy) |
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |

---

### 2.I Backend Data Model

**Migrations required (additive only — no breaking changes):**

```sql
-- Extend users table
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_revoke_version INTEGER NOT NULL DEFAULT 0;

-- Device sessions
CREATE TABLE IF NOT EXISTS user_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent    TEXT,
  ip_address    INET,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  INDEX (user_id)
);
```

---

### 2.J Versioning

- URL-based versioning: `/api/v1/` (current) vs `/api/v2/` (future)
- All new endpoints are **additive** — existing clients ignoring new fields continue to work
- Legacy endpoints (`/auth/login/`, `/auth/send-otp/`, `/auth/verify-otp/`) remain functional indefinitely
- `next_step` in verify response is the extension point for future MFA without new endpoints


## 3. Menu Endpoints

### 3.1 List Categories

**Method:** `GET`  
**Path:** `/menu/categories/`  
**Authentication:** Public  
**Tenant Aware:** Yes

**Success Response `200`:**
```json
[
  {
    "id": "cat1",
    "name": "Burgers",
    "slug": "burgers",
    "description": "Premium handcrafted burgers",
    "image": "https://cdn.example.com/cat-burgers.jpg",
    "icon": "burger",
    "order": 1,
    "items_count": 12
  }
]
```

**Frontend Type:** `Category[]` — `src/types/index.ts:47`

---

### 3.2 Get Category

**Method:** `GET`  
**Path:** `/menu/categories/{id}/`  
**Authentication:** Public

**Success Response `200`:** Single `Category` object.

---

### 3.3 List Menu Items

**Method:** `GET`  
**Path:** `/menu/items/`  
**Authentication:** Public

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `category` | `string` | Filter by category ID |
| `search` | `string` | Full-text search on name/description |
| `min_price` | `number` | Minimum price filter |
| `max_price` | `number` | Maximum price filter |
| `min_rating` | `number` | Minimum rating filter |
| `available` | `boolean` | Filter by availability |
| `sort` | `string` | Sort field (e.g. `price`, `-rating`, `name`) |
| `page` | `number` | Page number (default: 1) |
| `page_size` | `number` | Items per page (default: 20) |

**Success Response `200`:** `PaginatedResponse<MenuItem>`

```json
{
  "count": 48,
  "next": "/menu/items/?page=2",
  "previous": null,
  "results": [
    {
      "id": "1",
      "category_id": "cat1",
      "category": { "id": "cat1", "name": "Burgers", "slug": "burgers", "order": 1 },
      "name": "Wagyu Smash Burger",
      "slug": "wagyu-smash-burger",
      "description": "Premium wagyu beef patty...",
      "price": 24.99,
      "discount": 10,
      "discounted_price": 22.49,
      "image": "https://cdn.example.com/burger1.jpg",
      "images": ["https://cdn.example.com/burger1-2.jpg"],
      "calories": 850,
      "preparation_time": 15,
      "rating": 4.8,
      "rating_count": 284,
      "available": true,
      "is_featured": true,
      "is_new": false,
      "is_popular": true,
      "tags": ["bestseller", "spicy"],
      "extras": [{ "id": "e1", "name": "Extra Patty", "price": 4.99, "available": true }],
      "allergens": ["gluten", "dairy"],
      "nutritional_info": { "calories": 850, "protein": 42, "carbs": 48, "fat": 38, "fiber": 3 }
    }
  ]
}
```

**Frontend Type:** `MenuItem` — `src/types/index.ts:65`  
**Filter type:** `MenuFilters` — `src/services/menu.service.ts`

---

### 3.4 Get Menu Item

**Method:** `GET`  
**Path:** `/menu/items/{id}/`  
**Authentication:** Public

**Success Response `200`:** Single `MenuItem` object.

---

### 3.5 Get Menu Item by Slug

**Method:** `GET`  
**Path:** `/menu/items/{slug}/`  
**Authentication:** Public

**Success Response `200`:** Single `MenuItem` object.

---

### 3.6 Featured Items

**Method:** `GET`  
**Path:** `/menu/items/featured/`  
**Authentication:** Public

**Success Response `200`:** `MenuItem[]` (not paginated — returns all featured items)

---

### 3.7 Popular Items

**Method:** `GET`  
**Path:** `/menu/items/popular/`  
**Authentication:** Public

**Success Response `200`:** `MenuItem[]`

---

### 3.8 Search Items

**Method:** `GET`  
**Path:** `/menu/items/search/`  
**Authentication:** Public

**Query Parameters:** `q: string` (required)

**Success Response `200`:** `MenuItem[]`

---

### 3.9 Related Items

**Method:** `GET`  
**Path:** `/menu/items/{id}/related/`  
**Authentication:** Public

**Success Response `200`:** `MenuItem[]`

---

### 3.10 Item Reviews

**Method:** `GET`  
**Path:** `/menu/items/{itemId}/reviews/`  
**Authentication:** Public

**Success Response `200`:**
```json
{
  "results": [
    {
      "id": "rev1",
      "user": { "id": "u1", "first_name": "Alice", "last_name": "J.", "avatar": null },
      "menu_item_id": "1",
      "order_id": "ord-001",
      "rating": 5,
      "comment": "Amazing burger!",
      "created_at": "2024-03-01T12:00:00Z"
    }
  ],
  "count": 284,
  "average_rating": 4.8
}
```

**Frontend Type:** `Review` — `src/types/index.ts:434`

---

### 3.11 Create Menu Item (Admin)

**Method:** `POST`  
**Path:** `/menu/items/`  
**Authentication:** Admin (requires `menu:manage` permission)

**Request Body:** `Partial<MenuItem>` — all fields of `MenuItem` except `id`, `slug`, `rating`, `rating_count` (server-generated).

```json
{
  "name": "New Burger",
  "category_id": "cat1",
  "description": "A great burger",
  "price": 14.99,
  "image": "https://cdn.example.com/new-burger.jpg",
  "preparation_time": 12,
  "available": true
}
```

**Success Response `201`:** Full `MenuItem` object.

---

### 3.12 Update Menu Item (Admin)

**Method:** `PATCH`  
**Path:** `/menu/items/{id}/`  
**Authentication:** Admin (requires `menu:manage` permission)

**Request Body:** Any subset of `MenuItem` fields.

```json
{ "available": false, "price": 16.99 }
```

**Success Response `200`:** Updated `MenuItem` object.

---

### 3.13 Delete Menu Item (Admin)

**Method:** `DELETE`  
**Path:** `/menu/items/{id}/`  
**Authentication:** Admin (requires `menu:manage` permission)

**Success Response:** `204 No Content`

---

## 4. Order Endpoints

### 4.1 List Orders (Customer)

**Method:** `GET`  
**Path:** `/orders/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Order>`

**Frontend Type:** `Order` — `src/types/index.ts:169`

---

### 4.2 Create Order

**Method:** `POST`  
**Path:** `/orders/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "branch_id": "branch1",
  "items": [
    {
      "menu_item_id": "item1",
      "quantity": 2,
      "notes": "No onions",
      "extras": ["e1", "e2"]
    }
  ],
  "order_type": "delivery",
  "payment_method": "card",
  "delivery_address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "lat": 40.7128,
    "lng": -74.0060
  },
  "table_number": null,
  "discount_code": "SAVE10",
  "notes": "Please ring doorbell"
}
```

**Frontend Type:** `CreateOrderPayload` — `src/services/order.service.ts`

**Success Response `201`:** Full `Order` object.

**Business Rules:**
- `order_type: 'delivery'` requires `delivery_address`
- `order_type: 'dine_in'` requires `table_number`
- `discount_code` must be validated via `/orders/validate-discount/` before submission
- Tax calculated server-side at 9% of subtotal
- Service charge calculated server-side at 5% of subtotal

---

### 4.3 Get Order Detail

**Method:** `GET`  
**Path:** `/orders/{id}/`  
**Authentication:** Customer (own orders only) / Admin

**Success Response `200`:** Full `Order` object including `status_history`.

---

### 4.4 Cancel Order

**Method:** `POST`  
**Path:** `/orders/{id}/cancel/`  
**Authentication:** Customer

**Success Response `200`:** Updated `Order` with `status: 'cancelled'`.

**Business Rules:** Only `pending` orders may be cancelled by the customer.

---

### 4.5 Reorder

**Method:** `POST`  
**Path:** `/orders/{id}/reorder/`  
**Authentication:** Customer

**Success Response `201`:** New `Order` object (clone of original with fresh timestamps and `status: 'pending'`).

---

### 4.6 Track Order

**Method:** `GET`  
**Path:** `/orders/{id}/track/`  
**Authentication:** Customer

**Success Response `200`:** `Order` object. Frontend polls or supplements with WebSocket.

---

### 4.7 Validate Discount

**Method:** `POST`  
**Path:** `/orders/validate-discount/`  
**Authentication:** Customer

**Request Body:**
```json
{ "code": "SAVE10", "subtotal": 45.99 }
```

**Success Response `200`:**
```json
{
  "valid": true,
  "discount_type": "percent",
  "discount_value": 10,
  "discount_amount": 4.60
}
```

**Error Response `200`:**
```json
{ "valid": false, "message": "Code expired or invalid" }
```

**Known valid codes (mock):** `SAVE10` (10%), `WEEKEND20` (20%), `FIRST5` ($5 fixed)

---

### 4.8 Update Order Status (Admin) ⚠️ BLOCKED

**Method:** `PATCH`  
**Path:** `/orders/{id}/status/`  
**Authentication:** Admin (requires `orders:manage` permission)

**Request Body:**
```json
{ "status": "preparing" }
```

**Success Response `200`:** Updated `Order` object.

**Status Transitions (enforced by frontend UI):**
```
pending → accepted → preparing → ready → delivered
any     → cancelled (admin only)
```

**Frontend Type:** `OrderStatus` — `src/types/index.ts:134`  
**Call site:** `src/services/admin.service.ts:184`, `src/hooks/index.ts:useUpdateOrderStatus`

---

## 5. Reservation Endpoints

### 5.1 List Reservations (Customer)

**Method:** `GET`  
**Path:** `/reservations/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Reservation>`

**Frontend Type:** `Reservation` — `src/types/index.ts:206`

---

### 5.2 Create Reservation

**Method:** `POST`  
**Path:** `/reservations/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "branch_id": "branch1",
  "date": "2024-08-15",
  "time": "19:00",
  "guests": 4,
  "name": "Alice Johnson",
  "phone": "+1234567890",
  "email": "alice@example.com",
  "notes": "Anniversary dinner, window table preferred"
}
```

**Frontend Type:** `CreateReservationPayload` — `src/services/combined.service.ts`

**Success Response `201`:** Full `Reservation` object.

---

### 5.3 Get Reservation

**Method:** `GET`  
**Path:** `/reservations/{id}/`  
**Authentication:** Customer (own) / Admin

**Success Response `200`:** `Reservation` object.

---

### 5.4 Cancel Reservation

**Method:** `POST`  
**Path:** `/reservations/{id}/cancel/`  
**Authentication:** Customer

**Success Response `200`:** Updated `Reservation` with `status: 'cancelled'`.

---

### 5.5 Confirm Reservation (Admin) ⚠️ BLOCKED

**Method:** `POST`  
**Path:** `/reservations/{id}/confirm/`  
**Authentication:** Admin (requires `reservations:manage` permission)

**Request Body:** Empty

**Success Response `200`:**
```json
{
  "id": "res1",
  "status": "confirmed",
  "confirmation_code": "SAV-4521",
  ...
}
```

**Frontend Type:** `ReservationStatus` — `src/types/index.ts:204`  
**Call site:** `src/services/admin.service.ts:208`, `src/hooks/index.ts:useConfirmReservation`

---

### 5.6 Available Slots

**Method:** `GET`  
**Path:** `/reservations/available-slots/`  
**Authentication:** Public

**Query Parameters:** `date` (ISO date string), `branch_id`

**Success Response `200`:** `string[]` — available time strings in `HH:MM` format.

```json
["12:00", "12:30", "13:00", "19:00", "19:30", "20:00"]
```

---

## 6. Payment Endpoints

### 6.1 Create Payment Intent

**Method:** `POST`  
**Path:** `/payments/create-intent/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "amount": 4560,
  "currency": "usd",
  "order_description": "Order #3902",
  "branch_id": "branch1"
}
```

`amount` is in **cents** (Stripe convention).

**Success Response `200`:**
```json
{
  "client_secret": "pi_xxx_secret_yyy",
  "payment_intent_id": "pi_xxx",
  "amount": 4560,
  "currency": "usd"
}
```

**Frontend Type:** `CreatePaymentIntentPayload` — `src/services/payment.service.ts`

---

### 6.2 Confirm Payment

**Method:** `POST`  
**Path:** `/payments/confirm/`  
**Authentication:** Customer

**Request Body:**
```json
{ "payment_intent_id": "pi_xxx" }
```

**Success Response `200`:**
```json
{
  "status": "succeeded",
  "payment_intent_id": "pi_xxx",
  "error": null
}
```

---

## 7. Branch / Location Endpoints

### 7.1 List Branches

**Method:** `GET`  
**Path:** `/branches/`  
**Authentication:** Public  
**Tenant Aware:** Yes

**Success Response `200`:** `Branch[]` (not paginated)

```json
[
  {
    "id": "branch1",
    "name": "Downtown",
    "slug": "downtown",
    "type": "restaurant_branch",
    "address": "123 Main St",
    "city": "New York",
    "phone": "+12125551234",
    "email": "downtown@savor.com",
    "lat": 40.7128,
    "lng": -74.0060,
    "working_hours": [
      { "day": "Monday", "open": "11:00", "close": "22:00", "is_closed": false },
      { "day": "Sunday", "open": "12:00", "close": "21:00", "is_closed": false }
    ],
    "is_active": true,
    "delivery_radius": 5.0,
    "images": ["https://cdn.example.com/branch1.jpg"]
  }
]
```

**Frontend Type:** `Branch = Location` — `src/types/index.ts:334,356`

---

### 7.2 Get Branch

**Method:** `GET`  
**Path:** `/branches/{id}/`  
**Authentication:** Public

**Success Response `200`:** Single `Branch` object.

---

### 7.3 Nearby Branches

**Method:** `GET`  
**Path:** `/branches/nearby/`  
**Authentication:** Public

**Query Parameters:** `lat: number`, `lng: number`, `radius?: number` (km, default: 10)

**Success Response `200`:** `Branch[]` sorted by distance.

---

## 8. User / Profile Endpoints

### 8.1 Get Profile

**Method:** `GET`  
**Path:** `/users/profile/`  
**Authentication:** Customer

**Success Response `200`:** `User` object.

---

### 8.2 Update Profile

**Method:** `PATCH`  
**Path:** `/users/profile/`  
**Authentication:** Customer

**Request Body:** Any subset of `User` fields (excluding `id`, `role`, `created_at`, `is_verified`).

```json
{ "first_name": "Alice", "phone": "+1234567890" }
```

**Success Response `200`:** Updated `User` object.

---

### 8.3 Upload Avatar

**Method:** `POST`  
**Path:** `/users/avatar/`  
**Authentication:** Customer  
**Content-Type:** `multipart/form-data`

**Request Body:** `FormData` with field `avatar: File`

**Constraints:**
- Allowed types: JPEG, PNG, WebP, GIF
- Max size: 5 MB

**Success Response `200`:**
```json
{ "avatar_url": "https://cdn.example.com/avatars/u1.jpg" }
```

---

### 8.4 List Addresses

**Method:** `GET`  
**Path:** `/users/addresses/`  
**Authentication:** Customer

**Success Response `200`:** `Address[]`

```json
[
  {
    "id": "addr1",
    "label": "Home",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "lat": 40.7128,
    "lng": -74.0060,
    "is_default": true
  }
]
```

**Frontend Type:** `Address` — `src/types/index.ts:447`

---

### 8.5 Create Address

**Method:** `POST`  
**Path:** `/users/addresses/`  
**Authentication:** Customer

**Request Body:** `Address` fields excluding `id`.

**Success Response `201`:** Full `Address` object with server-assigned `id`.

---

### 8.6 Delete Address

**Method:** `DELETE`  
**Path:** `/users/addresses/{id}/`  
**Authentication:** Customer

**Success Response:** `204 No Content`

---

### 8.7 Get Favorites

**Method:** `GET`  
**Path:** `/users/favorites/`  
**Authentication:** Customer

**Success Response `200`:** `string[]` — array of favorite `MenuItem` IDs.

```json
["item1", "item5", "item12"]
```

---

### 8.8 Toggle Favorite

**Method:** `POST`  
**Path:** `/users/favorites/{itemId}/`  
**Authentication:** Customer

**Request Body:** Empty

**Success Response `200`:**
```json
{ "favorited": true }
```

or

```json
{ "favorited": false }
```

---

## 9. Notification Endpoints

### 9.1 List Notifications

**Method:** `GET`  
**Path:** `/notifications/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Notification>`

```json
{
  "count": 12,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "notif1",
      "type": "order_update",
      "title": "Order Ready",
      "message": "Your order #3902 is ready for pickup!",
      "data": { "order_id": "ord-001" },
      "is_read": false,
      "created_at": "2024-08-15T19:05:00Z"
    }
  ]
}
```

**Frontend Type:** `Notification` — `src/types/index.ts:405`

---

### 9.2 Mark Notification Read

**Method:** `POST`  
**Path:** `/notifications/{id}/read/`  
**Authentication:** Customer

**Success Response:** `200 OK`

---

### 9.3 Mark All Notifications Read

**Method:** `POST`  
**Path:** `/notifications/read-all/`  
**Authentication:** Customer

**Success Response:** `200 OK`

---

### 9.4 Delete Notification

**Method:** `DELETE`  
**Path:** `/notifications/{id}/`  
**Authentication:** Customer

**Success Response:** `204 No Content`

---

### 9.5 Register Push Device

**Method:** `POST`  
**Path:** `/notifications/register-device/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "token": "fcm-device-token-string",
  "platform": "web"
}
```

`platform` values: `"web"` | `"ios"` | `"android"`

**Success Response:** `200 OK`

---

## 10. Tenant Endpoints

### 10.1 Get Tenant by Slug

**Method:** `GET`  
**Path:** `/tenants/{slug}/`  
**Authentication:** Public

**Success Response `200`:**
```json
{
  "id": "t1",
  "name": "Savor Restaurant",
  "slug": "savor",
  "businessTypes": ["restaurant"],
  "status": "active",
  "createdAt": "2023-01-01T00:00:00Z",
  "settings": {
    "theme": {
      "primaryColor": "#3b82f6",
      "accentHoverColor": "#2563eb",
      "logoUrl": "https://cdn.example.com/logo.png",
      "fontBody": "\"Inter\", sans-serif"
    },
    "featureFlags": {
      "delivery.enabled": true,
      "reservations.enabled": true
    }
  }
}
```

**Frontend Type:** `Tenant` — `src/types/index.ts:286`  
**Important:** `businessTypes` must contain valid module keys (currently only `"restaurant"`).

---

### 10.2 Get Current Tenant

**Method:** `GET`  
**Path:** `/tenants/current/`  
**Authentication:** Public  
**Resolution:** From `Host` header or `X-Tenant-Slug` header

**Success Response `200`:** Same as 10.1.

---

## 11. Review Endpoints

### 11.1 Create Review

**Method:** `POST`  
**Path:** `/reviews/`  
**Authentication:** Customer

**Request Body:**
```json
{
  "menu_item_id": "item1",
  "rating": 5,
  "comment": "Amazing burger, will order again!",
  "order_id": "ord-001"
}
```

**Frontend Type:** `CreateReviewPayload` — `src/services/review.service.ts`

**Success Response `201`:** `Review` object.

---

### 11.2 List Reviews

**Method:** `GET`  
**Path:** `/reviews/`  
**Authentication:** Customer

**Query Parameters:** `page`, `page_size`

**Success Response `200`:** `PaginatedResponse<Review>`

---

## 12. Table Endpoints

### 12.1 Get Table Info

**Method:** `GET`  
**Path:** `/tables/{tableId}/`  
**Authentication:** Public (QR code scan scenario)

**Success Response `200`:**
```json
{
  "id": "t1",
  "number": 5,
  "capacity": 4,
  "section": "Garden",
  "server_name": "Marco",
  "status": "available"
}
```

**Frontend Type:** `TableInfo` — `src/types/index.ts:99`

---

### 12.2 Dine-In Order for Table

**Method:** `POST`  
**Path:** `/tables/{tableId}/order/`  
**Authentication:** Public (identified by table context)

**Request Body:** Same as `CreateOrderPayload` (section 4.2) with `order_type: "dine_in"`.

**Success Response `201`:** `Order` object.

---

## 13. Admin Endpoints

> **All admin endpoints require `role: 'admin'` or `role: 'staff'` on the authenticated user.**
> The frontend enforces this via `AuthGuard` checking `dashboard:access` permission.

### 13.1 Admin Dashboard Stats ⚠️ BLOCKED

**Method:** `GET`  
**Path:** `/admin/stats/`  
**Authentication:** Admin  
**Status:** **No backend route yet**

**Query Parameters:** `period_days?: number` (default: 30)

**Success Response `200`:**
```json
{
  "period_days": 30,
  "total_revenue": 48295.00,
  "revenue_change_pct": 12.5,
  "total_orders": 1284,
  "orders_change_pct": 8.2,
  "new_customers": 348,
  "customers_change_pct": 15.3,
  "total_reservations": 92,
  "reservations_change_pct": -3.1,
  "top_items": [
    {
      "menu_item_id": "1",
      "name": "Wagyu Smash Burger",
      "order_count": 284,
      "revenue": 7098.00,
      "trend_pct": 18
    }
  ],
  "orders_in_queue": 12,
  "avg_prep_time_minutes": 18,
  "tables_reserved": 8,
  "tables_total": 24
}
```

**Frontend Type:** `AdminStats` — `src/types/index.ts:549`  
**Call site:** `src/services/admin.service.ts:162`

---

### 13.2 List Admin Orders ⚠️ PARTIAL

**Method:** `GET`  
**Path:** `/admin/orders/`  
**Authentication:** Admin  
**Status:** **Falls back to `/orders/?admin=true` until deployed**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | `OrderStatus` | Filter by order status |
| `order_type` | `OrderType` | Filter by order type |
| `search` | `string` | Search by order number or customer name |
| `page` | `number` | Page number |
| `page_size` | `number` | Results per page |

**Success Response `200`:** `PaginatedResponse<Order>`  
**Frontend Type:** `AdminOrderFilters` — `src/types/index.ts:567`

---

### 13.3 List Admin Reservations ⚠️ PARTIAL

**Method:** `GET`  
**Path:** `/admin/reservations/`  
**Authentication:** Admin  
**Status:** **Falls back to `/reservations/?admin=true` until deployed**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | `ReservationStatus` | Filter by status |
| `branch_id` | `string` | Filter by branch |
| `date` | `string` | Filter by date (ISO date: `YYYY-MM-DD`) |
| `search` | `string` | Search by name or phone |
| `page` | `number` | Page number |
| `page_size` | `number` | Results per page |

**Success Response `200`:** `PaginatedResponse<Reservation>`  
**Frontend Type:** `AdminReservationFilters` — `src/types/index.ts:574`

---

### 13.4 List Admin Customers ⚠️ BLOCKED

**Method:** `GET`  
**Path:** `/admin/customers/`  
**Authentication:** Admin  
**Status:** **No backend route yet**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `tier` | `AdminCustomerTier` | Filter by customer tier (`new`, `regular`, `vip`) |
| `search` | `string` | Search by first name, last name, or email |
| `page` | `number` | Page number |
| `page_size` | `number` | Results per page |

**Success Response `200`:** `PaginatedResponse<AdminCustomer>`

```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "u1",
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Johnson",
      "phone": "+1234567890",
      "role": "customer",
      "is_verified": true,
      "created_at": "2024-01-15T00:00:00Z",
      "order_count": 14,
      "total_spent": 420.50,
      "avg_order_value": 30.04,
      "tier": "vip",
      "last_order_at": "2024-08-13T10:00:00Z"
    }
  ]
}
```

**Frontend Type:** `AdminCustomer` — `src/types/index.ts:521`  
**Filter type:** `AdminCustomerFilters` — `src/types/index.ts:586`  
**Call site:** `src/services/admin.service.ts:222`

**Tier Calculation Rules:**
- `new` — fewer than 5 orders or less than 90 days since first order
- `regular` — 5–14 orders
- `vip` — 15+ orders (frontend uses this as display-only; backend should compute and return)

---

### 13.5 Get Customer Stats ⚠️ BLOCKED

**Method:** `GET`  
**Path:** `/admin/customers/{id}/stats/`  
**Authentication:** Admin  
**Status:** **No backend route yet**

**Success Response `200`:**
```json
{
  "customer_id": "u1",
  "order_count": 14,
  "total_spent": 420.50,
  "avg_order_value": 30.04,
  "favorite_item": "Wagyu Smash Burger",
  "last_order_at": "2024-08-13T10:00:00Z"
}
```

**Frontend Type:** `AdminCustomerStats` — `src/types/index.ts:530`  
**Call site:** `src/services/admin.service.ts:236`

---

## 14. WebSocket Channels

**Base:** `process.env.NEXT_PUBLIC_WS_BASE_URL` (default: `ws://localhost:8000/ws`)  
**Implementation:** Django Channels  
**Auth:** JWT token passed as query param `?token={access_token}`

### 14.1 Order Tracking Channel

**URL:** `ws://localhost:8000/ws/orders/{orderId}/?token={accessToken}`  
**Authentication:** Customer (must own the order)

**Server → Client Messages:**

```json
{ "type": "order.status_update", "data": { "status": "preparing", "estimated_time": 15 } }
{ "type": "connected", "data": null }
{ "type": "disconnected", "data": null }
```

**Frontend Type:** `OrderStatus` — `src/types/index.ts:134`  
**Call site:** `src/hooks/client.ts:useOrderWebSocket`

---

### 14.2 Notification Channel

**URL:** `ws://localhost:8000/ws/notifications/?token={accessToken}`  
**Authentication:** Customer

**Server → Client Messages:**

```json
{ "type": "notification.new", "data": { "id": "notif5", "type": "order_update", "title": "Ready!", "message": "Your order is ready.", "is_read": false, "created_at": "2024-08-15T19:05:00Z" } }
```

**Frontend Type:** `Notification` — `src/types/index.ts:405`  
**Call site:** `src/hooks/client.ts:useNotificationWebSocket`

---

### WebSocket Reconnection Contract

The frontend implements exponential backoff with jitter:

```
delay = min(BASE_DELAY * 2^attempt, MAX_DELAY) * (1 + jitter * Math.random())
BASE_DELAY = 1000ms
MAX_DELAY  = 30000ms
MAX_RECONNECT_ATTEMPTS = 10
```

- Pauses when `document.visibilityState === 'hidden'`
- Pauses when `navigator.onLine === false`
- Resumes immediately on `visibilitychange` or `online` event
- Uses `BroadcastChannel` for multi-tab coordination (graceful degradation if unavailable)

The backend should accept reconnecting clients without penalty and replay the last known status on connection.

---

## 15. Pagination Contract

**All list endpoints return this envelope:**

```typescript
interface PaginatedResponse<T> {
  count: number           // Total record count across all pages
  next: string | null     // Full URL of next page, or null
  previous: string | null // Full URL of previous page, or null
  results: T[]            // Records for current page
}
```

**Source:** `src/types/index.ts:418`

**Query Parameters (standard, all optional):**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | 1-indexed page number |
| `page_size` | `20` | Max records per page |

**Frontend accesses:** `data?.results`, `data?.count` — these exact field names are required.

---

## 16. Error Response Contract

**Source:** `src/types/index.ts:425`

```typescript
interface ApiError {
  message: string
  code?: string
  errors?: Record<string, string[]>
}
```

**HTTP Status Codes:**

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | |
| `201` | Created | |
| `204` | No Content | DELETE success |
| `400` | Validation error | `{ "message": "Invalid data", "errors": { "email": ["Already taken"] } }` |
| `401` | Unauthenticated | `{ "message": "Authentication required", "code": "not_authenticated" }` |
| `403` | Forbidden | `{ "message": "Permission denied", "code": "permission_denied" }` |
| `404` | Not found | `{ "message": "Not found", "code": "not_found" }` |
| `500` | Server error | `{ "message": "Internal server error" }` |

---

## 17. Security & Headers

### Request Headers (sent by frontend)

| Header | Value | When |
|--------|-------|------|
| `Authorization` | `Bearer {access_token}` | All authenticated requests |
| `Content-Type` | `application/json` | All POST/PATCH/PUT requests |
| `Accept` | `application/json` | All requests |
| `X-CSRFToken` | Value of `csrftoken` cookie | All non-GET requests |
| `X-Tenant-Slug` | Tenant slug string | All requests (injected by Next.js middleware) |

**Source:** `src/services/axios.instance.ts`, `src/middleware.ts`

### Required CORS Configuration

```
Access-Control-Allow-Origin: http://localhost:3000  (or production domain)
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRFToken, X-Tenant-Slug
```

The axios instance sets `withCredentials: true`, so the backend **must** allow credentials and cannot use wildcard (`*`) for `Access-Control-Allow-Origin`.

---

## 18. Business Rules

### Order Status Machine

```
pending ──→ accepted ──→ preparing ──→ ready ──→ delivered
   │            │              │           │
   └──────────────────────────────────────→ cancelled (admin action)
```

- Customer can cancel only `pending` orders
- Admin can advance status forward or cancel at any stage
- `status_history` array must be maintained by backend with timestamps

### Cart Calculation

```
subtotal       = sum(unit_price × quantity) for all items
tax            = subtotal × 0.09   (9% — hardcoded frontend assumption)
service_charge = subtotal × 0.05   (5% — hardcoded frontend assumption)
discount_amount = (from /orders/validate-discount/)
total          = subtotal - discount_amount + tax + service_charge
```

### Customer Tier Logic

| Tier | Condition |
|------|-----------|
| `new` | order_count < 5 |
| `regular` | 5 ≤ order_count < 15 |
| `vip` | order_count ≥ 15 |

Computed by backend; returned in `AdminCustomer.tier`.

### Tenant Resolution Order

1. `X-Tenant-Slug` header (set by Next.js middleware from subdomain)
2. `Host` header subdomain extraction
3. `NEXT_PUBLIC_TENANT_SLUG` env var (dev override)
4. Default tenant (`"default"`)

### RBAC Permissions by Role

| Permission | customer | staff | admin |
|-----------|---------|-------|-------|
| `menu:read` | ✓ | ✓ | ✓ |
| `orders:read` | ✓ | ✓ | ✓ |
| `orders:write` | ✓ | ✓ | ✓ |
| `orders:cancel` | ✓ | ✓ | ✓ |
| `orders:manage` | — | ✓ | ✓ |
| `menu:write` | — | ✓ | ✓ |
| `menu:manage` | — | — | ✓ |
| `reservations:read` | ✓ | ✓ | ✓ |
| `reservations:write` | ✓ | ✓ | ✓ |
| `reservations:manage` | — | ✓ | ✓ |
| `users:read` | ✓ | ✓ | ✓ |
| `users:manage` | — | — | ✓ |
| `dashboard:access` | — | ✓ | ✓ |
| `branches:read` | ✓ | ✓ | ✓ |
| `branches:manage` | — | — | ✓ |
| `notifications:read` | ✓ | ✓ | ✓ |

**Source:** `src/services/rbac.service.ts`, `src/types/index.ts:470`

### Feature Flags

Backend should include a `featureFlags` object inside `Tenant.settings`. The frontend merges module defaults with tenant overrides. Known flags:

| Flag Key | Default | Description |
|----------|---------|-------------|
| `delivery.enabled` | `true` | Enable delivery order type |
| `reservations.enabled` | `true` | Enable reservation flow |

---

## 19. RBAC Permission Matrix

See section 18 above. The frontend guards all admin pages via `AuthGuard` checking `dashboard:access`. Admin mutation endpoints additionally check specific permissions (`menu:manage`, `orders:manage`, `reservations:manage`).

---

## 20. Environment Variables

```bash
# Required
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_USE_MOCK=false

# Optional (gracefully degraded if missing)
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000/ws
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=savor-...
NEXT_PUBLIC_FIREBASE_APP_ID=1:...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BK...
NEXT_PUBLIC_TENANT_SLUG=default    # Dev override — bypasses middleware resolution
```

---

## 21. Endpoint Classification Summary

| Endpoint | Method | Status |
|----------|--------|--------|
| `/auth/login/` | POST | ✅ READY |
| `/auth/register/` | POST | ✅ READY |
| `/auth/logout/` | POST | ✅ READY |
| `/auth/me/` | GET | ✅ READY |
| `/auth/token/refresh/` | POST | ✅ READY |
| `/auth/forgot-password/` | POST | ✅ READY |
| `/auth/reset-password/` | POST | ✅ READY |
| `/auth/send-otp/` | POST | ✅ READY |
| `/auth/verify-otp/` | POST | ✅ READY |
| `/auth/change-password/` | POST | ✅ READY |
| `/menu/categories/` | GET | ✅ READY |
| `/menu/categories/{id}/` | GET | ✅ READY |
| `/menu/items/` | GET | ✅ READY |
| `/menu/items/` | POST | ✅ READY (admin) |
| `/menu/items/{id}/` | GET/PATCH/DELETE | ✅ READY |
| `/menu/items/featured/` | GET | ✅ READY |
| `/menu/items/popular/` | GET | ✅ READY |
| `/menu/items/search/` | GET | ✅ READY |
| `/menu/items/{id}/related/` | GET | ✅ READY |
| `/menu/items/{id}/reviews/` | GET | ✅ READY |
| `/orders/` | GET/POST | ✅ READY |
| `/orders/{id}/` | GET | ✅ READY |
| `/orders/{id}/cancel/` | POST | ✅ READY |
| `/orders/{id}/reorder/` | POST | ✅ READY |
| `/orders/{id}/track/` | GET | ✅ READY |
| `/orders/validate-discount/` | POST | ✅ READY |
| `/orders/{id}/status/` | PATCH | 🔴 BLOCKED |
| `/payments/create-intent/` | POST | ✅ READY |
| `/payments/confirm/` | POST | ✅ READY |
| `/reservations/` | GET/POST | ✅ READY |
| `/reservations/{id}/` | GET | ✅ READY |
| `/reservations/{id}/cancel/` | POST | ✅ READY |
| `/reservations/{id}/confirm/` | POST | 🔴 BLOCKED |
| `/reservations/available-slots/` | GET | ✅ READY |
| `/branches/` | GET | ✅ READY |
| `/branches/{id}/` | GET | ✅ READY |
| `/branches/nearby/` | GET | ✅ READY |
| `/users/profile/` | GET/PATCH | ✅ READY |
| `/users/avatar/` | POST | ✅ READY |
| `/users/addresses/` | GET/POST | ✅ READY |
| `/users/addresses/{id}/` | DELETE | ✅ READY |
| `/users/favorites/` | GET | ✅ READY |
| `/users/favorites/{itemId}/` | POST | ✅ READY |
| `/notifications/` | GET | ✅ READY |
| `/notifications/{id}/read/` | POST | ✅ READY |
| `/notifications/read-all/` | POST | ✅ READY |
| `/notifications/{id}/` | DELETE | ✅ READY |
| `/notifications/register-device/` | POST | ✅ READY |
| `/tenants/{slug}/` | GET | ✅ READY |
| `/tenants/current/` | GET | ✅ READY |
| `/reviews/` | GET/POST | ✅ READY |
| `/tables/{tableId}/` | GET | ✅ READY |
| `/tables/{tableId}/order/` | POST | ✅ READY |
| `/admin/stats/` | GET | 🔴 BLOCKED |
| `/admin/orders/` | GET | 🟡 PARTIAL (falls back to /orders/) |
| `/admin/reservations/` | GET | 🟡 PARTIAL (falls back to /reservations/) |
| `/admin/customers/` | GET | 🔴 BLOCKED |
| `/admin/customers/{id}/stats/` | GET | 🔴 BLOCKED |
| `ws/orders/{id}/` | WS | ✅ READY |
| `ws/notifications/` | WS | ✅ READY |

---

## 14. Analytics Endpoints

> Added in P7.13. All analytics endpoints require `admin` role or `analytics.view` permission.

### 14.1 Menu Analytics

**Method:** `GET`
**Path:** `/analytics/menu/`
**Authentication:** Admin
**Query params:** `tenant_id`, `branch_id` (optional), `period` (`7d` | `30d` | `90d`, default `30d`)

**Success Response `200`:**
```json
{
  "period": "30d",
  "topItems": [{ "itemId": "i1", "name": "Wagyu Burger", "orders": 142, "revenue": 2556.0, "trend": 12.5 }],
  "categoryBreakdown": [{ "categoryId": "c1", "name": "Burgers", "orders": 220, "revenue": 3960.0, "percentage": 35.2 }],
  "revenueByDay": [{ "date": "2026-06-01", "revenue": 1240.0, "orders": 68 }],
  "totalRevenue": 11250.0,
  "totalOrders": 620,
  "averageOrderValue": 18.15,
  "comparisonPeriod": { "totalRevenue": 9800.0, "totalOrders": 540, "revenueChange": 14.8, "ordersChange": 14.8 }
}
```

**Source:** `src/services/analytics.service.ts` → `getMenuAnalytics()`
**Type:** `MenuAnalytics` in `src/types/analytics.ts`

---

### 14.2 Revenue Analytics

**Method:** `GET`
**Path:** `/analytics/revenue/`
**Authentication:** Admin
**Query params:** `tenant_id`, `branch_id` (optional), `period` (`7d` | `30d` | `90d`, default `30d`), `group_by` (`day` | `week` | `month`)

**Success Response `200`:**
```json
{
  "period": "30d",
  "groupBy": "day",
  "data": [{ "date": "2026-06-01", "revenue": 1240.0, "orders": 68, "averageOrder": 18.24 }],
  "total": 11250.0,
  "averagePerPeriod": 375.0,
  "growth": 14.8
}
```

**Source:** `src/services/analytics.service.ts` → `getRevenueAnalytics()`
**Type:** `RevenueAnalytics` in `src/types/analytics.ts`

---

### 14.3 Analytics Summary

**Method:** `GET`
**Path:** `/analytics/summary/`
**Authentication:** Admin
**Query params:** `tenant_id`, `branch_id` (optional)

**Success Response `200`:**
```json
{
  "today": { "revenue": 840.0, "orders": 46, "avgOrderValue": 18.26 },
  "thisWeek": { "revenue": 5200.0, "orders": 286, "avgOrderValue": 18.18 },
  "thisMonth": { "revenue": 11250.0, "orders": 620, "avgOrderValue": 18.15 },
  "topItemToday": { "itemId": "i1", "name": "Wagyu Burger", "orders": 12 }
}
```

**Source:** `src/services/analytics.service.ts` → `getAnalyticsSummary()`
**Type:** `AnalyticsSummary` in `src/types/analytics.ts`

---

### 14.4 Branch Analytics

**Method:** `GET`
**Path:** `/branches/{id}/analytics/`
**Authentication:** Admin
**Query params:** `period`

**Success Response `200`:** Same shape as `MenuAnalytics` scoped to the given branch.

**Source:** `src/services/branch-analytics.service.ts`

---

## 15. Bulk Operation Endpoints

> Added in P7.14. All bulk endpoints require the corresponding `*.manage` permission.

### 15.1 Bulk Update Order Status

**Method:** `POST`
**Path:** `/admin/orders/bulk-status/`
**Authentication:** Admin (`orders.manage`)

**Request Body:**
```json
{ "ids": ["o1", "o2", "o3"], "status": "accepted" }
```

**Success Response `200`:**
```json
{ "updated": 3, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkUpdateOrderStatus()`

---

### 15.2 Bulk Cancel Orders

**Method:** `POST`
**Path:** `/admin/orders/bulk-cancel/`
**Authentication:** Admin (`orders.manage`)

**Request Body:**
```json
{ "ids": ["o1", "o2"] }
```

**Success Response `200`:**
```json
{ "cancelled": 2, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkCancelOrders()`

---

### 15.3 Bulk Confirm Reservations

**Method:** `POST`
**Path:** `/admin/reservations/bulk-confirm/`
**Authentication:** Admin (`reservations.manage`)

**Request Body:**
```json
{ "ids": ["r1", "r2"] }
```

**Success Response `200`:**
```json
{ "confirmed": 2, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkConfirmReservations()`

---

### 15.4 Bulk Cancel Reservations

**Method:** `POST`
**Path:** `/admin/reservations/bulk-cancel/`
**Authentication:** Admin (`reservations.manage`)

**Request Body:**
```json
{ "ids": ["r1", "r2"] }
```

**Success Response `200`:**
```json
{ "cancelled": 2, "failed": [] }
```

**Source:** `src/hooks/index.ts` → `useBulkCancelReservations()`

---

### 15.5 Bulk Export Customers

**Method:** `POST`
**Path:** `/admin/customers/bulk-export/`
**Authentication:** Admin (`customers.export`)

**Request Body:**
```json
{ "ids": ["c1", "c2"] }
```

**Success Response `200`:** CSV file download (`Content-Type: text/csv`)

> **Note:** Frontend currently performs client-side CSV export. This endpoint enables server-side export for large datasets.

**Source:** `src/hooks/index.ts` → `useBulkExportCustomers()`

---

## 16. Staff Management Endpoints

> Added in P7.2. Requires `staff.view` / `staff.manage` permissions.

### 16.1 List Staff

**Method:** `GET`
**Path:** `/admin/staff/`
**Query params:** `branch_id`, `role`, `search`, `page`

**Success Response `200`:** Paginated list of `StaffMember` objects.

**Type:** `StaffMember` in `src/types/staff.ts`
**Source:** `src/services/staff.service.ts`

### 16.2 Staff Detail

**Method:** `GET` / `PATCH`
**Path:** `/admin/staff/{id}/`

### 16.3 Staff Shifts

**Method:** `GET`
**Path:** `/admin/staff/{id}/shifts/`

---

## 17. Audit Log Endpoints

> Added in P7.5. Requires `audit_logs.view` permission.

### 17.1 List Audit Logs

**Method:** `GET`
**Path:** `/admin/audit-logs/`
**Query params:** `entity_type`, `entity_id`, `actor_id`, `action`, `from_date`, `to_date`, `page`

**Success Response `200`:** Paginated list of `AuditLog` objects.

**Type:** `AuditLog` in `src/types/audit-log.ts`
**Source:** `src/services/audit-log.service.ts`

### 17.2 Audit Log Detail

**Method:** `GET`
**Path:** `/admin/audit-logs/{id}/`

---

## 18. Kitchen Display Endpoints

> Added in P7.13. Used by `KitchenDisplay` component and `useKitchenStatus` hook.

### 18.1 Kitchen Status

**Method:** `GET`
**Path:** `/admin/kitchen/status/`
**Authentication:** Admin (`kitchen.view`)
**Query params:** `branch_id` (required), `tenant_id`

**Success Response `200`:**
```json
{
  "pendingOrders": [],
  "preparingOrders": [],
  "readyOrders": [],
  "delayedOrders": [],
  "priorityOrders": [],
  "averagePrepMinutes": 12,
  "queueDepth": 8,
  "capacityPercent": 67
}
```

**Type:** `KitchenStatus` in `src/types/realtime-operations.ts`
**Source:** `src/services/realtime-operations.service.ts` → `getKitchenStatus()`

**WebSocket alternative:** `ws/kitchen/{branchId}/` — pushes `KitchenStatus` updates in real time.

---

## 19. Loyalty & Promotion Endpoints

> Added in P6. Requires `loyalty.view` / `promotions.view` permissions for admin endpoints.

### 19.1 Customer Loyalty Points

**Method:** `GET`
**Path:** `/loyalty/points/`
**Authentication:** Authenticated customer

### 19.2 Redeem Points

**Method:** `POST`
**Path:** `/loyalty/redeem/`

### 19.3 Admin — List Promotions

**Method:** `GET`
**Path:** `/admin/promotions/`
**Query params:** `active`, `branch_id`, `page`

**Type:** `Promotion` in `src/types/index.ts`
**Source:** `src/services/promotion.service.ts`

### 19.4 Admin — Create / Update Promotion

**Method:** `POST` / `PATCH`
**Path:** `/admin/promotions/` / `/admin/promotions/{id}/`

---

## 20. Vendor Endpoints

> Added in P6. Used by food court tenant module.

### 20.1 List Vendors (Admin)

**Method:** `GET`
**Path:** `/admin/vendors/`
**Query params:** `branch_id`, `active`, `page`

**Type:** `Vendor` in `src/types/index.ts`
**Source:** `src/services/vendor.service.ts`

### 20.2 Vendor Detail

**Method:** `GET` / `PATCH`
**Path:** `/admin/vendors/{id}/`

---

## 21. Feature Flag Endpoints

> Added in P1B. Requires `settings.manage` permission.

### 21.1 List Feature Flags

**Method:** `GET`
**Path:** `/admin/settings/feature-flags/`
**Query params:** `tenant_id`, `branch_id`

**Success Response `200`:**
```json
{
  "results": [{ "key": "online_ordering", "enabled": true, "tenantId": "t1", "branchId": null }]
}
```

**Source:** `src/services/feature-flags.service.ts`

### 21.2 Toggle Feature Flag

**Method:** `PATCH`
**Path:** `/admin/settings/feature-flags/{key}/`

**Request Body:**
```json
{ "enabled": false }
```

---


---

## 22. WebSocket Channels

> All WebSocket connections require `Authorization: Bearer <token>` passed as a query parameter or in the initial handshake frame: `ws://.../ws/channel/?token=<access_token>`

### 22.1 Order Tracking

**Channel:** `ws/orders/{orderId}/`  
**Authentication:** Customer (own orders) or Admin  
**Events pushed by server:**

```json
{ "type": "order.status_changed", "order_id": "o1", "status": "preparing", "estimated_time": 15 }
{ "type": "order.ready", "order_id": "o1" }
{ "type": "order.delivered", "order_id": "o1" }
```

**Source:** `src/hooks/index.ts` → `useOrderTracking()`

---

### 22.2 Real-time Notifications

**Channel:** `ws/notifications/`  
**Authentication:** Any authenticated user  
**Scope:** Filtered to the authenticated user + tenant  
**Events pushed by server:**

```json
{ "type": "notification.new", "notification": { /* RichNotification object */ } }
{ "type": "notification.read", "id": "n1" }
{ "type": "notification.count", "unread": 3 }
```

**Source:** `src/hooks/index.ts` → `useRealtimeNotifications()`

---

### 22.3 Kitchen Display

**Channel:** `ws/kitchen/{branchId}/`  
**Authentication:** Staff (`kitchen.view`)  
**Events pushed by server:**

```json
{ "type": "kitchen.status", "status": { /* KitchenStatus object */ } }
{ "type": "kitchen.order_new", "order": { /* Order */ } }
{ "type": "kitchen.order_updated", "order": { /* Order */ } }
```

**Source:** `src/services/realtime-operations.service.ts`

---

### 22.4 Admin Dashboard Live Updates

**Channel:** `ws/admin/dashboard/`  
**Authentication:** Admin  
**Events pushed by server:**

```json
{ "type": "stats.updated", "stats": { /* AdminStats */ } }
{ "type": "order.new", "order": { /* Order summary */ } }
```

---

## 23. Pagination Contract

All list endpoints that can return large result sets use Django REST Framework-style pagination.

### 23.1 Standard Paginated Response

```json
{
  "count": 142,
  "next": "https://api.example.com/api/orders/?page=3",
  "previous": "https://api.example.com/api/orders/?page=1",
  "results": [ /* array of items */ ]
}
```

**TypeScript type:** `PaginatedResponse<T>` — `src/types/index.ts`

```typescript
interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
```

### 23.2 Pagination Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | 1-based page number |
| `page_size` | `number` | `20` | Items per page (max 100) |

### 23.3 Endpoints Using Pagination

| Endpoint | Notes |
|----------|-------|
| `GET /menu/items/` | `page`, `page_size` supported |
| `GET /orders/` | `page` supported |
| `GET /reservations/` | `page` supported |
| `GET /notifications/` | `page` supported |
| `GET /notifications/rich/` | `page`, `page_size` supported |
| `GET /admin/customers/` | `page` supported |
| `GET /admin/orders/` | `page` supported |
| `GET /admin/reservations/` | `page` supported |
| `GET /audit-logs/` | `page` supported |
| `GET /tenants/` | `page` supported |

---

## 24. Error Response Contract

All error responses follow a consistent JSON envelope.

### 24.1 Standard Error Body

```json
{
  "message": "Human-readable error description",
  "code": "machine_readable_error_code",
  "details": { /* optional field-level validation errors */ }
}
```

### 24.2 Field Validation Error (422 / 400)

```json
{
  "message": "Validation failed",
  "code": "validation_error",
  "details": {
    "email": ["Enter a valid email address."],
    "password": ["This field is required."]
  }
}
```

### 24.3 HTTP Status Code Conventions

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET, POST (non-create), PATCH |
| `201` | Created | Successful POST that creates a resource |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Invalid input / business rule violation |
| `401` | Unauthorized | Missing or invalid access token |
| `403` | Forbidden | Authenticated but insufficient permission |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate resource (e.g., slug already taken) |
| `422` | Unprocessable Entity | Semantic validation failure (e.g., discount code expired) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected backend failure |

### 24.4 Auth Error Codes

| `code` | Trigger |
|--------|---------|
| `invalid_credentials` | Wrong email/password |
| `token_expired` | Access token has expired |
| `token_invalid` | Malformed or tampered token |
| `refresh_expired` | Refresh token has expired — user must re-login |
| `account_suspended` | User account is suspended |
| `not_verified` | Email/phone not yet verified |
| `otp_invalid` | Submitted OTP is wrong or expired |

---

## 25. Security & Headers

### 25.1 Required Request Headers

| Header | Required On | Value |
|--------|------------|-------|
| `Authorization` | All authenticated endpoints | `Bearer <access_token>` |
| `Content-Type` | POST / PATCH with JSON body | `application/json` |
| `Content-Type` | Avatar upload | `multipart/form-data` |
| `X-CSRFToken` | Mutating requests (when using session auth) | Value from `csrftoken` cookie |
| `X-Tenant-Slug` | All tenant-scoped endpoints | e.g. `savor` |

### 25.2 CORS

Backend must allow:
- **Origins:** All configured frontend origins (dev + staging + production)
- **Credentials:** `withCredentials: true` is set on every axios request — backend must respond with `Access-Control-Allow-Credentials: true` and an explicit origin (not `*`)
- **Methods:** `GET, POST, PATCH, PUT, DELETE, OPTIONS`
- **Headers:** `Authorization, Content-Type, X-CSRFToken, X-Tenant-Slug`

### 25.3 CSRF

The frontend axios instance reads the `csrftoken` cookie (set by Django on first request) and sends it as `X-CSRFToken` on all mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`). Backend must:
1. Issue a `csrftoken` cookie (not HttpOnly) on any GET request or on the login response
2. Validate `X-CSRFToken` header on all mutating requests

### 25.4 Token Storage

| Token | Frontend Storage | Cookie Mirroring |
|-------|-----------------|-----------------|
| `access` | `localStorage["access_token"]` | Mirrored to a non-HttpOnly cookie for Next.js middleware use |
| `refresh` | `localStorage["refresh_token"]` | Not mirrored |

### 25.5 Rate Limiting (Recommended)

| Endpoint Group | Recommended Limit |
|---------------|------------------|
| `POST /auth/login/` | 10 req/min per IP |
| `POST /auth/send-otp/` | 3 req/min per phone |
| `POST /auth/forgot-password/` | 5 req/min per email |
| All other endpoints | 200 req/min per authenticated user |

### 25.6 File Upload Constraints

Enforced by the frontend before upload; backend must also validate:

| Field | Constraint |
|-------|-----------|
| Avatar file types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Avatar max size | 5 MB |
| Field name | `avatar` (multipart key) |
| Response field | `avatar_url` (string URL) |

---

## 26. Business Rules

### 26.1 Multi-Tenancy

- Every resource (menu items, orders, reservations, branches, staff, notifications, audit logs) is scoped to a tenant.
- The active tenant is identified by **slug** in the URL path (`/[tenantSlug]/...`) and resolved to a `tenant_id` by the backend.
- The frontend sends `X-Tenant-Slug: <slug>` on all authenticated requests. Backend must reject requests where the token's tenant claim does not match the header.
- **Cross-tenant data leakage is a critical security requirement.** Staff of Tenant A must never be able to read or mutate resources of Tenant B.

### 26.2 RBAC

- Every user has a list of **roles** scoped to a specific tenant. A user can have different roles in different tenants.
- Roles: `owner`, `admin`, `manager`, `cashier`, `waiter`, `kitchen`, `marketing`, `support`
- The backend must check `(userId, tenantId, role)` — not just `(userId, role)`.
- Permission checks are **additive**: a user with both `manager` and `cashier` roles has the union of both permission sets.
- `owner` has all permissions and cannot be removed from a tenant by anyone except themselves (via transfer-ownership).

### 26.3 Order Lifecycle

Valid status transitions enforced by the backend:

```
pending → accepted → preparing → ready → delivered
pending → cancelled
accepted → cancelled
preparing → cancelled (only by owner/admin)
```

Frontend uses `PATCH /orders/{id}/status/` with `{ status }` for admin transitions.

### 26.4 Reservation Lifecycle

```
pending → confirmed
pending → cancelled
confirmed → cancelled
```

`POST /reservations/{id}/confirm/` and `POST /reservations/{id}/cancel/` are the explicit action endpoints.

### 26.5 Loyalty Points

- Points are awarded on order completion (`POST /loyalty/earn/` with `order_id` and `amount`).
- Points can be redeemed for rewards (`POST /loyalty/rewards/{rewardId}/redeem/`).
- Tiers: determined by `lifetimePoints`. Backend owns tier calculation.
- The frontend never calculates point values — it only reads `LoyaltyAccount` from the API.

### 26.6 Discount Code Validation

- Frontend validates discount codes **before** order creation via `POST /orders/validate-discount/`.
- If valid, `discount_amount` is applied client-side to compute `total`.
- The backend must re-validate the discount code on `POST /orders/` to prevent tampering.
- Response shape: `{ valid, discount_type, discount_value, discount_amount, message? }`

### 26.7 Tenant Provisioning

- New tenants are created via `POST /tenants/provision/`.
- Tenants can be cloned from an existing tenant via `POST /tenants/clone/`.
- Status lifecycle: `active` → `suspended` → `archived`. Archived tenants cannot be reactivated.

### 26.8 Branch Status Lifecycle

```
active → deactivated
active → maintenance
deactivated → active
maintenance → active
```

Corresponding endpoints: `POST /branches/{id}/activate/`, `POST /branches/{id}/deactivate/`, `POST /branches/{id}/maintenance/`

### 26.9 Staff Invite Flow

1. Admin sends `POST /tenants/{tenantId}/staff/invite/` with `{ email, roles }`.
2. Backend emails the invitee a link containing an invite token.
3. Invitee hits `POST /invites/{id}/accept/` — this creates the `StaffMember` record.
4. Admin can `POST /invites/{id}/resend/` or `POST /invites/{id}/cancel/` before acceptance.

### 26.10 Audit Logging

- Every mutation through the admin interface generates an audit log entry via `POST /audit-logs/`.
- The frontend fires this as a **fire-and-forget** (errors are caught and swallowed).
- The backend must also generate audit logs server-side as a safety net.
- Audit logs are **immutable** — no update or delete endpoints exist.

---

## 27. RBAC Permission Matrix

> Source: `src/types/rbac.ts` — `P7Permission` enum

### 27.1 Permission → Role Mapping

| Permission | owner | admin | manager | cashier | waiter | kitchen | marketing | support |
|-----------|:-----:|:-----:|:-------:|:-------:|:------:|:-------:|:---------:|:-------:|
| `orders.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `orders.manage` | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `orders.cancel` | ✅ | ✅ | ✅ | — | — | — | — | — |
| `orders.refund` | ✅ | ✅ | — | — | — | — | — | — |
| `menu.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `menu.manage` | ✅ | ✅ | ✅ | — | — | — | ✅ | — |
| `menu.delete` | ✅ | ✅ | — | — | — | — | — | — |
| `reservations.view` | ✅ | ✅ | ✅ | — | ✅ | — | — | ✅ |
| `reservations.manage` | ✅ | ✅ | ✅ | — | — | — | — | — |
| `customers.view` | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ |
| `customers.export` | ✅ | ✅ | — | — | — | — | — | — |
| `staff.view` | ✅ | ✅ | ✅ | — | — | — | — | — |
| `staff.manage` | ✅ | ✅ | — | — | — | — | — | — |
| `staff.invite` | ✅ | ✅ | — | — | — | — | — | — |
| `analytics.view` | ✅ | ✅ | ✅ | — | — | — | ✅ | — |
| `settings.view` | ✅ | ✅ | — | — | — | — | — | — |
| `settings.manage` | ✅ | ✅ | — | — | — | — | — | — |
| `loyalty.view` | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ |
| `loyalty.manage` | ✅ | ✅ | — | — | — | — | — | — |
| `promotions.view` | ✅ | ✅ | ✅ | — | — | — | ✅ | — |
| `promotions.manage` | ✅ | ✅ | ✅ | — | — | — | — | — |
| `vendors.view` | ✅ | ✅ | ✅ | — | — | — | — | — |
| `vendors.manage` | ✅ | ✅ | — | — | — | — | — | — |
| `payments.view` | ✅ | ✅ | ✅ | — | — | — | — | ✅ |
| `payments.refund` | ✅ | ✅ | — | — | — | — | — | — |
| `kitchen.view` | ✅ | ✅ | ✅ | — | — | ✅ | — | — |
| `kitchen.manage` | ✅ | ✅ | ✅ | — | — | ✅ | — | — |
| `audit_logs.view` | ✅ | ✅ | — | — | — | — | — | — |
| `branches.view` | ✅ | ✅ | ✅ | — | — | — | — | ✅ |
| `branches.manage` | ✅ | ✅ | — | — | — | — | — | — |
| `tenants.manage` | ✅ | — | — | — | — | — | — | — |

### 27.2 Capability Flag → Feature Flag Mapping

The frontend `CapabilityGuard` component checks `featureFlags[CAPABILITY_FLAG_MAP[capability]]`.

| Capability | Feature Flag Key |
|-----------|-----------------|
| `loyalty` | `loyalty.enabled` |
| `vendors` | `vendors.enabled` |
| `reservations` | `reservations.enabled` |
| `online_ordering` | `online_ordering.enabled` |
| `promotions` | `promotions.enabled` |
| `analytics` | `analytics.enabled` |
| `kitchen_display` | `kitchen_display.enabled` |

---

## 28. Complete Endpoint Classification Summary (P8.7.8)

> Last updated: 2026-06-27 (P8.7.8 audit)

### 28.1 Authentication

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/auth/login/` | POST | Public | ✅ READY |
| `/auth/register/` | POST | Public | ✅ READY |
| `/auth/logout/` | POST | Authenticated | ✅ READY |
| `/auth/me/` | GET | Authenticated | ✅ READY |
| `/auth/token/refresh/` | POST | Public | ✅ READY |
| `/auth/forgot-password/` | POST | Public | ✅ READY |
| `/auth/reset-password/` | POST | Public | ✅ READY |
| `/auth/send-otp/` | POST | Public | ✅ READY |
| `/auth/verify-otp/` | POST | Public | ✅ READY |
| `/auth/change-password/` | POST | Authenticated | ✅ READY |

### 28.2 Menu

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/menu/categories/` | GET | Public | ✅ READY |
| `/menu/categories/{id}/` | GET | Public | ✅ READY |
| `/menu/items/` | GET | Public | ✅ READY |
| `/menu/items/` | POST | `menu.manage` | ✅ READY |
| `/menu/items/{id}/` | GET | Public | ✅ READY |
| `/menu/items/{id}/` | PATCH | `menu.manage` | ✅ READY |
| `/menu/items/{id}/` | DELETE | `menu.delete` | ✅ READY |
| `/menu/items/featured/` | GET | Public | ✅ READY |
| `/menu/items/popular/` | GET | Public | ✅ READY |
| `/menu/items/search/` | GET | Public | ✅ READY |
| `/menu/items/{id}/related/` | GET | Public | ✅ READY |

### 28.3 Orders

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/orders/` | GET | Authenticated | ✅ READY |
| `/orders/` | POST | Authenticated | ✅ READY |
| `/orders/{id}/` | GET | Authenticated | ✅ READY |
| `/orders/{id}/cancel/` | POST | Authenticated | ✅ READY |
| `/orders/{id}/reorder/` | POST | Authenticated | ✅ READY |
| `/orders/{id}/track/` | GET | Authenticated | ✅ READY |
| `/orders/{id}/status/` | PATCH | `orders.manage` | 🔴 BLOCKED (P8 backend) |
| `/orders/validate-discount/` | POST | Authenticated | ✅ READY |
| `/admin/orders/bulk-status/` | POST | `orders.manage` | ✅ READY |
| `/admin/orders/bulk-cancel/` | POST | `orders.manage` | ✅ READY |

### 28.4 Reservations

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/reservations/` | GET | Authenticated | ✅ READY |
| `/reservations/` | POST | Authenticated | ✅ READY |
| `/reservations/{id}/` | GET | Authenticated | ✅ READY |
| `/reservations/{id}/cancel/` | POST | Authenticated | ✅ READY |
| `/reservations/{id}/confirm/` | POST | `reservations.manage` | 🔴 BLOCKED (P8 backend) |
| `/reservations/available-slots/` | GET | Public | ✅ READY |
| `/admin/reservations/bulk-confirm/` | POST | `reservations.manage` | ✅ READY |
| `/admin/reservations/bulk-cancel/` | POST | `reservations.manage` | ✅ READY |

### 28.5 Payments

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/payments/create-intent/` | POST | Authenticated | ✅ READY |

> Note: `/payments/confirm/` is listed in ENDPOINTS but Stripe card confirmation is done client-side via Stripe SDK. Backend only needs `create-intent`.

### 28.6 Branches

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/branches/` | GET | Public | ✅ READY |
| `/branches/{id}/` | GET | Public | ✅ READY |
| `/branches/nearby/` | GET | Public | ✅ READY |
| `/branches/` | POST | `branches.manage` | ✅ READY |
| `/branches/{id}/` | PATCH | `branches.manage` | ✅ READY |
| `/branches/{id}/activate/` | POST | `branches.manage` | ✅ READY |
| `/branches/{id}/deactivate/` | POST | `branches.manage` | ✅ READY |
| `/branches/{id}/maintenance/` | POST | `branches.manage` | ✅ READY |
| `/branches/{id}/manager/` | PATCH | `branches.manage` | ✅ READY |
| `/branches/{id}/metrics/` | GET | `analytics.view` | ✅ READY |

### 28.7 Users / Profile

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/users/profile/` | GET | Authenticated | ✅ READY |
| `/users/profile/` | PATCH | Authenticated | ✅ READY |
| `/users/avatar/` | POST | Authenticated | ✅ READY |
| `/users/addresses/` | GET | Authenticated | ✅ READY |
| `/users/addresses/` | POST | Authenticated | ✅ READY |
| `/users/addresses/{id}/` | DELETE | Authenticated | ✅ READY |
| `/users/favorites/` | GET | Authenticated | ✅ READY |
| `/users/favorites/{itemId}/` | POST | Authenticated | ✅ READY |

### 28.8 Notifications

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/notifications/` | GET | Authenticated | ✅ READY |
| `/notifications/rich/` | GET | Authenticated | ✅ READY |
| `/notifications/{id}/` | GET | Authenticated | ✅ READY |
| `/notifications/{id}/read/` | POST | Authenticated | ✅ READY |
| `/notifications/read-all/` | POST | Authenticated | ✅ READY |
| `/notifications/{id}/` | DELETE | Authenticated | ✅ READY |
| `/notifications/{id}/archive/` | POST | Authenticated | ✅ READY |
| `/notifications/statistics/` | GET | Authenticated | ✅ READY |
| `/notifications/unread-count/` | GET | Authenticated | ✅ READY |
| `/notifications/summary/` | GET | Authenticated | ✅ READY |
| `/notifications/` | POST | `staff.manage` | ✅ READY |
| `/notifications/register-device/` | POST | Authenticated | ✅ READY |

### 28.9 Tenants

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/tenants/` | GET | `tenants.manage` | ✅ READY |
| `/tenants/{slug}/` | GET | Authenticated | ✅ READY |
| `/tenants/current/` | GET | Authenticated | ✅ READY |
| `/tenants/provision/` | POST | `tenants.manage` | ✅ READY |
| `/tenants/clone/` | POST | `tenants.manage` | ✅ READY |
| `/tenants/{slugOrId}/activate/` | POST | `tenants.manage` | ✅ READY |
| `/tenants/{slugOrId}/suspend/` | POST | `tenants.manage` | ✅ READY |
| `/tenants/{slugOrId}/archive/` | POST | `tenants.manage` | ✅ READY |
| `/tenants/{slug}/settings/` | PATCH | `settings.manage` | ✅ READY |

### 28.10 Reviews, Tables, Admin

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/reviews/` | POST | Authenticated | ✅ READY |
| `/menu/items/{itemId}/reviews/` | GET | Public | ✅ READY |
| `/tables/{tableId}/` | GET | Authenticated | ✅ READY |
| `/tables/{tableId}/order/` | POST | Authenticated | ✅ READY |
| `/admin/stats/` | GET | `analytics.view` | 🔴 BLOCKED (P8 backend) |
| `/admin/customers/` | GET | `customers.view` | 🔴 BLOCKED (P8 backend) |
| `/admin/customers/{id}/` | GET | `customers.view` | ✅ READY |
| `/admin/customers/{id}/stats/` | GET | `customers.view` | 🔴 BLOCKED (P8 backend) |
| `/admin/customers/bulk-export/` | POST | `customers.export` | ✅ READY |

### 28.11 Staff Management

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/tenants/{tenantId}/staff/` | GET | `staff.view` | ✅ READY |
| `/staff/{id}/` | GET | `staff.view` | ✅ READY |
| `/tenants/{tenantId}/invites/` | GET | `staff.view` | ✅ READY |
| `/tenants/{tenantId}/staff/invite/` | POST | `staff.invite` | ✅ READY |
| `/invites/{id}/cancel/` | POST | `staff.manage` | ✅ READY |
| `/invites/{id}/resend/` | POST | `staff.manage` | ✅ READY |
| `/invites/{id}/accept/` | POST | Public (invite token) | ✅ READY |
| `/staff/{id}/roles/` | PATCH | `staff.manage` | ✅ READY |
| `/staff/{id}/activate/` | POST | `staff.manage` | ✅ READY |
| `/staff/{id}/suspend/` | POST | `staff.manage` | ✅ READY |
| `/staff/{id}/remove/` | POST | `staff.manage` | ✅ READY |
| `/tenants/{tenantId}/transfer-ownership/` | POST | `owner` only | ✅ READY |

### 28.12 Loyalty & Promotions

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/loyalty/account/` | GET | Authenticated | ✅ READY |
| `/loyalty/transactions/` | GET | Authenticated | ✅ READY |
| `/loyalty/rewards/` | GET | Authenticated | ✅ READY |
| `/loyalty/rewards/{rewardId}/redeem/` | POST | Authenticated | ✅ READY |
| `/loyalty/earn/` | POST | Authenticated | ✅ READY |
| `/admin/loyalty/rewards/` | GET | `loyalty.manage` | ✅ READY |
| `/admin/loyalty/rewards/` | POST | `loyalty.manage` | ✅ READY |
| `/admin/loyalty/rewards/{id}/` | PATCH | `loyalty.manage` | ✅ READY |
| `/promotions/` | GET | Public | ✅ READY |
| `/promotions/active/` | GET | Public | ✅ READY |
| `/promotions/` | POST | `promotions.manage` | ✅ READY |
| `/promotions/{id}/` | PATCH | `promotions.manage` | ✅ READY |
| `/promotions/{id}/activate/` | POST | `promotions.manage` | ✅ READY |

### 28.13 Vendors

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/vendors/` | GET | Authenticated | ✅ READY |
| `/vendors/{id}/` | GET | Authenticated | ✅ READY |
| `/vendors/{id}/stats/` | GET | `vendors.view` | ✅ READY |
| `/vendors/{id}/settlements/` | GET | `vendors.view` | ✅ READY |
| `/admin/vendors/` | POST | `vendors.manage` | ✅ READY |
| `/admin/vendors/{id}/` | PATCH | `vendors.manage` | ✅ READY |
| `/admin/settlements/` | POST | `vendors.manage` | ✅ READY |

### 28.14 Audit Logs

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/audit-logs/` | GET | `audit_logs.view` | ✅ READY |
| `/audit-logs/{id}/` | GET | `audit_logs.view` | ✅ READY |
| `/audit-logs/` | POST | Any staff (fire-and-forget) | ✅ READY |
| `/audit-logs/timeline/` | GET | `audit_logs.view` | ✅ READY |
| `/audit-logs/export/` | POST | `audit_logs.view` | ✅ READY |
| `/audit-logs/statistics/` | GET | `audit_logs.view` | ✅ READY |

### 28.15 Analytics

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/admin/analytics/summary/` | GET | `analytics.view` | ✅ READY |
| `/admin/analytics/revenue/` | GET | `analytics.view` | ✅ READY |
| `/admin/analytics/reservations/` | GET | `analytics.view` | ✅ READY |
| `/admin/analytics/loyalty/` | GET | `analytics.view` | ✅ READY |
| `/admin/analytics/promotions/` | GET | `analytics.view` | ✅ READY |
| `/admin/analytics/vendors/` | GET | `analytics.view` | ✅ READY |
| `/admin/analytics/menu/` | GET | `analytics.view` | ✅ READY |

### 28.16 Kitchen Display

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/admin/kitchen/status/` | GET | `kitchen.view` | ✅ READY |
| `ws/kitchen/{branchId}/` | WebSocket | `kitchen.view` | ✅ READY |

### 28.17 WebSockets

| Channel | Auth | Status |
|---------|------|--------|
| `ws/orders/{orderId}/` | Authenticated | ✅ READY |
| `ws/notifications/` | Authenticated | ✅ READY |
| `ws/kitchen/{branchId}/` | `kitchen.view` | ✅ READY |
| `ws/admin/dashboard/` | `analytics.view` | ✅ READY |

---

## 29. Known Backend Blockers (P8 Phase)

The following endpoints are called by the frontend but do not yet have confirmed backend implementations. These are **blocking** frontend features.

| # | Endpoint | Method | Blocked Feature | Priority |
|---|----------|--------|----------------|----------|
| B-01 | `/orders/{id}/status/` | PATCH | Admin order status management | HIGH |
| B-02 | `/reservations/{id}/confirm/` | POST | Admin reservation confirmation | HIGH |
| B-03 | `/admin/stats/` | GET | Admin dashboard stats widget | HIGH |
| B-04 | `/admin/customers/` | GET | Admin customer list with filters | MEDIUM |
| B-05 | `/admin/customers/{id}/stats/` | GET | Customer detail stats panel | MEDIUM |
| B-06 | `/admin/orders/` | GET | Dedicated admin order list (currently falls back to `/orders/?admin=true`) | LOW |
| B-07 | `/admin/reservations/` | GET | Dedicated admin reservation list (currently falls back to `/reservations/?admin=true`) | LOW |

> **Workaround currently in place:** `src/services/admin.service.ts` falls back to `/orders/?admin=true` and `/reservations/?admin=true` for B-06 and B-07. The backend can either implement dedicated admin endpoints or add `admin` query param support to the existing list endpoints.

---

*Document generated from actual frontend source code. Do not edit manually — re-derive from `src/services/` and `src/types/` on each major release.*

---

## 30. Marketplace Content API (P8.8.3)

Public-facing business profile content is stored in `Tenant.settings.marketplace` and served through the tenant endpoints below.

### 30.1 Get Marketplace Meta

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/tenants/{slug}/` | GET | Public | ✅ READY (via existing tenant endpoint) |

The `settings.marketplace` object is returned as part of the tenant response. Frontend reads it via `getMarketplaceMeta(tenant.settings)`.

### 30.2 Update Marketplace Meta

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/tenants/{slug}/settings/` | PATCH | `settings.edit` | ✅ READY (via existing settings PATCH) |

**Request body:**
```json
{
  "marketplace": {
    "tagline": "string",
    "description": "string",
    "story": "string",
    "cuisines": ["string"],
    "tags": ["string"],
    "amenities": ["string"],
    "priceLevel": 1,
    "phone": "string",
    "email": "string",
    "website": "string",
    "coverImage": "string",
    "heroImage": "string",
    "gallery": ["string"],
    "socialLinks": {
      "instagram": "string",
      "twitter": "string",
      "facebook": "string",
      "youtube": "string"
    }
  }
}
```

All fields are optional. The backend must merge (not replace) the `marketplace` object to avoid overwriting fields not included in the request.

**Permissions:** `settings.edit` — Admin role required.

**Tenant scope:** The `{slug}` must match the authenticated user's tenant. Super-admins may target any slug.

### 30.3 Marketplace Meta Schema

```typescript
interface MarketplaceMeta {
  // Core identity
  tagline?: string
  description?: string
  story?: string          // Long-form about / story text
  cuisines?: string[]
  tags?: string[]
  amenities?: string[]    // e.g. "WiFi", "Parking", "Outdoor Seating"
  priceLevel?: 1 | 2 | 3 | 4

  // Contact
  phone?: string
  email?: string
  website?: string
  city?: string

  // Media
  coverImage?: string
  heroImage?: string      // Falls back to coverImage if absent
  gallery?: string[]      // Array of image URLs

  // Social
  socialLinks?: {
    instagram?: string
    twitter?: string
    facebook?: string
    youtube?: string
  }

  // Discovery
  primaryBranchSlug?: string
  branches?: PublicBranchInfo[]
  rating?: number
  reviewCount?: number
  isOpen?: boolean
}
```

### 30.4 Branch Scope

Branch-level overrides are not currently supported at the `marketplace` level. Branch-specific data (hours, address, phone) is stored in `Branch` records and aggregated into `meta.branches[]` by the backend when returning the tenant.

### 30.5 Validation Rules

| Field | Validation |
|-------|-----------|
| `priceLevel` | Integer 1–4 |
| `email` | Valid email format |
| `website` | Valid URL (http/https) |
| `coverImage`, `heroImage`, `gallery[]` | Valid URL per entry |
| `socialLinks.*` | Valid URL per entry |
| `gallery` | Max 20 entries recommended |
| `amenities` | Max 20 entries recommended |

### 30.6 Public Endpoints

The following public (unauthenticated) read paths expose marketplace content:

| Path | Data Source |
|------|------------|
| `/{tenantSlug}` | `meta.tagline`, `meta.coverImage`, `meta.branches` |
| `/{tenantSlug}/{branchSlug}` | Branch-scoped, falls back to tenant meta |
| `/restaurant` | `tenantService.getTenant('savor')` → full meta |
| `/discover` | Aggregated across tenants — `tagline`, `coverImage`, `cuisines`, `rating` |

---

## 31. Discovery & Search API (P8.8.4)

The current implementation performs all search, filtering, and sorting client-side. This section specifies the backend endpoints required when the tenant count grows beyond client-side scale (~100+) or when search analytics are needed.

### 31.1 Public Tenant List

Already covered by existing endpoints (section 30). The key query:

```
GET /tenants/?public=true&status=active,trial
```

Returns tenants with full `settings.marketplace` embedded. Used by `usePublicTenants()`.

### 31.2 Server-Side Search (Future)

When client-side filtering is no longer sufficient:

```
GET /tenants/search
```

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Full-text search (name, tagline, description, cuisines, tags, amenities, branch names) |
| `category` | string | Business type key (e.g. `restaurant`, `cafe`) |
| `city` | string | Exact city match |
| `cuisine` | string | Cuisine type match |
| `priceLevel` | `1\|2\|3\|4` | Exact price level |
| `openNow` | boolean | Filter to currently open businesses |
| `amenities` | string (comma-sep) | Must include ALL listed amenities |
| `services` | string (comma-sep) | Feature flag keys, e.g. `reservations.enabled,loyalty.enabled` |
| `sort` | string | One of: `recommended`, `highest_rated`, `most_reviewed`, `newest`, `alphabetical`, `price_asc`, `open_now` |
| `page` | integer | 1-based page number (default: 1) |
| `limit` | integer | Results per page (default: 20, max: 100) |

**Response:**
```json
{
  "data": [Tenant],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 20,
    "hasNext": true
  }
}
```

**Permissions:** Public (no auth required). Only returns `active` and `trial` tenants.

### 31.3 Collections API (Future)

```
GET /discover/collections
```

Returns curated collection definitions. Each collection has a filter spec and a display label. The frontend derives items by applying the filter to the tenant list client-side, or the backend may pre-compute them.

**Response:**
```json
{
  "collections": [
    { "id": "featured", "label": "Featured", "filter": { "featured": true } },
    { "id": "top_rated", "label": "Top Rated", "filter": { "minRating": 4.5, "sort": "highest_rated" } },
    { "id": "family_friendly", "label": "Family Friendly", "filter": { "tags": ["Family Friendly"] } }
  ]
}
```

**Permissions:** Public.

### 31.4 Search Analytics (Future)

```
POST /analytics/search
```

**Body:**
```json
{
  "query": "sushi",
  "filters": { "category": "restaurant", "city": "New York" },
  "resultCount": 3,
  "tenantSlug": null
}
```

Used to track search terms, zero-result queries, and filter usage. Not yet implemented client-side.

### 31.5 Pagination Contract

When pagination is implemented, the frontend will use cursor-based pagination:

```
GET /tenants/search?cursor=<opaque_cursor>&limit=20
```

The `cursor` is returned in the response `meta.nextCursor` field. Offset-based pagination (`page=N`) is acceptable for the initial implementation but not recommended at scale.

### 31.6 Geo / Nearest Sort (Future)

```
GET /tenants/search?lat=40.7128&lng=-74.0060&sort=nearest
```

Requires branch-level coordinates stored in `Branch.location`. Deferred until maps integration is complete.

---

## Section 32 — Business Reviews API (P8.8.5)

### 32.1 List Business Reviews

```
GET /tenants/{tenantId}/reviews/
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `sort` | `newest\|highest\|lowest\|most_helpful` | Sort order (default: newest) |
| `verified` | `boolean` | Filter to verified visits only |
| `with_photos` | `boolean` | Filter to reviews with photos only |
| `branch_id` | `string` | Filter by branch |
| `language` | `string` | Filter by language code (e.g. `en`) |
| `rating` | `1–5` | Filter by exact star rating |
| `page` | `integer` | Page number (1-indexed) |
| `limit` | `integer` | Page size (default: 20, max: 100) |
| `status` | `published\|pending\|hidden\|spam` | Admin only — filter by moderation status |

Response:
```json
{
  "reviews": [ BusinessReview ],
  "total": 1247,
  "breakdown": {
    "average": 4.8,
    "total": 1247,
    "distribution": [
      { "star": 5, "count": 960, "percentage": 77 },
      { "star": 4, "count": 200, "percentage": 16 },
      { "star": 3, "count": 60, "percentage": 5 },
      { "star": 2, "count": 17, "percentage": 1 },
      { "star": 1, "count": 10, "percentage": 1 }
    ]
  }
}
```

### 32.2 Rating Breakdown

```
GET /tenants/{tenantId}/reviews/rating/
GET /tenants/{tenantId}/branches/{branchId}/reviews/rating/
```

Returns `RatingBreakdownData` only (no review list).

### 32.3 Submit Review

```
POST /tenants/{tenantId}/reviews/
```

Body:
```json
{
  "rating": 5,
  "title": "Excellent",
  "comment": "...",
  "visit_date": "2025-12-15",
  "visit_type": "dine_in",
  "images": [],
  "language": "en"
}
```

Response: `BusinessReview` with `status: "pending"`.

Authentication: requires customer session or loyalty token.

### 32.4 Owner Reply

```
POST   /tenants/{tenantId}/reviews/{reviewId}/reply/   — create reply
PATCH  /tenants/{tenantId}/reviews/{reviewId}/reply/   — edit reply
DELETE /tenants/{tenantId}/reviews/{reviewId}/reply/   — delete reply
```

Body (POST/PATCH): `{ "text": "..." }`

Response: updated `BusinessReview`. Requires `reviews.manage` permission.

### 32.5 Helpful Vote

```
POST /tenants/{tenantId}/reviews/{reviewId}/helpful/
```

Idempotent per customer session. Response: `{ "helpful_count": 43 }`.

### 32.6 Moderation

```
PATCH /tenants/{tenantId}/reviews/{reviewId}/moderate/
```

Body: `{ "status": "published" | "hidden" | "spam" | "deleted" | "rejected" }`

Response: updated `BusinessReview`. Requires `reviews.manage` permission.

### 32.7 Review Analytics

```
GET /tenants/{tenantId}/reviews/analytics/
```

Response:
```json
{
  "average_rating": 4.8,
  "total_reviews": 1247,
  "reviews_this_month": 87,
  "trend": "up",
  "trend_delta": 0.2,
  "reply_rate": 0.73,
  "avg_reply_time_hours": 18,
  "breakdown": [ RatingDistribution ],
  "top_keywords": [ { "word": "excellent", "count": 42 } ],
  "monthly_averages": [ { "month": "Dec 2025", "average": 4.8, "count": 87 } ]
}
```

Requires `analytics.view` or `reviews.view` permission.

### 32.8 BusinessReview Schema

```typescript
interface BusinessReview {
  id: string
  tenant_id: string
  branch_id?: string
  customer_id?: string
  customer_name: string
  avatar?: string          // URL
  rating: number           // 1–5
  title?: string
  comment: string
  images?: string[]        // URLs
  visit_date?: string      // ISO date
  visit_type?: 'dine_in' | 'takeaway' | 'delivery'
  created_at: string       // ISO datetime
  updated_at: string
  owner_reply?: OwnerReply
  helpful_count: number
  verified_visit: boolean
  status: 'published' | 'pending' | 'hidden' | 'spam' | 'deleted' | 'rejected'
  language?: string        // BCP 47
  pinned?: boolean
}
```

### 32.9 Tenant Isolation

- All review endpoints are scoped to `tenantId` in the URL.
- Staff with `reviews.view` can see reviews for their tenant only.
- `reviews.manage` required for moderation and owner replies.
- Customers may only submit reviews for tenants they have visited (verified via order history).


---

## 33. Website Builder API (P8.8.6)

Base path: `/tenants/{tenantSlug}/website/`

### 33.1 Layout

**GET** `/tenants/{tenantSlug}/website/layout/`
- Auth: `settings.view` permission
- Response: `HomepageLayout`

**PUT** `/tenants/{tenantSlug}/website/layout/`
- Auth: `settings.view` permission
- Body: `HomepageLayout`
- Response: `HomepageLayout` with `lastSavedAt` set

### 33.2 Publish

**POST** `/tenants/{tenantSlug}/website/publish/`
- Auth: `settings.view` permission
- Body: `HomepageLayout`
- Response: `HomepageLayout` with `status: 'published'`, `lastPublishedAt`, and new entry in `versions[]`

### 33.3 Version History

**GET** `/tenants/{tenantSlug}/website/versions/`
- Auth: `settings.view` permission
- Response: `HomepageVersion[]`

### 33.4 Restore Version

**POST** `/tenants/{tenantSlug}/website/versions/{versionId}/restore/`
- Auth: `settings.view` permission
- Response: `HomepageLayout` restored from the specified version (status → `'draft'`)

### 33.5 Branch Overrides

**GET** `/tenants/{tenantSlug}/branches/{branchSlug}/website/overrides/`
- Auth: `settings.view` permission
- Response: `BranchContentOverrides`

**PUT** `/tenants/{tenantSlug}/branches/{branchSlug}/website/overrides/`
- Auth: `settings.view` permission
- Body: `BranchContentOverrides`
- Response: `BranchContentOverrides`

### 33.6 Media Upload

**POST** `/tenants/{tenantSlug}/website/media/`
- Auth: `settings.view` permission
- Body: `multipart/form-data` with `file` field
- Response: `{ url: string }`
- Use: upload hero background images, gallery images, founder photos

### 33.7 Types

```typescript
interface HomepageLayout {
  sections: SectionConfig[]
  hero: HeroContent
  about: AboutContent
  contact: ContactContent
  faq: FAQItem[]
  theme: ThemeSettings
  navItems?: TenantNavItemConfig[]  // P8.8.11.2 — owner-configurable nav (see below)
  status: 'draft' | 'published'
  lastSavedAt?: string        // ISO 8601
  lastPublishedAt?: string    // ISO 8601
  publishedVersion?: HomepageVersion
  versions?: HomepageVersion[]
}

// P8.8.11.2 — Navigation configuration
// Controls which nav items are shown, their display order, and custom labels.
// When absent, TenantHeader renders the module registry defaults.
interface TenantNavItemConfig {
  key: string       // 'menu' | 'reservation' | 'locations' | 'reviews' | 'loyalty' | etc.
  enabled: boolean
  order: number
  label?: string    // optional custom label (e.g. "Our Menu" instead of "Menu")
}

interface SectionConfig {
  key: 'hero' | 'featured_menu' | 'about' | 'gallery' | 'promotions'
     | 'reviews' | 'branches' | 'events' | 'faq' | 'contact'
  enabled: boolean
  order: number
}

interface BranchContentOverrides {
  heroHeadline?: string
  heroSubheadline?: string
  heroImage?: string
  description?: string
  phone?: string
  gallery?: string[]
  about?: string
}
```

### 33.8 Tenant Isolation

- All website builder endpoints are scoped to `tenantSlug` in the URL.
- `settings.view` permission gates both read and write access.
- Branch overrides are stored per `branchSlug` within the tenant's settings scope.
- Version history is retained server-side; clients receive the last 10 versions.

---

## 34. Platform Customer Identity & Business Relationship Architecture *(added P8.9.6)*

> This section defines the three-layer customer identity model that replaces the legacy flat
> `AdminCustomer` approach. It is the single source of truth for backend implementation.

### 34.1 Domain Model Overview

```
PlatformUser (1)
  └── BusinessCustomer (many — one per tenant where they have interacted)
        ├── loyaltyPoints: number      ← per-tenant, never global
        ├── loyaltyTier                ← per-tenant
        ├── totalSpent                 ← at this tenant only
        └── BranchCustomer (many — one per branch within tenant)
              ├── visits: number
              ├── ordersCount: number
              └── favoriteBranch: boolean
```

**Key invariants (must be enforced by backend):**
1. `PlatformUser` is created once at registration. Phone is the primary key. Never duplicated.
2. `BusinessCustomer` is created only on the customer's first interaction with a tenant (order, reservation, QR scan, payment). Never pre-created.
3. `BranchCustomer` is created on first interaction at a specific branch.
4. All commerce metrics (`totalSpent`, `ordersCount`, `loyaltyPoints`, `loyaltyTier`) are scoped to the `BusinessCustomer`/tenant — never global aggregates.
5. A PlatformUser may have zero BusinessCustomer records (they registered but never placed an order). They may have many (one per business they've visited).

---

### 34.2 PlatformUser Schema

**Type source:** `src/types/index.ts → PlatformUser`

```typescript
interface PlatformUser {
  id: string           // UUID, platform-wide unique
  phone: string        // E.164 format, primary identifier, unique across platform
  name: string         // Full display name
  avatar?: string      // URL to avatar image
  email?: string       // Optional — many customers never provide email
  language?: string    // IETF BCP 47 language tag (e.g. "en", "ar")
  createdAt: string    // ISO 8601
  status: 'active' | 'inactive' | 'suspended'
}
```

**Endpoints:**

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/admin/platform-users/` | Platform Admin | Paginated list with search |
| `GET` | `/admin/platform-users/{id}/` | Platform Admin | Single user detail |
| `PATCH` | `/admin/platform-users/{id}/` | Platform Admin | Update name/status/language |
| `GET` | `/admin/platform-users/{id}/businesses/` | Platform Admin | All BusinessCustomer records for this user |

**Query params for list:** `?search=` (matches phone, name, email), `?status=active|inactive|suspended`, `?page=`, `?page_size=`

---

### 34.3 BusinessCustomer Schema

**Type source:** `src/types/index.ts → BusinessCustomer`

```typescript
interface BusinessCustomer {
  id: string                          // UUID, unique per userId+tenantId pair
  userId: string                      // → PlatformUser.id
  tenantId: string                    // Scopes all metrics to this tenant
  firstInteractionAt: string          // ISO 8601 — when the relationship was created
  lastInteractionAt: string           // ISO 8601 — most recent order/reservation/scan
  ordersCount: number
  reservationsCount: number
  totalSpent: number                  // Decimal, in tenant's currency
  lifetimeValue: number               // Same as totalSpent for now; reserved for future LTV models
  favorite: boolean                   // Admin-flagged as notable customer
  lastBranchId?: string               // → Branch.id of most recent visit
  loyaltyPoints: number               // Current redeemable points at this tenant
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum'
  status: 'active' | 'inactive'
}
```

**Endpoints:**

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/admin/business-customers/` | Owner/Manager (tenant-scoped) | Paginated. Filtered by `tenantId` at the middleware layer |
| `GET` | `/admin/business-customers/{id}/` | Owner/Manager | Single record |
| `GET` | `/admin/business-customers/?userId={id}&tenantId={id}` | Owner/Manager | Lookup by PlatformUser within tenant |
| `PATCH` | `/admin/business-customers/{id}/` | Owner/Manager | Update `favorite`, `status` |
| `GET` | `/admin/business-customers/{userId}/branches/` | Owner/Manager | All BranchCustomer records for this user within the tenant |

**Creation:** Backend MUST auto-create `BusinessCustomer` records when:
- An order is placed by a `PlatformUser` at a tenant for the first time
- A reservation is made by a `PlatformUser` at a tenant for the first time
- A QR check-in is recorded for a `PlatformUser` at a tenant for the first time

---

### 34.4 BranchCustomer Schema

**Type source:** `src/types/index.ts → BranchCustomer`

```typescript
interface BranchCustomer {
  id: string                       // UUID
  businessCustomerId: string       // → BusinessCustomer.id
  branchId: string                 // → Branch.id
  ordersCount: number
  reservationsCount: number
  visits: number                   // Total check-ins/QR scans at this branch
  favoriteBranch: boolean          // True if this is the most-visited branch for this customer
  lastVisit?: string               // ISO 8601
  lastOrder?: string               // ISO 8601
}
```

**Endpoints:**

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/admin/business-customers/{userId}/branches/` | Owner/Manager | All branches this customer has visited within the tenant (pass `?tenantId=`) |
| `GET` | `/admin/branches/{branchId}/customers/` | Branch Manager | All customers who visited this branch |

---

### 34.5 AdminCustomer View (derived — not a stored entity)

The `AdminCustomer` type used in the console customer list/detail pages is a **read-only view** composed server-side from `PlatformUser + BusinessCustomer`. It is not a separate table.

```typescript
interface AdminCustomer {
  id: string              // = PlatformUser.id
  email: string           // = PlatformUser.email ?? ''
  phone: string           // = PlatformUser.phone
  first_name: string      // derived from PlatformUser.name
  last_name: string       // derived from PlatformUser.name
  avatar?: string
  role: 'customer'
  is_verified: boolean    // PlatformUser.status === 'active'
  created_at: string      // PlatformUser.createdAt
  order_count: number     // = BusinessCustomer.ordersCount (tenant-scoped)
  total_spent: number     // = BusinessCustomer.totalSpent (tenant-scoped)
  avg_order_value: number // = totalSpent / ordersCount
  tier: 'new' | 'regular' | 'vip'  // derived from BusinessCustomer.loyaltyTier
  last_order_at?: string  // = BusinessCustomer.lastInteractionAt
}
```

**Backend derivation rule:** When the backend serves `/admin/customers/`, it MUST join PlatformUser + BusinessCustomer filtered to the authenticated staff member's `tenantId`. Cross-tenant data MUST NOT be returned.

---

### 34.6 Loyalty Isolation

`LoyaltyAccount` and `LoyaltyTransaction` MUST include `tenantId`. Loyalty at business A never carries to business B.

```typescript
interface LoyaltyAccount {
  id: string
  userId: string       // → PlatformUser.id
  tenantId: string     // Required — loyalty is per BusinessCustomer relationship
  points: number       // Redeemable
  lifetimePoints: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  tierExpiresAt?: string
  createdAt: string
  updatedAt: string
}

interface LoyaltyTransaction {
  id: string
  accountId: string    // → LoyaltyAccount.id
  tenantId: string     // Denormalized for fast queries; must match LoyaltyAccount.tenantId
  type: 'earn' | 'redeem' | 'expire' | 'adjust'
  points: number       // Negative for redeem/expire
  description: string
  createdAt: string
  referenceId?: string // orderId or rewardId
}
```

**Endpoints (existing — updated to require tenantId):**

| Method | Path | Auth | Change from P6 |
|--------|------|------|---------------|
| `GET` | `/loyalty/account/` | Customer (JWT) | Backend must use `request.tenant` to scope lookup |
| `GET` | `/loyalty/transactions/` | Customer (JWT) | Same — tenant-scoped |
| `POST` | `/loyalty/rewards/{id}/redeem/` | Customer (JWT) | Deduct from tenant-specific account only |
| `POST` | `/loyalty/earn/` | Internal/Order service | Must pass `tenantId` in payload |

---

### 34.7 Frontend Mock Data Reference

For development/QA, the frontend provides pre-built mock data in `src/lib/mock-data.ts`:

| Export | Count | Notes |
|--------|-------|-------|
| `MOCK_PLATFORM_USERS` | 32 | pu-001 through pu-032; phone-primary; varied statuses |
| `MOCK_BUSINESS_CUSTOMERS` | 48 | Distributed across 6 tenants; cross-tenant users demonstrated |
| `MOCK_BRANCH_CUSTOMERS` | 40 | Per-branch breakdown for MOCK_BUSINESS_CUSTOMERS |
| `MOCK_LOYALTY_ACCOUNTS` | 15 | All include `tenantId`; independently scoped per tenant |

**Cross-tenant user example (pu-001 / Alice Johnson):**
- `tenant-savor-01`: 14 orders, gold tier, 2,840 pts
- `tenant-brew-cafe-01`: 31 orders, gold tier, 1,580 pts
- `tenant-wheels-brews-01`: 25 orders, gold tier, 3,200 pts

These three records are completely independent; Alice's loyalty at Savor never affects Brew Café.


---

## Section 35 — Customer 360° CRM API (P8.9.7)

This section documents all new API endpoints introduced in P8.9.7 for the unified Customer 360° CRM experience. All endpoints are tenant-scoped: the backend MUST enforce that the requesting admin user belongs to the tenant and has `customers.view` permission (or higher). Cross-tenant access MUST return 403.

### 35.1 Customer Timeline

```
GET /admin/customers/{userId}/timeline/?tenant_id={tenantId}
```

Returns a chronological list of all customer interactions for the given `(userId, tenantId)` pair. Sorted descending by `created_at` (most recent first).

**Query params:** `tenant_id` (required), `limit` (default 100), `offset` (default 0), `type` (optional, comma-separated event type filter)

**Response:**
```json
{
  "count": 42,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "evt-001",
      "user_id": "pu-001",
      "tenant_id": "tenant-savor-01",
      "type": "order_placed",
      "title": "Order placed at Downtown Branch",
      "description": "3 items — Grilled Salmon, Caesar Salad, Sparkling Water",
      "amount": 67.50,
      "points": 68,
      "branch_id": "br-001",
      "reference_id": "ord-301",
      "reference_type": "order",
      "actor_id": null,
      "actor_name": null,
      "metadata": {},
      "created_at": "2025-01-20T19:30:00Z"
    }
  ]
}
```

**Event types (28 total):**
`account_created`, `first_visit`, `order_placed`, `order_completed`, `order_cancelled`, `order_refunded`, `reservation_made`, `reservation_confirmed`, `reservation_completed`, `reservation_cancelled`, `reservation_no_show`, `points_earned`, `points_redeemed`, `reward_redeemed`, `tier_upgraded`, `tier_downgraded`, `coupon_received`, `coupon_redeemed`, `review_posted`, `payment_completed`, `refund_issued`, `admin_note`, `tag_added`, `tag_removed`, `marketing_email`, `marketing_sms`, `profile_updated`, `phone_verified`, `birthday`

---

### 35.2 Customer Notes

Notes are private tenant-scoped annotations written by admin users about a customer. They are NEVER shown to the customer.

```
GET    /admin/customers/{userId}/notes/?tenant_id={tenantId}
POST   /admin/customers/{userId}/notes/
PATCH  /admin/customers/{userId}/notes/{noteId}/
DELETE /admin/customers/{userId}/notes/{noteId}/
```

**GET response:**
```json
{
  "count": 3,
  "results": [
    {
      "id": "note-001",
      "user_id": "pu-001",
      "tenant_id": "tenant-savor-01",
      "content": "Prefers window seats, allergic to shellfish.",
      "author_id": "admin-001",
      "author_name": "Sarah Admin",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

**POST body:**
```json
{ "user_id": "pu-001", "tenant_id": "tenant-savor-01", "content": "Note text..." }
```

**PATCH body:** `{ "content": "Updated note text..." }`

**Permissions:** `customers.notes.manage`. Admins can only delete their own notes unless they have `customers.notes.delete_any`.

---

### 35.3 Customer Tags

Tags are tenant-specific labels that can be assigned to customers. Tags are created at the tenant level and then assigned to individual customers.

```
GET    /admin/tags/?tenant_id={tenantId}                        # list tag definitions
GET    /admin/customers/{userId}/tags/?tenant_id={tenantId}     # get assigned tags
PATCH  /admin/customers/{userId}/tags/                          # set assigned tags (replaces all)
```

**GET /admin/tags/ response:**
```json
{
  "results": [
    {
      "id": "tag-vip",
      "tenant_id": "tenant-savor-01",
      "label": "VIP",
      "color": "purple",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**GET /admin/customers/{userId}/tags/ response:**
```json
{
  "user_id": "pu-001",
  "tenant_id": "tenant-savor-01",
  "tags": [ { "id": "tag-vip", "label": "VIP", "color": "purple", "created_at": "..." } ]
}
```

**PATCH /admin/customers/{userId}/tags/ body:**
```json
{ "tenant_id": "tenant-savor-01", "tag_ids": ["tag-vip", "tag-frequent"] }
```

Replaces the full set of assigned tags. Empty array removes all tags. Tags not belonging to the tenant MUST be rejected with 400.

**Tag colors:** `gray`, `blue`, `green`, `yellow`, `red`, `purple`, `orange`

---

### 35.4 Customer Analytics

Per-customer behavioural analytics, computed server-side (e.g., via a background job or DB view). Read-only.

```
GET /admin/customers/{userId}/analytics/?tenant_id={tenantId}
```

**Response:**
```json
{
  "user_id": "pu-001",
  "tenant_id": "tenant-savor-01",
  "lifetime_value": 2847.50,
  "avg_order_value": 52.25,
  "avg_reservation_party_size": 2.8,
  "visit_frequency_days": 12,
  "days_since_last_visit": 4,
  "favorite_branch_id": "br-001",
  "favorite_branch_name": "Downtown Branch",
  "favorite_weekday": "Friday",
  "favorite_hour": 19,
  "favorite_categories": ["Mains", "Desserts"],
  "favorite_items": [
    { "name": "Grilled Salmon", "count": 14 },
    { "name": "Truffle Pasta", "count": 11 }
  ],
  "revenue_by_month": [
    { "month": "2024-09", "revenue": 312.00 },
    { "month": "2024-10", "revenue": 425.50 }
  ],
  "visits_by_month": [
    { "month": "2024-09", "visits": 5 },
    { "month": "2024-10", "visits": 7 }
  ],
  "points_by_month": [
    { "month": "2024-09", "points": 312 },
    { "month": "2024-10", "points": 426 }
  ]
}
```

Returns 404 if no analytics are available yet for this `(userId, tenantId)` pair.

---

### 35.5 Customer Marketing

Marketing channel preferences, campaign history, and coupon usage summary.

```
GET /admin/customers/{userId}/marketing/?tenant_id={tenantId}
```

**Response:**
```json
{
  "user_id": "pu-001",
  "tenant_id": "tenant-savor-01",
  "preferences": [
    { "channel": "email", "subscribed": true, "subscribed_at": "2024-06-01T00:00:00Z", "unsubscribed_at": null },
    { "channel": "sms", "subscribed": true, "subscribed_at": "2024-06-01T00:00:00Z", "unsubscribed_at": null },
    { "channel": "push", "subscribed": false, "subscribed_at": null, "unsubscribed_at": "2024-09-15T00:00:00Z" },
    { "channel": "whatsapp", "subscribed": false, "subscribed_at": null, "unsubscribed_at": null }
  ],
  "campaigns": [
    {
      "id": "camp-001",
      "name": "Summer Loyalty Bonus",
      "channel": "email",
      "sent_at": "2025-01-10T09:00:00Z",
      "opened": true,
      "opened_at": "2025-01-10T11:30:00Z",
      "clicked": true,
      "clicked_at": "2025-01-10T11:32:00Z"
    }
  ],
  "coupons_received": 4,
  "coupons_redeemed": 2,
  "last_campaign_at": "2025-01-10T09:00:00Z"
}
```

**Channels:** `email`, `sms`, `push`, `whatsapp`

---

### 35.6 Customer Coupons

```
GET /admin/customers/{userId}/coupons/?tenant_id={tenantId}
```

**Query params:** `status` (optional: `available` | `redeemed` | `expired`)

**Response:**
```json
{
  "count": 4,
  "results": [
    {
      "id": "coup-001",
      "user_id": "pu-001",
      "tenant_id": "tenant-savor-01",
      "code": "ALICE10",
      "description": "10% off your next order",
      "discount_type": "percent",
      "discount_value": 10.0,
      "min_order_amount": 30.0,
      "status": "available",
      "redeemed_at": null,
      "expires_at": "2025-06-30T23:59:59Z",
      "created_at": "2025-01-10T09:00:00Z"
    }
  ]
}
```

**Discount types:** `percent`, `fixed`
**Statuses:** `available`, `redeemed`, `expired`

---

### 35.7 Customer Payments

```
GET /admin/customers/{userId}/payments/?tenant_id={tenantId}
```

**Query params:** `limit` (default 20), `offset` (default 0)

**Response:**
```json
{
  "count": 54,
  "results": [
    {
      "id": "pay-001",
      "user_id": "pu-001",
      "tenant_id": "tenant-savor-01",
      "order_id": "ord-301",
      "amount": 67.50,
      "currency": "USD",
      "method": "card",
      "status": "completed",
      "refund_amount": null,
      "processed_at": "2025-01-20T19:30:00Z"
    }
  ]
}
```

**Methods:** `card`, `cash`, `wallet`, `gift_card`
**Statuses:** `completed`, `refunded`, `partial_refund`, `failed`

---

### 35.8 Tenant Isolation Rules (CRM)

All CRM data (notes, tags, analytics, marketing, coupons, payments, timeline) MUST be isolated per `(userId, tenantId)` pair:

1. Notes written by tenant A's admin are NEVER accessible to tenant B's admin.
2. Tag definitions are per-tenant; assigning tenant A's tag to a customer at tenant B MUST return 400.
3. Analytics are computed separately per tenant — a customer's LTV at tenant A has no relation to their LTV at tenant B.
4. Marketing preferences are per-channel per-tenant — a customer may be subscribed to email at tenant A but unsubscribed at tenant B.
5. Coupons issued by tenant A are NEVER redeemable at tenant B.
6. Timeline events are filtered by `tenant_id` — admins only see events for their own tenant.

---

### 35.9 Frontend Mock Coverage

| Export | Count | Notes |
|--------|-------|-------|
| `MOCK_CUSTOMER_NOTES` | 7 | Notes for pu-001, pu-003, pu-005, pu-009, pu-015 at `tenant-savor-01` |
| `MOCK_CUSTOMER_TAG_DEFINITIONS` | 9 | VIP, High Value, Frequent Visitor, Corporate, Allergy Alert, Birthday, Family, New Customer, Inactive |
| `MOCK_CUSTOMER_TAG_ASSIGNMENTS` | 7 entries | Keyed by `"userId:tenantId"` |
| `MOCK_CUSTOMER_ANALYTICS` | 3 | pu-001, pu-003, pu-005 at `tenant-savor-01` |
| `MOCK_CUSTOMER_MARKETING` | 3 | pu-001, pu-003, pu-005 at `tenant-savor-01` |
| `MOCK_CUSTOMER_COUPONS` | 8 | pu-001, pu-003, pu-005 at `tenant-savor-01` |
| `MOCK_CUSTOMER_TIMELINE` | ~36 events | pu-001 (22 events), pu-003 (6), pu-005 (6) at `tenant-savor-01` |

---

## 36. Platform Configuration API (P9.0)

> **Contract only — no backend implementation exists yet.** Generated from
> `src/config/types.ts` and `src/config/service.ts` (P9.0 Platform
> Configuration Foundation). Per Rule 8 (API Follows Registry), this contract
> is derived from the configuration schema — the schema was never derived
> from an API design. Requires `settings.view` to read, `settings.manage`
> (or the field's own `permissions.edit` key) to write. Feature-flag fields
> additionally require `featureflags.manage`.
>
> Frontend reference implementation: `src/config/service.ts`
> (`configurationService`). The frontend currently holds overrides in an
> in-memory mock store (`ConfigOverrideStore`) that mirrors the
> `platform_configuration_overrides` table this contract implies — swapping
> the mock store for these real endpoints requires no change to
> `ConfigurationResolver`, `ConfigurationValidator`, or any hook.

### 36.1 List Modules

**Method:** `GET`
**Path:** `/admin/config/modules/`

Returns every registered module's metadata (no field values) — id, name,
description, category, version, permissions, featureFlag, dependencies. Used
to render the Console settings index page (P9.1+).

**Success Response `200`:**
```json
{
  "results": [
    {
      "id": "themes",
      "name": "Themes",
      "description": "Default brand palette and the CSS variables tenants are permitted to override.",
      "category": "branding",
      "version": "1.0.0",
      "icon": "Palette",
      "permissions": { "view": "settings.view", "edit": "settings.manage" },
      "dependencies": [{ "moduleId": "typography", "reason": "Theme preview renders using the configured font stack." }]
    }
  ]
}
```

**Source:** `src/config/registry.ts` (`platformConfigurationRegistry.getModules()`)

### 36.2 Get Module Schema + Resolved Values

**Method:** `GET`
**Path:** `/admin/config/modules/{moduleId}/`
**Query params:** `tenant_id`, `branch_id`, `user_id` (all optional — omitted levels are not resolved against)

Returns the module's full section/field schema, each field's resolved value
for the given scope, which level the value resolved from, and whether an
override attempt was blocked by a locked field.

**Success Response `200`:**
```json
{
  "module": { "id": "themes", "name": "Themes", "version": "1.0.0" },
  "sections": [
    {
      "id": "themes.palette",
      "title": "Palette",
      "fields": [
        {
          "id": "themes.primary_color",
          "title": "Primary Color",
          "type": "color",
          "default": "#f97316",
          "validation": {},
          "visibility": "admin_only",
          "permissions": { "view": "settings.view", "edit": "settings.manage" },
          "preview": { "kind": "swatch" },
          "inheritance": { "level": "platform", "canOverride": true, "mode": "override", "fallback": "inherit" },
          "resolved": { "value": "#0ea5e9", "resolvedFrom": "tenant", "overrideBlocked": false }
        }
      ]
    }
  ]
}
```

**Errors:** `404` unknown `moduleId`. `403` caller lacks the module's `permissions.view`.

**Source:** `src/config/service.ts` (`configurationService.resolveModule()`)

### 36.3 Get / Update a Single Field

**Method:** `GET`
**Path:** `/admin/config/fields/{fieldId}/`
**Query params:** `tenant_id`, `branch_id`, `user_id`

**Method:** `PATCH`
**Path:** `/admin/config/fields/{fieldId}/`

**Request Body:**
```json
{
  "value": "#0ea5e9",
  "level": "tenant",
  "tenant_id": "tenant-savor-01",
  "reason": "Rebrand to match new signage"
}
```

**Validation (400 on failure):** the value is checked against the field's
`type` and `validation` block (`required`/`min`/`max`/`minLength`/
`maxLength`/`pattern`/`enumValues`) exactly as implemented by
`src/config/validator.ts`.

**Permission (403 on failure):** caller must hold the field's
`permissions.edit` key.

**Inheritance (409 on failure):** if `level` is below the field's
`inheritance.level` and the field's `inheritance.canOverride` is `false` or
`inheritance.mode` is `"locked"`, the write is rejected with the level the
field is actually locked at.
```json
{ "error": "field_locked", "lockedAtLevel": "platform" }
```

**Reason required (400 on failure):** if the field's `audit.requireReason`
is `true` and no `reason` is supplied.

**Success Response `200`:** same shape as the `resolved` object in §36.2,
recomputed after the write.

**Source:** `src/config/service.ts` (`configurationService.updateField()`)

### 36.4 Audit Trail

**Method:** `GET`
**Path:** `/admin/config/audit/`
**Query params:** `field_id`, `tenant_id`, `branch_id`, `user_id` (any combination filters)

**Success Response `200`:**
```json
{
  "results": [
    {
      "id": "cfg-audit-1",
      "fieldId": "themes.primary_color",
      "scope": { "tenantId": "tenant-savor-01" },
      "level": "tenant",
      "actorId": "staff-001",
      "actorName": "Alice Chen",
      "reason": "Rebrand to match new signage",
      "previousValue": "#f97316",
      "newValue": "#0ea5e9",
      "timestamp": "2026-06-01T10:00:00Z"
    }
  ]
}
```

Fields whose schema sets `audit.sensitive: true` (e.g. `payments.stripe_secret_key`)
MUST have `previousValue`/`newValue` redacted to `"••••••"` in the response —
never store or return the plaintext secret in an audit entry.

**Source:** `src/config/audit.ts`

### 36.5 Rollback

**Method:** `POST`
**Path:** `/admin/config/audit/{auditEntryId}/rollback/`

Re-applies `previousValue` from the named audit entry as a new write (through
the same validation/permission/audit path as §36.3 — a rollback is itself an
audited change, not a raw restore).

**Errors:** `404` unknown audit entry id. `409` if the field's current value
has since changed at a level that would make the rollback ambiguous
(implementation may instead always apply — left to backend design;
frontend's `configurationAudit.getRollbackValue()` only returns the value,
it does not decide rollback semantics).

### 36.6 Version History

**Method:** `GET`
**Path:** `/admin/config/modules/{moduleId}/versions/`

**Success Response `200`:**
```json
{
  "results": [
    { "moduleId": "themes", "version": "1.0.0", "changedAt": "2026-07-04T00:00:00Z", "changeNote": "Initial P9.0 registration" }
  ]
}
```

**Source:** `src/config/version-manager.ts`

### 36.7 Permission Summary

All Platform Configuration endpoints share this permission model:

| Action | Required permission |
|---|---|
| Read any module/field | `settings.view` (the requesting caller must additionally hold that specific field's `permissions.view`, which for most fields is also `settings.view`) |
| Write a field | The field's own `permissions.edit` (commonly `settings.manage`; `featureflags.manage` for `feature_flags.*` fields; `tenant.manage` for `subscriptions.*`; `staff.manage` for `rbac.*`) |
| View audit trail | Same as read (`settings.view` + field-level `permissions.view`) |
| Rollback | Same as write for the field being rolled back |

No new permission strings are introduced by this contract — it reuses the
existing catalog in `src/types/rbac.ts` (Rule 3 — Single Source of Truth).

## 37. Platform Administration API (P9.4)

> **Contract only — no backend implementation exists yet.** Generated from
> `src/platform-admin/*` (P9.4 Platform Administration Center). Every
> module registered in `src/platform-admin/modules/*` is an ordinary
> `ConfigModuleDefinition` — its read/write/audit/rollback/version-history
> endpoints are **exactly §36.1–§36.6 above**, not a new set of routes; a
> backend implementing §36 already implements config-backed reads/writes
> for Tenants, Platform Users, Billing, Plans, and every other registered
> Platform Administration module for free. This section documents only the
> genuinely new endpoints §36 has no equivalent for: the dashboard, the
> platform permission model, platform-wide (cross-tenant) audit/activity,
> cross-entity search, and monitoring/health/metrics readouts.
>
> Frontend reference implementation: `src/platform-admin/dashboard.ts`
> (`platformDashboardRegistry`), `src/platform-admin/search.ts`
> (`platformSearchRegistry`), `src/platform-admin/permissions.ts`. All three
> currently compute/return illustrative mock values — see each file's own
> doc comment for the extension point a real backend would replace.

### 37.1 Platform Permission Model

**Method:** `GET`
**Path:** `/admin/platform/me/permissions/`

Returns the authenticated platform user's `PlatformRole` and effective
`PlatformPermission` grants (§`src/platform-admin/permissions.ts`) —
**completely separate from** `/me/permissions` for tenant `P7Permission`s
(§ existing RBAC contract). A platform user has exactly one `PlatformRole`;
unlike tenant RBAC there are no per-resource overrides in this model.

**Success Response `200`:**
```json
{
  "userId": "u-owner-1",
  "role": "platform_admin",
  "permissions": [
    "platform.dashboard.view",
    "platform.users.view", "platform.users.manage",
    "platform.businesses.view", "platform.businesses.manage"
  ]
}
```

**Errors:** `403` if the authenticated user has no platform role at all
(i.e. a tenant-only user attempting to reach the Platform Administration
Center — this must be checked **before** any tenant permission check, the
two systems never combine).

**Source:** `src/platform-admin/permissions.ts` (`PLATFORM_ROLE_PERMISSIONS`, `hasPlatformPermission`)

### 37.2 Platform Dashboard Widgets

**Method:** `GET`
**Path:** `/admin/platform/dashboard/widgets/`

Returns every widget the caller's platform role can see plus its current
computed value — the backend equivalent of
`platformDashboardRegistry.getWidgets()` filtered by
`hasPlatformPermission()` and each widget's `compute()`.

**Success Response `200`:**
```json
{
  "results": [
    { "id": "active_businesses", "title": "Active Businesses", "kind": "stat", "value": 6, "deltaPercent": 12 },
    { "id": "server_health", "title": "Server Health", "kind": "status", "state": "operational", "label": "All systems operational" },
    { "id": "top_countries", "title": "Top Countries", "kind": "list", "items": [{ "label": "United States", "value": "38%" }] }
  ]
}
```

A future widget (e.g. a CRM module's "Open Leads") requires no new endpoint
— it is simply one more entry in this same response, exactly as a future
Configuration module requires no new endpoint under §36.1.

**Source:** `src/platform-admin/dashboard.ts`, `src/platform-admin/widgets.ts`

### 37.3 Platform-Wide Audit & Activity

**Method:** `GET`
**Path:** `/admin/platform/audit/`

**Query params:** `moduleId?`, `fieldId?`, `actorId?`, `level?`,
`since?`, `until?`, `q?` (free-text over actorName/reason)

Cross-tenant, cross-module audit trail — distinct from §36.4 (one field's
own audit history) and from each tenant's own audit log (existing P7/P8
contract, out of scope here). Backs the toolbar's module-wide History
drawer (`ConfigurationStudioToolbar`, P9.3) when it's asked to show more
than one field's history at once, and the `platform.audit_logs`/
`platform.activity_logs` modules' own retention settings (§36, same
endpoints as any other config module).

**Success Response `200`:** paginated array of the same audit-entry shape
as §36.4, with an added `fieldTitle`/`moduleId`/`moduleName` for display
without a second round-trip.

**Source:** `src/config/audit.ts` (`configurationAudit.listForField`, called once per field today — a real backend would index audit entries across fields instead of requiring N calls)

### 37.4 Platform Search

**Method:** `GET`
**Path:** `/admin/platform/search/?q={query}`

Cross-entity search backing the command palette's entity-hit results
(`platformSearchRegistry.searchAll`, P9.4 Phase F) — Businesses, Platform
Users, Countries today; any future registered provider (Subscriptions,
Support Tickets, …) adds its results to this same endpoint's response, not
a new one.

**Success Response `200`:**
```json
{
  "results": [
    { "id": "platform.tenants.registry:brew-cafe", "label": "Brew Cafe", "hint": "brew-cafe", "moduleId": "platform.tenants" }
  ]
}
```

**Source:** `src/platform-admin/search.ts`, `src/platform-admin/search-providers.ts`

### 37.5 Monitoring, Health & Metrics

**Method:** `GET`
**Path:** `/admin/platform/health/`

Returns current service health (used by the `platform.health` module's
settings *and* the `server_health`/`queue_status` dashboard widgets — the
same underlying data, two presentations).

**Success Response `200`:**
```json
{ "status": "operational", "services": [{ "name": "api", "status": "operational", "latencyMs": 42 }] }
```

**Method:** `GET`
**Path:** `/admin/platform/metrics/?window={hourly|daily|weekly}`

Returns the aggregated metrics backing the Monitoring-group dashboard
widgets (Error Rate, API Usage, Storage Usage, …) at the configured
`platform.metrics.sample_rate_percent` (§36, same field).

**Source:** `src/platform-admin/modules/monitoring.ts`, `src/platform-admin/widgets.ts`

### 37.6 Permission Summary

| Action | Required permission |
|---|---|
| View platform dashboard | `platform.dashboard.view` |
| Read/write a Platform Administration module's fields | That module's own `platformPermission` (§37.1) — falls back to `settings.view`/`settings.manage` (§36.7) for the field-level check, since every module is still an ordinary `ConfigFieldDefinition` underneath |
| Platform-wide audit/activity | `platform.monitoring.view` |
| Cross-entity search | Same permission as the underlying module for each result (a search hit for a Tenant is only returned if the caller holds `platform.businesses.view`) |
| Monitoring/health/metrics | `platform.monitoring.view`; mutating thresholds requires `platform.monitoring.manage` |

Platform permissions (`platform.*`) and tenant permissions (`P7Permission`,
`src/types/rbac.ts`) are never combined in one check — see
`docs/P9.4_PLATFORM_ADMIN_CENTER.md` for the full separation rationale.

## 38. Localization API (P9.5.0 — architecture only, no implementation)

> **Contract only — no backend implementation exists, and no frontend code
> was written for this section.** Generated from
> `docs/P9.5.0_LOCALIZATION_ARCHITECTURE.md`,
> `docs/P9.5.0_TRANSLATION_ARCHITECTURE.md`, and
> `docs/P9.5.0_LANGUAGE_LIFECYCLE.md`. Every endpoint below is either (a) an
> ordinary Platform Configuration endpoint (§36) applied to the new
> `localization.languages`/`localization.fonts`/
> `localization.translation_keys` collection fields, or (b) one of the few
> genuinely new endpoints those documents identified (coverage, import/
> export, fallback resolution). Requires `platform.localization.view` to
> read, `platform.localization.manage` to write — **never** a tenant
> `P7Permission`, per `P9.5.0_LANGUAGE_LIFECYCLE.md` §6.

### 38.1 Language Registry — implemented P9.5.5 as `platform.languages`

> **Naming reconciliation**: this section originally anticipated a
> `localization.languages` module id. When actually implemented (P9.5.5,
> `src/platform-admin/modules/languages.ts`), the module was registered as
> `platform.languages` (field id `platform.languages.registry`) instead —
> matching how every other Platform-Admin-only module in this codebase is
> named (`platform.tenants`, `platform.users`, …) and gated
> (`platformPermission`, P9.4's mechanism, not a new one). The endpoint
> shapes below are unchanged from what this section always specified;
> only the module/field id segment differs from the original placeholder
> name. Update any earlier integration planning that assumed
> `localization.languages` to use `platform.languages` instead.

Reuses §36.1–§36.6 verbatim against the `platform.languages.registry`
collection field — `GET /admin/config/modules/platform.languages/`,
`GET/PUT /admin/config/fields/platform.languages.registry/`, etc. already
cover list/read/write/audit/rollback/version-history for every language
entity, exactly as they do for `countries.registry` (P9.2) and
`platform.tenants.registry` (P9.4). No new routes for basic CRUD.

Requires `platform.localization.view` to read, `platform.localization.manage`
to write (`src/platform-admin/permissions.ts`, P9.5.5 Phase K) — never a
tenant `P7Permission`; no tenant, owner, or branch role can reach this
module, matching this section's original permission requirement exactly.

**Collection schema** (`~30` properties per language entity — see
`docs/P9.5.5_LANGUAGE_MANAGEMENT.md` for the full table): identity
(`nativeName`/`englishName`/`region`/`searchKeywords`/`notes`), lifecycle
(`status`/`enabled`/`visibility`/`default`/`beta`/`experimental`/
`lastUpdated`/`translator`), coverage (`translationCoverage`/
`completionPercent`/`machineTranslated`/`humanReviewed`), formatting
(`currency`/`timezone`/`dateStyle`/`hourCycle`/`numberNotation`/
`pluralRules`/`fallbackLanguage`), direction (`direction`/`rtl`), and
typography (`fontFamily`/`secondaryFontFamily`/`headingFontFamily`/
`monoFontFamily`/`fontScale`/`lineHeight`/`letterSpacing`/`fontWeight`).

**Cross-entity validation**: a backend implementing writes to this
collection MUST additionally run the same checks
`validateLanguageCollection()` (`src/platform-admin/modules/languages.ts`)
performs client-side before persisting a write — at most one `default:
true`, `direction`/`rtl` agreement, required metadata present before
`status: 'published'`, and no `fallbackLanguage` cycle. These are
cross-entity invariants the generic per-field validation contract (§36)
cannot express (see `docs/P9.5.5_LANGUAGE_MANAGEMENT.md`'s "Activation
workflow" section for why), so a real backend needs its own equivalent
check at write time, not just client-side.

### 38.1.1 Language Coverage Dashboard widgets — implemented P9.5.5

Four `platformDashboardRegistry` widgets
(`src/platform-admin/widgets.ts`) compute from the same
`platform.languages.registry` collection value §36's generic read
endpoint already returns — a backend needs no new endpoint for these,
only for the underlying collection read `GET /admin/config/fields/platform.languages.registry/`
each widget's `compute()` would call: `operational_languages` (enabled
count / roster size), `avg_translation_coverage` (mean
`translationCoverage` across enabled languages), `human_reviewed_languages`
(count with `humanReviewed: true`), `lowest_coverage_languages` (3
lowest-coverage enabled languages). All four require
`platform.localization.view`.

### 38.2 Translation Keys

**Method:** `GET`
**Path:** `/admin/localization/translation-keys/?namespace={ns}&language={lang}&status={status}`

Returns `(namespace, key, language)` triples (§`P9.5.0_LOCALIZATION_ARCHITECTURE.md`
§3) matching the filters — also reachable via the generic collection
endpoints (§36) against `localization.translation_keys`, but exposed as
its own path too since namespace/language filtering on a 150-language ×
N-key collection is a common enough access pattern to warrant a dedicated,
indexed query rather than requiring the client to filter a full collection
dump.

**Success Response `200`:**
```json
{
  "results": [
    { "id": "checkout.confirm_button.fa", "namespace": "checkout", "key": "confirm_button", "language": "fa", "value": "تأیید", "status": "reviewed" }
  ]
}
```

### 38.3 Coverage

**Method:** `GET`
**Path:** `/admin/localization/coverage/?language={lang}`

Returns the computed coverage percentage (§`P9.5.0_LOCALIZATION_ARCHITECTURE.md`
§3 — never manually stored) per namespace and overall, backing both each
language entity's own `translation_coverage_percent` display and a future
Platform Dashboard widget (reusing `platformDashboardRegistry`, P9.4).

**Success Response `200`:**
```json
{ "language": "tr", "overall": 42, "byNamespace": { "checkout": 80, "dashboard": 10 } }
```

### 38.4 Import / Export

**Method:** `POST`
**Path:** `/admin/localization/export/`
**Body:** `{ "languages": ["fa","ar"], "namespaces": ["checkout"] }` (omit for all enabled languages/namespaces)

Returns one JSON file per `(language, namespace)` in the response
(zipped for a multi-file response), in the exact shape
`src/i18n/locales/en.json` already uses (§`P9.5.0_TRANSLATION_ARCHITECTURE.md`
§4/§8 — chosen specifically so no change to `next-intl`'s loading code is
required).

**Method:** `POST`
**Path:** `/admin/localization/import/`
**Body:** one or more `(language, namespace)` JSON files, same shape.

Runs the four detection checks (missing/unused/duplicate/conflict,
§`P9.5.0_TRANSLATION_ARCHITECTURE.md` §7) before applying; a conflict
(§4) returns `409` with the competing values rather than silently
resolving one.

### 38.5 Fallback Resolution

**Method:** `GET`
**Path:** `/admin/localization/resolve/?namespace={ns}&key={key}&language={lang}`

Returns the resolved value for one key, walking the fallback chain
(§`P9.5.0_TRANSLATION_ARCHITECTURE.md` §6) server-side — a debugging/
verification endpoint, not the runtime hot path (the runtime hot path is
still `next-intl`'s own per-request bundle load, §`P9.5.0_PERFORMANCE_STRATEGY.md`
§2).

**Success Response `200`:**
```json
{ "value": "تأیید", "resolvedFrom": "fa", "chain": ["fa"] }
```
or, for a key missing in the requested language:
```json
{ "value": "Confirm", "resolvedFrom": "en", "chain": ["fa-IR", "fa", "en"] }
```

### 38.6 Permission Summary

| Action | Required permission |
|---|---|
| Read language registry, translation keys, coverage | `platform.localization.view` |
| Write/enable/disable a language, edit a translation, import/export | `platform.localization.manage` |
| Promote a language `beta` → `stable` | `platform.localization.manage` **and** the stable-promotion gate (`P9.5.0_LANGUAGE_LIFECYCLE.md` §5) passing |
| Tenant override of `languages.default`, or a language's `default_currency`/`default_timezone` for that tenant only | The existing tenant `settings.manage` permission (§36.7) — unrelated to `platform.localization.*`, since this is an ordinary inheritance-chain override (Rule 4), not a platform-level change |

`platform.localization.*` is never checked against a tenant `P7Permission`
array, and `settings.manage` never grants access to enable/disable a
language platform-wide — the same hard separation §37.6 already documents
for the rest of the Platform Administration Center.

### 38.7 Language Administration Center additions (P9.5.6)

Everything below composes the endpoints §36 (Collection Framework) and
§38.1–38.6 already define — no new resource types, just concrete request/
response shapes for capabilities added client-side this phase.

**Cross-entity validation (`ConfigCollectionMeta.validateEntries`,
`validateLanguageCollection`)** — a real backend must run the equivalent
check server-side before persisting a write, not just client-side (the
client-side hook is a UX convenience, never the source of truth):

```
POST /admin/config/fields/platform.languages.registry/validate
Body: the full collection value being considered for write
200: { "errors": [{ "code": "fa", "message": "..." }] }  // empty array = valid
```

**Publish gating** — `POST /admin/config/fields/platform.languages.registry/`
(§36's existing write endpoint) with a `status: 'published'` patch on one or
more entities MUST run the same validation above server-side and reject
the whole batch (`400`) with the same `{ "errors": [...] }` shape on
failure, matching the client's `useConfigurationBulkActions` behavior
(reject-the-batch, not partial-apply).

**Import/Export (Phase G — JSON implemented client-side today; other
formats documented, not implemented anywhere yet):**

- `GET /admin/config/fields/{fieldId}/export?format=json&entityIds=en,fa` →
  `[{ "entityId": "en", "values": { ... } }]` — exactly what the client's
  `'export'` bulk action already produces without a backend, so a real
  backend's response shape must match byte-for-byte for round-trip import
  to keep working.
- `POST /admin/config/fields/{fieldId}/import` with the same JSON array
  shape → validates each entity's values against the field's schema,
  applies via the same merge-patch semantics as `buildMergedCollectionValue`
  (unknown properties rejected, not silently dropped), runs
  `validateEntries` before commit, returns `{ "imported": ["en", "fa"] }` or
  `400` with per-entity errors.
- **CSV / XLIFF / PO / YAML** — format contracts only, no implementation
  exists client or server side:
  - *CSV*: one row per entity, one column per schema property id (header
    row = property ids), UTF-8, RFC 4180 quoting.
  - *XLIFF* (1.2): one `<file>` per language, `source`/`target` = the
    reference (`en`) and this language's value for every leaf translation
    key (not schema properties — XLIFF is for the message bundles, not the
    language metadata schema).
  - *PO* (gettext): one `msgid`/`msgstr` pair per translation key,
    `msgctxt` = the dotted namespace path.
  - *YAML*: same shape as the JSON export, YAML-serialized.
  A real implementation should reuse `src/i18n/quality.ts`'s
  `flattenMessages`-style key flattening for the message-bundle formats
  (XLIFF/PO) since that's already the correct key-path convention, and the
  existing collection schema for the metadata format (CSV/YAML/JSON).

**Translation Quality (Phase E/F — `src/i18n/quality.ts`)** — client-side
today reads the actual bundled locale JSON files directly (no network
call). A real backend equivalent:

```
GET /admin/localization/quality?locale={locale}
200: {
  "locale": "fa", "totalKeys": 754, "translatedKeys": 740, "missingKeys": 14,
  "brokenIcuKeys": 0, "brokenPlaceholderKeys": 2, "brokenHtmlKeys": 0,
  "completionPercent": 98
}

GET /admin/localization/quality/issues?locale={locale}&kind={missing|broken-icu|broken-placeholder|broken-html}
200: { "issues": [{ "locale": "fa", "key": "checkout.confirm", "kind": "missing", "detail": "..." }] }
```

Deliberately NOT specified here (real, confirmed gaps — see
`docs/P9.5.6_LANGUAGE_ADMIN_AUDIT.md`): duplicate-key detection (requires a
raw-text/non-JSON-parsing scan a backend running a real database wouldn't
need — duplicate keys are a JSON-authoring artifact specific to this
mock's flat-file storage) and unused/deprecated-key detection (requires
scanning application source for `t()` call sites — a build-time/CI
concern, not a runtime API).

**Runtime Sync (Audit gap #2 — `computeRuntimeSyncPlan`,
`src/platform-admin/language-runtime-sync.ts`)** — derives what
`languages.supported`/`languages.default`/`languages.rtl_locales` (§36's
ordinary fields) *should* be from the `platform.languages.registry`
collection's `enabled`/`default`/`rtl` flags. Not auto-applied (would
silently override a tenant's own `languages.supported` override — a real
runtime-behavior change this phase's own validation requirements forbid).
An explicit admin action, once built:

```
POST /admin/localization/sync-runtime-fields
200: { "supported": ["en","fa","ar","zh","it","tr"], "default": "en", "rtlLocales": ["fa","ar"] }
```
— which the client then writes via the ordinary §36 field-write endpoints
for `languages.supported`/`languages.default`/`languages.rtl_locales`, not
a new persistence path.
