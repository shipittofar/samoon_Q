# Phase 3 — Django `/auth/me/` Reference Implementation

Copy these modules into the external Django backend repository.
This frontend repo does **not** run Django — this is the deliverable backend team applies.

## Integration

1. Add `auth_me` app (or merge into existing `accounts` / `authorization` app).
2. Wire `MeView` at `GET /api/auth/me/` (match `src/services/endpoints.ts`).
3. Ensure camelCase JSON renderer or serializer `to_representation` uses camelCase field names.
4. Run `python manage.py test auth_me.tests`.

## Query budget

`AuthMeService.build_payload()` must complete in **≤ 5 SQL queries** for any user.
