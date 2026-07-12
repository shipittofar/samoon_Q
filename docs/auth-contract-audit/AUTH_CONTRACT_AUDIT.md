# AUTH_CONTRACT_AUDIT.md

Lead Platform Architect verification pass — **Authentication domain only**. This document is a factual record of what each side actually implements, read directly from source code on both repositories, cross-checked against the canonical backend docs (`01`–`28` through EPIC-015). It does not propose fixes (see `AUTH_FIX_PLAN.md`) or rank them (see `AUTH_IMPLEMENTATION_ORDER.md`) — it establishes ground truth.

**Sources read**:
- Frontend: `src/services/auth.service.ts`, `src/services/axios.instance.ts`, `src/services/combined.service.ts` (`userService`), `src/services/endpoints.ts`, `src/types/index.ts`, `src/types/rbac.ts`, `src/types/ownership.ts`.
- Backend (branch `feat/platform/epic-015-domain-contract-consolidation`, commit `913dfa0`): `accounts/api/urls.py`, `accounts/api/user_urls.py`, `accounts/api/views/auth.py`, `accounts/api/serializers/request/request.py`, `accounts/api/serializers/response/user.py`, `accounts/api/validators/phone_numbers.py`, `accounts/services/auth_service.py`, `accounts/services/otp_bll.py`, `accounts/models/user.py`, `accounts/models/otp_code.py`, `core/exceptions/account.py`, `core/exceptions/handler.py`, `SmartRestaurant/settings.py`, `SmartRestaurant/urls.py`.
- Backend docs cross-referenced: `04_AUTH_AND_RBAC.md`, `03_API_DOCUMENTATION.md`, `10_API_CONTRACT_MATRIX.md`, `06_FRONTEND_BACKEND_CONTRACT_GAPS.md`, `14_EPIC_001_IMPLEMENTATION_REPORT.md`, `15_EPIC_002_IMPLEMENTATION_REPORT.md`.

**Base URLs**: Frontend `API_BASE_URL` default `http://localhost:8000/api`. Backend mounts `path('api/auth/', include('accounts.api.urls'))` and `path('api/users/', include('accounts.api.user_urls'))` in `SmartRestaurant/urls.py`. Both sides agree on the `/api` root — no base-path mismatch.

**Backend global defaults**: `DEFAULT_AUTHENTICATION_CLASSES = (JWTAuthentication,)`, no default permission class (view is `AllowAny` unless it explicitly sets `permission_classes`). Errors: `{"error": {"status_code", "code", "message"}}` via `core/exceptions/handler.py`. No DRF throttle classes configured anywhere in `settings.py` except the OTP-specific cooldown/max-attempts business logic (not a DRF throttle — a manual check inside `OTPBusinessLogiclayer`).

---

