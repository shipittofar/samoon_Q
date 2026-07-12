# AUTH_FIX_PLAN.md

This is a verification-phase deliverable: it describes **what should change and why**, not an implementation. No code was edited to produce this document. Each item references the corresponding row in `AUTH_DIFF_MATRIX.md`.

Grouped by who owns the fix, since that's the natural work-assignment boundary. Within each group, ordered by severity.

---

## Backend-only fixes (frontend needs no change)

### BF-1. Logout: no backend change needed — this is a frontend defect (see FE-1)
Backend behavior is correct per its own contract (`refresh` required). No backend action.

### BF-2. Add a routing alias for Forgot Password path (`#12`)
Add `POST /api/auth/forgot-password/` as a bare alias of `forget-password/request/`, same pattern already used for `login/`→`password-login/` (EPIC-001) and `users/profile/`→`me/`+`profile/update/` (EPIC-002). **Does not resolve the field-shape mismatch** (`#13`) — that requires a separate decision (see Joint Decisions below). Cheap, low-risk, purely additive.

### BF-3. Add a routing alias for Reset Password path (`#14`)
Same pattern: `POST /api/auth/reset-password/` aliasing `forget-password/confirm/`. Does not resolve the identity-model mismatch (`#15`) — see Joint Decisions.

### BF-4. Add a routing + verb alias for Avatar Upload (`#21`)
Add `POST /api/users/avatar/` aliasing the existing `SetAvatarView` logic (which is currently only reachable via `PUT /api/auth/profile/avatar/`). Consistent with the alias strategy already established for `branches/`, `users/profile/`, `login/`. Purely additive, zero risk to existing callers.

### BF-5. Add `user` to the Login response (`#2`)
`PasswordLoginView` (and by extension `login/`) should return `{user: UserOutputSerializer, tokens: TokenOutputSerializer}` instead of `{access, refresh}` only, matching the shape already used by `verify-otp`/`register`. This is an additive field, not a breaking rename — existing callers reading only `access`/`refresh` (if any exist) are unaffected as long as the response is nested consistently; **note this requires a decision on final response shape** — see Joint Decisions on Login below, since it interacts with BF-6/JD-1.

### BF-6. Build a genuine authenticated Change Password endpoint (`#22`, `#23`)
This is **new functionality**, not an alias. Requirements: `IsAuthenticated`, identify the target user from `request.user` (JWT), accept `{old_password, new_password}`, verify `old_password` via `user.check_password()`, reject with `401 invalid_credentials` (reuse existing exception) if wrong, otherwise `user.set_password(new_password)`. Recommend mounting at `POST /api/auth/change-password/` to match the frontend's existing call exactly (no frontend change needed for the path once this exists). This is meaningfully larger than the alias fixes above — it's a new business-logic method, not a routing wrapper.

### BF-7. Route auth-failure exceptions through the standard error envelope (`#11`)
Override or wrap `NotAuthenticated`/`AuthenticationFailed` so 401 responses on protected endpoints (e.g. `/me/`) return `{"error": {"status_code": 401, "code": "...", "message": "..."}}` consistently with every other error in the API, instead of DRF's default `{"detail": "..."}`. Low urgency since no frontend code currently depends on the envelope shape for auth failures, but this is real technical debt worth clearing opportunistically.

### BF-8. Add throttling to password-login endpoints (`#24`)
Add a DRF throttle class (`AnonRateThrottle` or a custom scoped throttle) to `PasswordLoginView`/`login/`. Security hardening, not a contract-shape fix — doesn't require frontend coordination, but the frontend's error handling should eventually recognize a `429` from this endpoint (see FE-8, optional/low-priority companion).

---

## Frontend-only fixes (backend needs no change)

