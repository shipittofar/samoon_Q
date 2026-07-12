# AUTH_IMPLEMENTATION_ORDER.md

Recommended sequencing for the fixes described in `AUTH_FIX_PLAN.md`. Ordering logic: (1) fixes that unblock other fixes come first, (2) zero-risk additive backend aliases before any frontend behavior change, (3) joint-decision items are sequenced at the point their decision is actually needed, not deferred to the end, (4) new-functionality items (not aliases) are sequenced last since they carry the most design/review risk.

## Phase 0 — Decide, don't build (prerequisite for Phase 2+)

1. **JD-1**: Resolve Login identity model (email vs phone). Recommended: backend adopts email as a first-class login identity (option a).
2. **JD-2**: Resolve Forgot/Reset Password flow direction, following JD-1's resolution.
3. **JD-3**: Confirm registration never collects a password; `set-password/` remains the sole password-establishment path.

Nothing in Phase 1+ that touches Login/Register/Password-Reset should start coding until these three are settled — building against an undecided identity model guarantees rework.

## Phase 1 — Zero-risk backend aliases (independent of Phase 0, can start immediately, in parallel)

These are pure additive routing aliases with no business-logic change, no migration, and no risk to any existing caller — the same pattern already proven safe in EPIC-001/EPIC-002.

1. **BF-2**: Alias `POST /api/auth/forgot-password/` → existing `forget-password/request/` logic.
2. **BF-3**: Alias `POST /api/auth/reset-password/` → existing `forget-password/confirm/` logic.
3. **BF-4**: Alias `POST /api/users/avatar/` → existing `SetAvatarView` logic.

Note: BF-2/BF-3 fix the *path* only. They do not make Forgot/Reset Password functional end-to-end until Phase 0's JD-2 and Phase 2's field-shape work land — but doing the alias now means no further routing work is needed once the field-shape fix ships.

## Phase 2 — Frontend fixes with no backend dependency (parallel with Phase 1)

Ordered by severity within this phase.

1. **FE-1**: Send `refresh` in the Logout request body. **Do this first among frontend items** — it's the single highest-severity frontend-only defect (a real, silent session-security gap) and requires no backend coordination at all.
2. **FE-2**: Widen `User.email` to `string | null`.
3. **FE-3**: Narrow `UserRole` to `'customer' | 'admin'`; confirm RBAC logic exclusively uses `tenantRoles`/`p7Roles`.
4. **FE-4**: Replace `Partial<User>` with a dedicated `UpdateProfilePayload` type.
5. **FE-5**: Add OTP cooldown/lockout-specific error handling.
6. **FE-7**: Widen Register response type to include `is_new_user`.
7. **FE-8**: Remove dead CSRF-header interceptor logic (cleanup, no urgency).

## Phase 3 — Login identity model (depends on JD-1 from Phase 0)