## 1. Login (frontend "Login" = email+password)

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/login/` (`ENDPOINTS.AUTH.LOGIN`) | `POST /api/auth/login/` — routed as a bare alias of `PasswordLoginView` (`accounts/api/urls.py:38`) |
| Headers | `Content-Type: application/json`; no `Authorization` (pre-auth); `X-CSRFToken` attached by the axios interceptor for all non-GET requests if a `csrftoken` cookie exists (it never will — backend sets no such cookie, JWT-only auth) | None required. `AllowAny`. |
| Request body | `LoginCredentials { email: string; password: string }` (`src/types/index.ts:36`) | `PasswordLoginInputSerializer { country_code: string; phone_number: string; password: string }` (`accounts/api/serializers/request/request.py:58`) — **no `email` field exists on this serializer at all** |
| Validation (backend) | — | `country_code` regex `^\+[1-9]\d{0,3}$`; `phone_number` regex `^\d{6,14}$`; both required (no defaults) |
| Response body (frontend expects) | `{ user: User, tokens: AuthTokens, p7Roles?: Role[] } & AuthSessionRbacPayload` (`auth.service.ts:118`) | `TokenOutputSerializer { access: string; refresh: string }` only (`PasswordLoginView.create`, `accounts/api/views/auth.py:165-177`) — **no `user` object returned** |
| Nullable/optional | FE: `p7Roles`, `ownership`, `staffAssignments` all optional | BE: `access`/`refresh` both required strings, no optional fields |
| Enums | FE `User.role: 'customer'\|'staff'\|'owner'\|'admin'` (not applicable here since no user is returned) | N/A |
| Error codes | FE: generic thrown `Error`, no typed error parsing | BE: `401 invalid_credentials` (identical for "no such account," "no password set," and "wrong password" — deliberate enumeration protection per EPIC-001), `403 user_inactive` |
| Rate limiting | None expected/implemented on frontend | **None implemented on backend** — no throttle class on `PasswordLoginView`; unlimited brute-force attempts possible |
| Side effects (frontend) | `setTokens(access, refresh)` → localStorage + mirrored non-HttpOnly cookie | `RefreshToken.for_user(user)` mints a token pair; `UPDATE_LAST_LOGIN=True` touches `last_login` |

## 2. Password Login (distinct backend endpoint the frontend never calls directly by this name)

| | Frontend | Backend |
|---|---|---|
| URL | **Not called under this name.** Frontend's `ENDPOINTS` has no separate "password login" entry — `login()` is the only credential-based login method. | `POST /api/auth/password-login/` — canonical route; `login/` (above) is a routing alias pointing at the exact same `PasswordLoginView` |
| Everything else | Identical to Login above — same view, same serializer, same response | Identical to Login above |

**Finding**: the backend maintains two live paths (`login/`, `password-login/`) for one view, added specifically so the frontend's `/auth/login/` call resolves (EPIC-001). The frontend has no knowledge of `/password-login/` and never needs it — this is not a gap, it's already reconciled on the backend side. The real gap is the **request/response shape**, documented in section 1.

## 3. OTP (Send OTP)

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/send-otp/` (`ENDPOINTS.AUTH.SEND_OTP`) | `POST /api/auth/send-otp/` (`SendOTPView`) |
| Headers | none special | none required, `AllowAny` |
| Request body | `{ country_code: string, phone_number: string }` — computed as `{ country_code: payload.dialCode, phone_number: payload.phone_number.replace(payload.dialCode, '') }` (`auth.service.ts:229-233`) | `SendOTPInputSerializer { email?: EmailField, country_code?: CharField(5), phone_number?: CharField(15) }`, custom `.validate()` requires exactly one of email/phone+country_code (`request.py:5-35`) |
| Validation | Frontend does not itself validate phone format before sending | Backend: `country_code` regex `^\+[1-9]\d{0,3}$`, `phone_number` regex `^\d{6,14}$` — a malformed frontend-composed phone/country-code pair (e.g. dial code not starting with `+`) will 400 |
| Response body (frontend expects) | `{ message: string }` (`auth.service.ts:238`) | **`204 No Content`, empty body** (`SendOTPView.create`, `accounts/api/views/auth.py:73-81`) |
| Enums | none | none |
| Error codes | none parsed | `400` validation errors only (malformed identifier); as of EPIC-001, **no distinct error is raised for an unregistered identifier** (a code is always generated, enumeration-safe) |
| Rate limiting | Frontend has no cooldown UI logic tied to a specific error code | Backend: `OTP_RESEND_COOLDOWN_SECONDS=60` → `429 otp_resend_cooldown` if a prior unexpired code exists within the last 60s |
| Side effects | none client-side beyond the request | Invalidates all prior unused OTPs for the identifier, creates new 6-digit CSPRNG code (`secrets.randbelow`), 2-minute expiry (`OTP_EXPIRY_MINUTES=2`), attempts delivery via `get_otp_provider().send(...)` — **`NullOTPProvider` is the production default; no SMS/email is actually sent** (per `14_EPIC_001_IMPLEMENTATION_REPORT.md` §6) |