### FE-1. Send `refresh` in the Logout request body (`#8`)
**Highest-priority frontend fix in this entire audit.** `authService.logout()` must read the current refresh token (already available via `getRefreshToken()` in `axios.instance.ts`) and send it as `{refresh: <token>}` in the POST body. Currently the call is bodyless, guaranteeing a 400 on every real logout and leaving the refresh token un-blacklisted (silent session-security gap masked by the `finally { clearTokens() }` block, which clears local state regardless of the backend's actual response).

### FE-2. Widen `User.email` to nullable (`#9`)
Change `email: string` to `email: string | null` in `src/types/index.ts`, and audit call sites for unguarded `.email` access, consistent with how `phone_number?: string` already models the "either identifier may be absent" reality of this backend's user model.

### FE-3. Narrow `UserRole` to match backend reality, decouple RBAC roles from `User.role` (`#10`)
Change `UserRole` to `'customer' | 'admin'` to reflect what `User.role` can actually contain, and confirm (it already appears to be the case per the frontend audit) that all RBAC/permission logic reads `tenantRoles`/`p7Roles` instead of `user.role` for anything requiring `'staff'`/`'owner'`/etc. This is the correct frontend-side fix regardless of whether backend RBAC is later built out, since `User.role` and P7 tenant roles are architecturally different concepts per `04_AUTH_AND_RBAC.md`.

### FE-4. Replace `Partial<User>` with a dedicated Update Profile payload type (`#20`)
Define `interface UpdateProfilePayload { first_name?: string; last_name?: string }` and use it as `userService.updateProfile()`'s parameter type instead of `Partial<User>`. Prevents call sites from compiling against fields the backend silently ignores or rejects.

### FE-5. Add specific error handling for OTP cooldown/lockout (`#4`, `#6`)
Map `otp_resend_cooldown` (429) and `otp_max_attempts_exceeded` (429) to distinct, actionable UI states (cooldown countdown; "request a new code" prompt) instead of a generic error toast.

### FE-6. Rework or remove the direct email+password registration flow (`#16`, `#17`)
`RegisterClientPage.tsx`'s direct-registration path has no working backend equivalent and never will unless the backend adds a non-OTP-gated registration mode (not recommended — see Joint Decisions). Recommend reworking this page to route through `send-otp/` → `verify-otp/` → `register/`, matching the phone-OTP flow the rest of the app already uses, and dropping the `password`/`confirm_password` fields from the registration form entirely (the code comments already indicate this was the intended direction — "temporarily NOT part of the phone-OTP registration flow").

### FE-7. Widen the Register response type to include `is_new_user` (`#18`)
Cosmetic type-completeness fix — add `is_new_user: true` to the return type of `authService.register()`.

### FE-8 (optional, low priority). Remove the dead `X-CSRFToken` interceptor logic (`#25`)
No functional harm today, but it's dead code implying a hybrid auth model that doesn't exist on this backend. Clean up opportunistically.

---

## Joint decisions required before either side writes code

These items cannot be resolved by one side unilaterally aliasing a path — they require a product/architecture decision about which flow is canonical.

### JD-1. Login identity model: email vs phone
The frontend's primary login form collects email+password. The backend's entire credentialed-login/password-reset/registration stack is phone-number-first (`USERNAME_FIELD="phone_number"`). This is the single largest structural disagreement in the whole Auth domain and touches `#1` (Login), indirectly `#12`–`#15` (Forgot/Reset Password), and `#16` (Register).

Two resolutions, not a partial middle ground:
- **(a) Backend adopts email as a first-class login identity** — extend `PasswordLoginInputSerializer`/`login()` to accept `identifier` (email or phone, reusing the `_validate_identifier()` pattern already built for OTP/register) and look up by `Q(phone_number=identifier) | Q(email=identifier)` (this dual lookup is already documented as existing conceptually in `04_AUTH_AND_RBAC.md`'s description of the User model, just not wired into `PasswordLoginInputSerializer` yet). This is the **lower-effort** resolution since the underlying dual-identifier lookup capability is already partially present in the codebase's stated design.
- **(b) Frontend adopts phone-first login** — rework the login page to collect phone+country_code instead of (or alongside) email, matching backend reality exactly. Higher frontend UX-redesign cost, and inconsistent with the rest of the marketing site's email-centric account model (favorites, addresses, dashboard all assume email-identified accounts in places).

**Recommendation**: (a). It's additive on the backend (no existing phone-based caller breaks), it reuses an established pattern (`_validate_identifier`), and it avoids a frontend UX rewrite.

### JD-2. Forgot/Reset Password flow: email+token vs phone+OTP
Same root disagreement as JD-1, applied to password recovery. The frontend's `/forgot-password` page is a single email field; the backend has no email-based recovery and no token concept at all — only phone+OTP.

**Recommendation**: resolve this the same direction as JD-1. If backend adds email-based login (JD-1a), extend the same email support into `ForgetPasswordRequestInputSerializer`/`ForgetPasswordConfirmInputSerializer` (the underlying OTP infrastructure already supports `is_email=True` per `otp_bll.py`), and change the frontend's reset-password step to collect a `code` field (the OTP) instead of expecting an emailed token link. This still requires a **frontend UI change** (adding a code-entry step) even under resolution (a), because the backend genuinely has no opaque-token-link mechanism — only JD-1's identity-lookup gap can be closed backend-side "for free"; the token-vs-code UX difference cannot.

### JD-3. Registration: should a password ever be collected at signup?
Backend's registration is deliberately OTP-only (proof of phone/email control, then account creation with an *unusable* password). Frontend's legacy email+password registration form collects a password at signup time. Per JD-1/JD-2's direction, the cleanest resolution is: **registration never collects a password** (FE-6); anyone wanting password-based login as a secondary method uses `set-password/` (renamed/aliased per BF-6's neighbor, or left as-is) as an explicit, separate, authenticated step after their first OTP login. This avoids building password-at-registration support on the backend (BF-6's alternative path in `#17`) and is consistent with "OTP is the sole registration proof of identity" as the backend's stated design intent.

---

## Explicitly NOT recommended (shortcuts rejected)

Per the task's constraint against suggesting shortcuts, these were considered and rejected:

- **Do not** have the frontend silently catch-and-ignore the Logout 400 without fixing FE-1 — this "works" today only because `clearTokens()` runs in a `finally` block regardless of the backend's response, but it leaves refresh tokens un-blacklisted indefinitely (a real session-security gap, not a cosmetic issue).
- **Do not** resolve JD-1 by having the frontend silently translate an email into a synthetic phone-shaped string to satisfy the backend's current validator — this would corrupt the account identity model and break any future backend code that assumes `phone_number` is a real phone number.
- **Do not** leave `Partial<User>` as the Update Profile payload type "because it happens to work" — it happens to work only because the backend silently ignores unsupported fields; a future backend change that starts *rejecting* unknown fields (a common tightening) would break this without any frontend code change being visible as the cause.