1. **BF-5 + JD-1(a)**: Extend `PasswordLoginInputSerializer`/`PasswordAuthBusinessLogicLayer.login()` to accept email or phone via the existing `_validate_identifier()` pattern, and add `user: UserOutputSerializer` to the login response.
2. Update backend tests (`test_endpoint_alignment.py`, `test_enumeration.py` already establish the pattern for identical-error-on-failure enumeration protection — extend, don't replace, that coverage for the new email path).
3. **Frontend verification only** (no frontend code change needed if JD-1(a) is chosen) — confirm `authService.login()`'s existing `{email, password}` request now round-trips correctly against the real backend, and that `useLogin()`'s `onSuccess: setUser(user)` receives a real user object.

This phase should not start until Phase 0 item 1 is signed off, since it's the direct implementation of that decision.

## Phase 4 — Forgot/Reset Password field-shape + flow (depends on JD-2, Phase 1 aliases, and ideally Phase 3's email-lookup work)

1. Extend `ForgetPasswordRequestInputSerializer`/`ForgetPasswordConfirmInputSerializer` to accept email (reusing `is_email` support already present in `otp_bll.py`).
2. **FE (flow rework)**: Frontend's `/forgot-password` and `/reset-password` (or equivalent) pages must add an OTP-code-entry step — this is a genuine UI flow change, not a field rename, since the backend has no token-link mechanism to alias to.
3. End-to-end verification: request → OTP delivered (or logged, per current `NullOTPProvider` limitation — see Residual Risks below) → confirm with code + new password.

## Phase 5 — Registration flow rework (depends on JD-3)

1. **FE-6**: Rework `RegisterClientPage.tsx` to route through `send-otp/` → `verify-otp/` → `register/`, removing the password/confirm_password fields from the registration form.
2. Regression-check the existing phone-OTP registration flow (`/complete-profile`) is unaffected — it already follows this pattern per the frontend audit.

## Phase 6 — New backend functionality (highest design/review risk, sequence last)

1. **BF-6**: Build the genuine authenticated Change Password endpoint (`POST /api/auth/change-password/`, `IsAuthenticated`, old-password verification). This is new business logic, not an alias — it should go through normal design review (error codes, whether to invalidate other sessions/refresh tokens on change, whether to require re-login) rather than being rushed alongside the alias work in earlier phases.
2. **BF-8**: Add throttling to `password-login/`/`login/`.
3. **BF-7**: Route auth-failure exceptions through the standard error envelope (pure backend consistency cleanup, no external dependency — could technically move earlier, sequenced last only because it's the lowest urgency item in the whole plan).

## Residual risk carried forward regardless of this plan's completion

- **OTP delivery is not implemented on either side's expectations reconciled** — `NullOTPProvider` doesn't send SMS/email in production. This is called out in the backend's own `14_EPIC_001_IMPLEMENTATION_REPORT.md` as unscoped work, not something this Auth contract audit can resolve by aligning field shapes. Any phase above that depends on a user actually receiving an OTP (Phase 3 for OTP-gated flows, Phase 4, Phase 5) is **functionally blocked in any real environment** until a real SMS/email provider is wired into `otp_providers.py`, independent of every fix in this plan.
- **No RBAC role system exists backend-side.** FE-3's fix (narrowing `UserRole`) is a correctness fix for the *current* backend, but the larger architectural gap (`04_AUTH_AND_RBAC.md`'s full 8-role/`resource.action` permission system) is explicitly out of scope for an Auth-only audit and is tracked separately in the backend's own roadmap docs.

---

## Compatibility Score

**32 / 100**

Basis: of the 11 requested endpoint groups (Login, Password Login, OTP, Verify OTP, Refresh, Logout, Me, Forgot Password, Reset Password, Register, Profile), only **2 are fully correct today** (Refresh, Get Profile), **2 work with cosmetic defects only** (Me, Verify OTP/Send OTP combined), and **the remaining 7 are broken to some degree**, of which **5 are completely non-functional** (Login for email/password, Forgot Password, Reset Password, Change Password, Avatar) and **2 are partially functional but silently drop data or fail for a subset of real usage** (Register, Update Profile). Weighting by how central each endpoint is to a working auth experience (Login and Register are load-bearing; Avatar is peripheral), the working surface area is closer to a third of the domain than half.

## Risk Score

**High**

Basis: three of the broken endpoints are not path-alias fixes but genuine architectural disagreements (email vs phone identity, token-link vs OTP-code reset, no-password-at-registration vs password-at-registration) that require a product decision before either team can safely write code — shipping a quick alias for any of these three without resolving the underlying model would produce a worse outcome (an endpoint that returns `200` but silently does the wrong thing) than the current `404`/`400` failures, which at least fail loudly. Additionally, Logout's current "works" appearance (frontend swallows the failure) is actively dangerous from a security-hygiene standpoint — it should be treated as higher priority than its "the user doesn't notice anything's wrong" symptom suggests.

## Estimated Implementation Effort

| Phase | Effort |
|---|---|
| Phase 0 (decisions) | 0.5–1 day (a focused architecture conversation, not engineering time) |
| Phase 1 (backend aliases) | 0.5 day |
| Phase 2 (frontend-only fixes) | 1–1.5 days |
| Phase 3 (login identity model) | 1–2 days backend + tests, ~0 frontend |
| Phase 4 (forgot/reset password) | 2–3 days (backend field extension + frontend flow rework + tests) |
| Phase 5 (registration flow rework) | 1–2 days frontend |
| Phase 6 (new Change Password endpoint + throttling + error envelope) | 2–3 days |
| **Total** | **~9–13 engineering days**, excluding the unscoped OTP-delivery-provider work called out as a residual risk above, which is a separate, larger effort (vendor integration, not contract alignment) |

## Breaking Change Assessment

**No breaking changes are required or recommended anywhere in this plan.** Every backend fix listed is additive (new alias routes, new response fields, a genuinely new endpoint) — no existing route, field, or response shape needs to be removed or renamed to implement this plan, consistent with the alias-don't-replace pattern already established in EPIC-001/EPIC-002. Every frontend fix is either a type-narrowing (safe, compile-time only, e.g. FE-2/FE-3/FE-4), a request-body correction (FE-1), or a UI flow addition (Phase 4/5) — none require removing a capability real users depend on today, since the flows being reworked (direct email+password registration, token-based password reset) are **already non-functional against the real backend**, so reworking them breaks nothing that currently works in production.

## Recommended Implementation Order (condensed)

1. Phase 0 — decisions (JD-1, JD-2, JD-3)
2. Phase 1 + Phase 2 in parallel — zero-risk aliases and independent frontend fixes, starting with **FE-1 (Logout body) as the single highest-priority item in the entire audit**
3. Phase 3 — Login identity model
4. Phase 4 — Forgot/Reset Password
5. Phase 5 — Registration flow rework
6. Phase 6 — Change Password (new endpoint), throttling, error-envelope consistency