## 4. Verify OTP

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/verify-otp/` (`ENDPOINTS.AUTH.VERIFY_OTP`) | `POST /api/auth/verify-otp/` (`VerifyOTPView`) |
| Request body | `{ country_code: payload.dialCode, phone_number: payload.phone_number.slice(payload.dialCode.length), code: payload.otp }` (`auth.service.ts:280-286`) | `VerifyOTPInputSerializer { email?, country_code?, phone_number?, code: CharField(min=6,max=6) }` (`request.py:38-45`) — shape matches for the phone path |
| Response body (frontend expects) | Discriminated union: `{ is_new_user: true }` **(no other keys present)** OR `{ is_new_user: false, user: User, tokens: AuthTokens, p7Roles?, ...AuthSessionRbacPayload }` (`auth.service.ts:31-33`) | `VerifyOTPOutputSerializer { user: UserOutputSerializer \| null, is_new_user: boolean, tokens: TokenOutputSerializer \| null }` (`response/user.py:31-34`, view logic `accounts/api/views/auth.py:100-113`) — **always includes `user` and `tokens` keys, set to `null` when `is_new_user=true`**, rather than omitting them |
| Nullable mismatch | FE's TypeScript union declares `user`/`tokens` as **absent** (not `null`) on the new-user branch | BE sends them **present with value `null`** on the new-user branch — a real, verifiable shape difference (extra keys with `null` values the FE type says can't exist) |
| Enums | — | — |
| Error codes | none parsed beyond generic throw | `400 otp_invalid`, `400 otp_expired`, `429 otp_max_attempts_exceeded` (after `OTP_MAX_ATTEMPTS=5` wrong attempts, burns the code), `403 user_inactive` (if user exists but deactivated) |
| Rate limiting | none client-side | 5-attempt lockout per code (burns the code on the 5th wrong try, forcing a fresh `send-otp/`) |
| Side effects | Persists tokens via `setTokens()` **only when `!data.is_new_user`** | Marks OTP `is_used=True`; issues JWT pair via `RefreshToken.for_user(user)` only for an existing user |

## 5. Refresh

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/token/refresh/` — **not called via `authService`**; invoked directly inside the axios response interceptor (`axios.instance.ts:109`), bypassing `ENDPOINTS` and the shared `api` instance (raw `axios.post` to avoid interceptor recursion) | `POST /api/auth/token/refresh/` (`RefreshTokenView`) |
| Headers | none (pre-refresh, no valid access token) | `AllowAny` — the refresh token itself is the credential |
| Request body | `{ refresh: string }` | `RefreshTokenInputSerializer { refresh: CharField }` — exact match |
| Response body (frontend expects) | `{ access: string, refresh?: string }` — `setTokens(data.access, data.refresh || refresh)` falls back to the old refresh token if the response omits a new one | `TokenOutputSerializer { access: string, refresh: string }` — **both required**, always present since `ROTATE_REFRESH_TOKENS=True` unconditionally sets `data["refresh"]` (`auth_service.py:67-91`) |
| Error codes | Triggers `clearTokens()` + `window` `'auth:logout'` event on failure | `401 invalid_token` (`InvalidTokenException`) on an invalid/expired/blacklisted refresh token |
| Side effects | Replays the original failed request with the new access token; queues concurrent 401s | Blacklists the used refresh token (`BLACKLIST_AFTER_ROTATION=True`) and issues a brand-new one — **a refresh token can only be used once** |
| **Assessment** | **This is the single best-aligned endpoint in the entire Auth domain** — request and response shapes match exactly, and the frontend's fallback logic (`data.refresh \|\| refresh`) is harmless dead code since the backend always sends `refresh`. | |

