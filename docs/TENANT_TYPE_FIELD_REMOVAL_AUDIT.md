# Tenant.type Field Removal Audit (Phase Z.6.1)

**Status: complete.** `Tenant.type` (added speculatively in Phase Z.6 to
mirror the backend's response shape) is removed. No replacement field was
added, per the task's explicit instruction.

## Audit — Every Reference Found and Removed

`Tenant.type` had exactly **one** consumer in the entire codebase: its own
declaration. A full-repo search (types, services, hooks, stores,
components, pages, filters, cards, selectors, mocks, tests) confirmed:

- No component read `tenant.type`, `currentTenant.type`, `activeTenant.type`,
  or any equivalent.
- No conditional rendering branched on it (`tenant.type === ...` /
  `tenant.type !== ...` do not appear anywhere).
- No mock fixture set it except the one test file that added it in Phase
  Z.6 specifically to prove the raw-backend-shape round-trip.
- `docs/BACKEND_SCHEMA.dbml`'s `tenants` table never had a `type` column —
  it was never propagated to the (already-frozen, out-of-scope-to-touch)
  backend schema.

This is expected: Phase Z.6 added `type?: string` purely to widen the
`Tenant` interface to match the task's described backend response shape —
it was never wired into any UI, filter, or business logic, so removing it
is a pure type/fixture deletion with zero behavioral change.

## Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | Removed `type?: string` from `Tenant`. |
| `src/test/phase-Z-6-tenant-list-contract.test.ts` | Removed `type: 'restaurant'` from the raw-backend-shaped test fixture and from the "no field is dropped" assertion; updated the file's header comment's field list. |
| `docs/TENANT_LIST_CONTRACT_ALIGNMENT_AUDIT.md` | Added an update note pointing here — left the rest of that document as an accurate historical record of what Phase Z.6 originally did. |

No component, hook, store, service, or page needed a change — confirming
the field was genuinely unused.

## Verification

- `npx tsc --noEmit -p .` — zero new errors (diffed against the established
  baseline; identical modulo the one pre-existing failure's line-number
  shift).
- `npx vitest run` (tenant-related suites) — only the same pre-existing
  `createdAt` baseline failure; all Phase Z.6 tests pass with `type`
  removed from both the fixture and the assertion.
- `npm run build` — production build result recorded in the commit message.