## 6. Logout

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/logout/` (`ENDPOINTS.AUTH.LOGOUT`) | `POST /api/auth/logout/` (`LogoutView`) |
| Authentication | Sends whatever bearer token is currently set (may be expired) | `permission_classes = [IsAuthenticated]` — **requires a valid, non-expired access token** |
| Request body | **`api.post(ENDPOINTS.AUTH.LOGOUT)` — called with no second argument, i.e. no body is sent at all** (`auth.service.ts:158-163`) | `LogoutInputSerializer { refresh: CharField }` — **required field, no default** (`request.py:124-125`) |
| Response body | none consumed (`Promise<void>`) | `205 Reset Content`, empty body, on success |
| Error codes | none parsed — `logout()` wraps the call in `try { } finally { clearTokens() }`, so a backend error is swallowed and local state is cleared regardless | `400` validation error (`refresh` field missing) — **this will fire on every real call**, since the frontend never sends it; `401 invalid_token` if a refresh token is sent but invalid |
| Side effects | Always: `clearTokens()`, remove `mock_session_email` from localStorage, regardless of API outcome | On success: blacklists the given refresh token (`RefreshToken(token).blacklist()`) |

## 7. Me

| | Frontend | Backend |
|---|---|---|
| URL | `GET /auth/me/` (`ENDPOINTS.AUTH.ME`) | `GET /api/auth/me/` (`MeView`) |
| Authentication | Sends bearer token | `IsAuthenticated` |
| Response body (frontend expects) | `User & AuthSessionRbacPayload & { tenantRoles?: Role[] }` (`auth.service.ts:196`) | `UserOutputSerializer { id, email, phone_number, first_name, last_name, avatar, role, is_verified, created_at }` (`response/user.py:10-19`), `get_object()` returns `request.user` |
| Field-by-field | FE `User.email: string` (**required, non-nullable in the TS type**) | BE `User.email` is `models.EmailField(blank=True, null=True, unique=True)` — **can legitimately be `null`** for a phone-only account. Backend's own `UserOutputSerializer` does not coerce this to `""` — a `ModelSerializer` field will serialize `None` as JSON `null`. **Confirmed type/nullability mismatch.** |
| | FE `phone_number?: string` (optional) | BE: `get_phone_number()` returns `obj.phone_number or None` — matches FE's optionality (both can be absent/null) |
| | FE `avatar?: string` | BE: `get_avatar()` returns an absolute URL or `None` — matches |
| | FE `role: UserRole = 'customer'\|'staff'\|'owner'\|'admin'` | BE `User.role` is `TextChoices` with **only** `customer`/`admin` (`accounts/models/user.py:7-9`) — **`'staff'` and `'owner'` can never be returned by this endpoint.** Confirmed enum mismatch (subset, not superset — BE is strictly narrower than FE's declared type). |
| | FE has no `tenantRoles` sent by backend today (optional, degrades gracefully) | BE never populates `tenantRoles`/`ownership`/`staffAssignments` — no RBAC data model exists yet (`04_AUTH_AND_RBAC.md`) |
| Error codes | none parsed | `401` (no/invalid/expired token) via DRF's standard `NotAuthenticated`/`AuthenticationFailed`, not a `BaseAppException` — response shape for this specific 401 is DRF's default `{"detail": "..."}`, **not** the backend's custom `{"error": {...}}` envelope (since `custom_exception_handler` only overrides when `exception_handler(exc, context)` returns `None`, and DRF's own auth exceptions already produce a response) |
| **Assessment** | **Second-best-aligned endpoint** — path, method, and top-level shape all match. The only real defects are the `email` nullability lie and the `role` enum being narrower than declared. | |

## 8. Forgot Password

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/forgot-password/` (`ENDPOINTS.AUTH.FORGOT_PASSWORD`) | **No route registered at this path.** Closest equivalent: `POST /api/auth/forget-password/request/` (note "forget" not "forgot", and an extra `/request/` segment) — **will 404** |
| Request body | `{ email: string }` (`auth.service.ts:210`) | `ForgetPasswordRequestInputSerializer { country_code: CharField, phone_number: CharField }` — **no `email` field exists**; this flow is phone-only |
| Response body (frontend expects) | `{ message: string }` | `204 No Content`, empty body |
| Error codes | none parsed | none — deliberately always `204` regardless of whether the phone number is registered (enumeration-safe, per EPIC-001) |
| Side effects | none client-side | Generates an OTP for the phone number **only if** a matching active user exists (silent no-op otherwise) |
| **Assessment** | **Fully broken end-to-end**: wrong path (404 today), and even if the path were fixed, the request body's `email` field has no backend equivalent — the backend flow is phone+OTP-based, not email/token-based. This is not a routing fix; it requires either a backend email-based reset flow or a frontend rewrite of the forgot-password UI to collect phone number + walk through OTP. | |

## 9. Reset Password

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/reset-password/` (`ENDPOINTS.AUTH.RESET_PASSWORD`) | **No route registered at this path.** Closest equivalent: `POST /api/auth/forget-password/confirm/` — **will 404** |
| Request body | `{ token: string, password: string }` (`auth.service.ts:220`) | `ForgetPasswordConfirmInputSerializer { country_code, phone_number, code: CharField(6), new_password: CharField(min=8) }` — **no `token` concept exists anywhere in the backend.** The backend proves identity via a 6-digit OTP `code` tied to a `phone_number`, not an opaque reset token |
| Response body (frontend expects) | `{ message: string }` | `204 No Content`, empty body |
| Error codes | none parsed | `400 otp_invalid`, `400 otp_expired` (same OTP verification path as login), implicit `401 invalid_credentials` if the account was deleted/deactivated between request and confirm |
| **Assessment** | **Fully broken end-to-end, and architecturally incompatible, not just path-mismatched.** The frontend models password reset as "backend emails a token link → user submits token+new password." The backend models it as "backend generates an OTP → user submits phone+code+new password." These are two different UX flows, not a naming alias fixable by routing alone. | |

## 10. Register

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/register/` (`ENDPOINTS.AUTH.REGISTER`) | `POST /api/auth/register/` (`RegisterUserView`) — path matches |
| Request body | `RegisterData { phone_number?, country_code?, password?, confirm_password?, first_name (required), last_name (required) }` (`src/types/index.ts:41-58`) — code comment confirms `password`/`confirm_password` are "temporarily NOT part of the phone-OTP registration flow" but remain in the type for a still-live email+password `RegisterClientPage.tsx` flow | `RegisterInputSerializer { email?, country_code?, phone_number?, first_name (required), last_name (optional, blank allowed) }` (`request.py:113-121`) — **no `password`/`confirm_password` field exists on this serializer at all; any such fields sent by the frontend are silently dropped by DRF** |
| Validation (backend) | — | `_validate_identifier()`: exactly one of `email` XOR `phone_number`+`country_code`; **also requires `has_verified_identifier(identifier)` to be `True`** (`auth_service.py:37-38`) — i.e. **register can only succeed after a prior successful `verify-otp/` call for that exact identifier.** There is no path to create an account with only email+password and no OTP step. |
| Business-rule mismatch | Frontend's `RegisterClientPage.tsx` (per `05_PAGE_TO_API_MAPPING.md`) is a direct email+password signup form calling `useRegister` → `authService.register()` with no OTP step in that flow | **Any such direct call will 403 `identifier_not_verified`** — the backend has no email+password direct-registration path at all. Backend registration is strictly a second step after `send-otp/` → `verify-otp/` returned `is_new_user: true`. |
| Response body (frontend expects) | `{ user: User, tokens: AuthTokens, p7Roles?: Role[] } & AuthSessionRbacPayload` — **no `is_new_user` field in this return type** | `VerifyOTPOutputSerializer { user, is_new_user: true (always), tokens }` (`accounts/api/views/auth.py:138-141`) — **sends an extra `is_new_user` key** the frontend's register-response type doesn't declare (harmless at runtime — JS ignores extra keys — but a real type/contract mismatch) |
| Error codes | none parsed | `403 identifier_not_verified`, `409 user_already_exists` |
| Side effects | `setTokens()` on success | `User.objects.create_user(...)` with an **unusable password** (`create_user()` sets one by default) — even when the frontend's `password`/`confirm_password` fields are present in the payload, the backend **never reads or sets a password during registration.** A user registered this way must separately call `set-password/` (itself broken — see `AUTH_DIFF_MATRIX.md`) before password-login would ever work for them. |
| **Assessment** | **Path matches; two independent, serious semantic mismatches**: (1) the frontend's email+password direct-registration UI path has no working backend equivalent at all (will always 403), and (2) even the OTP-gated phone registration path silently drops any password the frontend sends, leaving the account permanently on OTP-only login unless a separate (currently broken) set-password call succeeds. | |

## 11. Profile

Two frontend concerns map here: reading the profile and updating it. Avatar upload is documented briefly at the end since it's part of the same resource family, though not explicitly named in the requested endpoint list.

### 11a. Get Profile

| | Frontend | Backend |
|---|---|---|
| URL | `GET /users/profile/` (`ENDPOINTS.USERS.PROFILE`) — per the page-mapping audit, **no frontend code path was found actually calling this** for a dedicated fetch; the dashboard/settings page reads the cached `user` from `useAuthStore` (populated by `getMe()`/login/register) instead. The endpoint exists in `ENDPOINTS` but appears unused by any traced hook. | `GET /api/users/profile/` (`ProfileView.get`, EPIC-002 alias) — byte-identical response shape to `GET /api/auth/me/` (asserted by the backend's own test `test_get_response_matches_me_endpoint_shape`) |
| **Assessment** | Path and shape are correctly aligned on the backend side; the frontend simply doesn't exercise this specific path today, relying on `/auth/me/` instead. Not a defect, just an unused-but-working alias — worth noting so nobody "fixes" a path that already works. | |

### 11b. Update Profile

| | Frontend | Backend |
|---|---|---|
| URL | `PATCH /users/profile/` (`ENDPOINTS.USERS.UPDATE_PROFILE`, same string as `PROFILE`) — called from `combined.service.ts userService.updateProfile()` | `PATCH /api/users/profile/` (`ProfileView.patch`) — path matches exactly |
| Request body | `Partial<User>` — **TypeScript allows any subset of `{id, email, phone_number, first_name, last_name, avatar, role, is_verified, created_at}`** to be sent (`combined.service.ts:124-131`) | `UpdateProfileInputSerializer { first_name?: CharField(64), last_name?: CharField(64) }` — **only these two fields are ever read**; any other field the frontend's type permits (`email`, `phone_number`, `avatar`, `role`, `is_verified`, `id`) is silently ignored by DRF, not rejected |
| Validation (backend) | Frontend performs no client-side validation before sending | Backend: `.validate()` raises `400` if the payload is empty after filtering (`"At least one field is required to update."`) — if a frontend caller sends only `{email: '...'}` (a field the backend doesn't read), the backend receives an **effectively empty** validated payload and 400s, even though the frontend's own type system considered the call well-formed |
| Response body | `User` (full object expected back) | `UserOutputSerializer` — same full shape as `/me/`, so this part matches |
| **Assessment** | The path/method/response are aligned. The **request body's type is unsafely wide** — `Partial<User>` should be a dedicated `UpdateProfilePayload { first_name?: string; last_name?: string }` type to match what the backend actually accepts, both to prevent silent-drop bugs and to prevent the empty-payload 400 described above when a caller only supplies unsupported fields. | |

### 11c. Avatar (adjacent, not separately requested but part of "Profile")

| | Frontend | Backend |
|---|---|---|
| URL | `POST /users/avatar/` (`ENDPOINTS.USERS.AVATAR_UPLOAD`) | **No route exists at `/api/users/avatar/`.** Only `PUT /api/auth/profile/avatar/` (`SetAvatarView`) — path AND method both differ (frontend POSTs, backend expects PUT) |
| **Assessment** | Fully broken — path and verb mismatch, confirmed `BROKEN` in `10_API_CONTRACT_MATRIX.md` and explicitly deferred out of EPIC-002's scope. | |

## 12. Change Password (in scope as part of the requested Profile/Auth set)

| | Frontend | Backend |
|---|---|---|
| URL | `POST /auth/change-password/` (`ENDPOINTS.AUTH.CHANGE_PASSWORD`) | **No route exists at this path.** Closest backend concept: `POST /api/auth/set-password/` (`SetPasswordView`) — different path, and semantically the opposite operation |
| Authentication | Frontend calls this assuming the user is authenticated (called from `dashboard/settings/page.tsx`, sends bearer token) | `SetPasswordView` is **`AllowAny`** — not authenticated at all, identifies the target account by `phone_number` in the request body instead of the JWT session |
| Request body | `{ old_password: string, new_password: string }` (`auth.service.ts:314`) | `SetPasswordInputSerializer { country_code, phone_number, password }` — **no `old_password` field, no `new_password` field**; also requires the account to have **no password set yet** (`raises PasswordAlreadySetException` if one already exists) |
| **Assessment** | **Completely incompatible, not a routing fix.** The frontend wants "authenticated user changes their existing password by proving the old one." The backend's only related endpoint does "unauthenticated one-time initial password set, only when none exists yet, identified by phone number in the body." There is no backend operation today that performs an authenticated password *change* for a user who already has one set. | |

---

## Summary table of what actually works today, unmodified, against the real backend

| Endpoint | Status |
|---|---|
| Refresh | **Works** — exact shape match |
| Me | **Works**, with two field-level defects (`email` nullability, `role` enum too narrow) |
| Verify OTP | **Works functionally** (frontend narrows correctly on `is_new_user`), with a cosmetic nullable-field mismatch |
| Send OTP | **Works functionally** (frontend ignores the response body entirely, so the `{message}` vs `204` mismatch never surfaces as a bug), but delivery is not implemented on either side's expectations reconciled — OTP is never actually delivered to a user in any environment |
| Login (email+password) | **Broken** — field shape totally incompatible (email/password vs country_code/phone_number/password), response missing `user` |
| Register | **Broken for the email+password path**, **partially works for the OTP-gated phone path** but silently drops any password the frontend sends |
| Get Profile | **Works** (backend side correct), but effectively unused by the frontend today |
| Update Profile | **Works for the two supported fields**, silently drops/soft-fails on anything else the frontend's type allows |
| Logout | **Broken** — frontend never sends the required `refresh` body field, every real call will 400 |
| Forgot Password | **Broken** — wrong path, incompatible fields (email vs phone) |
| Reset Password | **Broken** — wrong path, incompatible identity model (token vs OTP code) |
| Change Password | **Broken** — wrong path, incompatible semantics (authenticated change vs unauthenticated first-time set) |
| Avatar Upload | **Broken** — wrong path and wrong HTTP verb |
