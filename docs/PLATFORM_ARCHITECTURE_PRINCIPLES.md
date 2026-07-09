# Platform Architecture Principles

> **Permanent engineering standard for Savor.** Not phase-scoped documentation
> — this file governs how every future module (P9.1+, and anything beyond)
> is built. If a change conflicts with this document, the change is wrong,
> not the document (propose an amendment here first).
>
> Established: P9.0 (Platform Configuration Foundation). Hardened: P9.0.1.
> Last updated: 2026-07-04

---

## 1. Architecture Review Findings (P9.0.1 Phase A)

Before writing the principles below, the full P9.0 implementation
(`src/config/*`) was reviewed end to end. Findings, and what was done about
each:

| Finding | Severity | Resolution |
|---|---|---|
| `ConfigurationService.updateField()`'s level check compared `input.level !== field.inheritance.level` by equality only — it never verified *direction*, so a write ABOVE a field's owning level (e.g. a `'platform'`-level write to a field owned at `'tenant'`) was silently accepted instead of rejected. | Real correctness bug | **Fixed.** The check now compares chain indices (`CONFIG_INHERITANCE_CHAIN.indexOf(...)`) and rejects both directions with a distinct error message. Covered by a new regression test. |
| `ConfigModuleDefinition`/`ConfigFieldDefinition` had no lifecycle concept — a field or module was implicitly always "live," with no way to mark something draft, deprecated, or archived ahead of a Console UI existing. | Scaling risk | **Fixed.** `ConfigLifecycleState` added; every field defaults to `'published'` via `defineField()`; modules default to `'published'` via `registry.getModuleLifecycle()`. No existing module file had to change. |
| `ConfigModuleDependency` only recorded "depends on X," and the registry could not answer "what depends on me?" — required for any future safe-edit warning ("changing this affects: [...]"). | Missing extension point | **Fixed.** Added `registry.getDependents(moduleId)`, a pure inverse query over already-stored data. No new state, no runtime cost beyond a filter. |
| `'secret'`/`'password'` field types (e.g. `payments.stripe_secret_key`) store their value inline in the mock override store, the same as any other field. Rule 1 says nothing hardcoded is exempt, but *secrets specifically* must never live in Platform Configuration, full stop — this is a distinct rule from "everything is configuration." | Security risk if copied as a pattern | **Documented + typed.** Added `SecretReference` type (`src/config/types.ts`) as the contract a future Secret Provider integration must produce. The full architecture is Phase C below. The current inline mock value remains **only** as local-dev convenience and is explicitly called out as not a pattern to replicate. |
| `ConfigurationVersionManager.recordVersion()` exists but nothing calls it — module version bumps are a manual, deliberate action by whoever changes a module's schema, never triggered by a field-level write (those go through `ConfigurationAudit` instead). | Not a bug — a design decision that wasn't written down | **Documented.** See §5 (Versioning) below: module version and per-write audit are two different concerns and must stay that way. |
| `src/hooks/use-platform-configuration.ts` imports `usePermissions()` from the large `src/hooks/index.ts` barrel. | Acceptable coupling | **Not changed.** Reusing the existing RBAC hook (rather than reimplementing permission resolution) is Rule 3 in action, not a violation of it. Documented as an accepted, intentional dependency direction: `src/config` → RBAC is fine; RBAC must never import from `src/config`. |
| No duplicated configuration concepts were found beyond the above. Registry-level duplicate-id detection (module ids, field ids) already throws at import time, which is the mechanism that keeps Rule 3 enforced going forward, not code review vigilance alone. | — | No action needed. |

No working code was rewritten or redesigned. Every change above is additive:
new optional fields with safe defaults, new pure query functions, tightened
validation that only rejects inputs no legitimate caller was relying on
(verified by the full existing test suite passing unchanged).

## 2. Configuration First

If a value can differ between two tenants, two branches, two users, or two
points in time, it is configuration — it does not go in a constants file, an
inline default, or a component prop. This is not a style preference; it is
the difference between a SaaS platform and a single-tenant app with
multi-tenant decoration. Every new capability starts by asking "what part of
this varies by tenant?" and registering that part first.

## 3. Registry First

Development order is always:

```
Registry → Schema → Validation → Service → API Contract → UI
```

Never start from UI, never start from an API endpoint. A module that isn't
registered in `PlatformConfigurationRegistry` does not exist as far as
`ConfigurationService`, hooks, or (eventually) the Console are concerned —
there is no secondary path to read or write configuration. See
`docs/P9.0.1_DEVELOPER_GUIDE.md` for the concrete step-by-step.

## 4. Single Source of Truth

A configuration value, its default, its validation rule, its permission
requirement, and its label exist in exactly one `ConfigFieldDefinition`.
Never copy a default into a second file "just for this one screen" — read it
through `ConfigurationService`. The registry enforces this for ids
mechanically (duplicate field/module ids throw at import time); everything
else (don't duplicate a *value*, even under a different id) is enforced by
code review using the checklist in §12.

## 5. Inheritance

Every field's authoritative value flows:

```
Platform Default
     ↓
Tenant Override
     ↓
Branch Override
     ↓
User Preference
```

Every field declares, explicitly, no exceptions:

- **`level`** — which layer owns the default.
- **`canOverride`** — whether anything below that layer may set its own value.
- **`mode`** — `override` (replace), `merge` (shallow-merge objects/arrays), or
  `locked` (descendants can never win, full stop).
- **`fallback`** — what an unset descendant resolves to.

Writes are validated in **both directions**: a level below the owner is
rejected unless `canOverride` allows it; a level *above* the owner is
rejected unconditionally (a field owned at `tenant` cannot be written at
`platform` through `updateField()` — the owning level itself is always
writable, ancestors of it are not, by definition). This bidirectional check
was a P9.0.1 hardening fix (§1) — do not regress it when touching
`ConfigurationService.updateField()`.

## 6. Versioning

Two independent, deliberately separate mechanisms:

- **`ConfigurationAudit`** — records every individual field *write*: who,
  when, old value, new value, reason. High frequency, per-value.
- **`ConfigurationVersionManager`** — records *schema* changes to a module:
  a field was added/removed/retyped, a validation rule changed. Low
  frequency, per-module, manually invoked by whoever ships the schema
  change (`configurationVersionManager.recordVersion(moduleId, changeNote)`
  in the same PR that edits the module file).

Do not conflate these. A settings UI showing "who changed this value and
when" reads the audit log; a changelog showing "what changed in this
module's shape since v1.0.0" reads version history. See
`docs/P9.0.1_ARCHITECTURE_HARDENING.md` §E for snapshot/rollback design.

## 7. Auditability

Every write path (`ConfigurationService.updateField()`) is audited unless
the field explicitly opts out (`audit.trackHistory: false` — reserved for
fields where history is genuinely meaningless, not as a convenience escape
hatch). Fields marked `audit.sensitive: true` are redacted (`••••••`) in the
audit trail — never store or return the plaintext of a sensitive field in an
audit entry, even to a Platform Administrator. Fields marked
`audit.requireReason: true` reject writes with no `reason` string.

## 8. Module Registration

A module is not "done" until:

1. Its `ConfigModuleDefinition` is registered at import time in its own
   module file (never inside a request handler, hook, or component render —
   the registry seals after first read; see `src/config/registry.ts`).
2. It is imported from `src/config/index.ts`, after any module it depends on.
3. Every field carries full Rule 5 metadata (§10) — `defineField()` fills in
   safe defaults, but `id`, `title`, `type`, `default`, and `permissions` are
   never optional.

## 9. No Hardcoded Platform Logic

If a Platform Administrator could reasonably want to change it, it is not a
constant. This includes things that feel like "just a default" — OTP length,
trial days, max upload size, rate limits. The audit in
`docs/P9.0_PLATFORM_CONFIGURATION_AUDIT.md` documents what this replaced;
new code must not reintroduce the same pattern for new capabilities.

## 10. Every Field Has Metadata (Rule 5)

No anonymous configuration values. Every `ConfigFieldDefinition` carries:
`id`, `title`, `description`/`helpText`, `category`, `type`, `default`,
`validation`, `visibility`, `permissions`, `preview`, `inheritance`, `audit`,
`version`, `lifecycle`. `defineField()` exists specifically so authoring a
field that's missing one of these is a type error, not a code review catch.

## 11. Extensibility First

Adding a new platform module (AI, Inventory, CRM, POS, Gift Cards, Franchise,
Delivery, …) must never require touching `ConfigurationService`,
`ConfigurationResolver`, `ConfigurationValidator`, or any existing module
file. It is exactly: write the module file, register it, import it. If a new
module ever seems to need a change to core service code, that's a sign the
schema system (§10) is missing a capability — extend the schema system
itself (a new `ConfigFieldType`, a new preview kind), not the module's
one-off workaround. See `docs/P9.0.1_ARCHITECTURE_HARDENING.md` §H for how
`ConfigModuleDefinition` itself is expected to grow (health checks,
navigation, docs links) without becoming a second, parallel "manifest" type.

## 12. Dependency Rules

- A module may declare `dependencies: [{ moduleId, reason, type }]`.
- `type: 'hard'` (default) — the registry refuses to register a module
  before its hard dependencies exist. Get the import order right in
  `src/config/index.ts`.
- `type: 'soft'` — informational; the dependent reads the dependency's
  values when present but works without it (e.g. a preview that's richer
  when a related module is configured, but doesn't require it).
- Dependencies only point one direction. A circular dependency between two
  modules is not supported and will not register (module B cannot depend on
  module A if module A is imported after module B).
- Before changing a module's schema in a breaking way, check
  `registry.getDependents(moduleId)` for what else declares a dependency on
  it.

## 13. Future Modules

Every module in the roadmap (`docs/PLATFORM_ROADMAP.md`) plugs into this
exact foundation with zero new architecture. If a future module's needs
don't fit — a genuinely new field type, a genuinely new inheritance mode —
that is itself a signal to extend `src/config/types.ts` first, as a phase of
its own, before building the module. Do not special-case a module around a
schema-system gap.

## 14. Developer Workflow

See `docs/P9.0.1_DEVELOPER_GUIDE.md` for the full step-by-step (create a
module, register it, write hooks, update the API contract, extend mock data,
write tests, document it). The short version: Registry → Schema →
Validation → Service → API Contract → UI, always in that order, never
reversed.

## 15. Code Review Checklist

Before approving any PR that touches `src/config/*` or adds a new module:

- [ ] Every new field uses `defineField()` — no hand-built `ConfigFieldDefinition` object.
- [ ] Every field's `permissions.view`/`permissions.edit` reuse an existing key from `src/types/rbac.ts` — no new permission string invented without a reason.
- [ ] `inheritance.level`/`canOverride`/`mode`/`fallback` are set deliberately, not copy-pasted from an unrelated field.
- [ ] Secrets/passwords are never given a real default value in a module file — `''` or an obviously-fake placeholder only, and `audit.sensitive: true` is set.
- [ ] New module registered in `src/config/index.ts` in dependency order; `dependencies` declared if it reads another module's fields.
- [ ] No duplicate default/constant introduced elsewhere in the codebase for a value this field already owns.
- [ ] Tests added or updated in `src/test/p9-platform-configuration.test.ts` (or a new file following that naming) for any new resolver/validator/service behavior.
- [ ] `docs/BACKEND_API_CONTRACT.md` §36 updated if the change affects the shape of what the future backend must implement.

## 16. Architecture Checklist (before shipping a new module)

- [ ] Registered at import time, in a file under `src/config/modules/`.
- [ ] Every field has a category, a human-readable title, and a description or help text — not just an id.
- [ ] Validation covers every field where an invalid value would break something downstream (not just "required").
- [ ] Lifecycle defaults are correct — new, unproven fields should ship as `'testing'` or `'draft'`, not `'published'`, if they aren't ready for every tenant yet.
- [ ] Dependencies declared and registered in the correct order.
- [ ] Hooks (`src/hooks/use-platform-configuration.ts`) require no changes — if they do, the schema system is missing something (see §11).
- [ ] Mock data added (`src/config/mock-data.ts` or a module-scoped equivalent) demonstrating at least one non-trivial inheritance override.

## 17. Common Anti-patterns (reject these in review)

- **"I'll just add a constant for now"** — the exact pattern the P9.0 audit
  (`docs/P9.0_PLATFORM_CONFIGURATION_AUDIT.md`) found five times over and
  P9.0 exists to stop. If it's a Platform Administrator-controllable value,
  it's a field.
- **Reading `Tenant.settings` directly instead of `ConfigurationService`** —
  reintroduces the untyped bag problem the registry was built to replace.
- **A component-level `useState` holding a "draft" of a config value with no
  path through `ConfigurationService.updateField()`** — bypasses validation,
  audit, and permission checks.
- **Inventing a new permission string instead of reusing one from
  `src/types/rbac.ts`** — fragments the permission catalog (Rule 3 applies to
  permissions too, not just values).
- **A new module reaching into another module's file to read a default
  directly** (`import { AUTHENTICATION_MODULE } from '../modules/authentication'`)
  instead of `configurationService.resolveField('authentication.otp.length', scope)`
  — bypasses inheritance, validation, and cache; declare a `dependencies`
  entry and go through the service.
- **Storing a real secret value as a field default** — see §1's finding on
  `SecretReference`; the field can exist, but its resolved value must be a
  reference once a real Secret Provider exists, never plaintext.
- **Calling `platformConfigurationRegistry.register()` from inside a
  component, hook body, or API route handler** — the registry seals after
  first read; this throws, by design, the same way
  `src/modules/registry.ts` does.

---

## 18. Ownership & RBAC Principles (added P10.1)

> Companion reading: `docs/P10.0_RBAC_OWNERSHIP_ACCESS_AUDIT.md` (audit),
> `docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md` (full design), and
> `docs/BACKEND_API_CONTRACT.md` §39 (endpoint contract). These are
> **design-level, additive principles.** No code, mock data, or UI changed
> to introduce them; §8 of the companion document maps each principle back
> to the specific existing RBAC checks it constrains.

18.1 **Ownership is a relationship, not a role.** `Owner` is a distinct
entity from `Tenant` and from any value in the `Role`/`StaffRole` enum.
"Owning a tenant" is expressed by `Tenant.ownerId`, never by a role
assignment. A user can be an `Owner` without holding any P7 role at all.

18.2 **Tenant and Branch are never roles.** A permission check must never
branch on "is this user's role literally the string `'tenant'` or
`'branch'`" — those are resources being scoped to, not identities a user
holds. (P10.0 finding: this already holds today; §18.2 makes it a
standing rule so it isn't reintroduced.)

18.3 **Reuse the existing permission engine; do not fork it.** Staff
access under the Owner/Tenant/Branch model is expressed as new *data*
(`StaffAssignment` rows, §39.5) read by the *existing* `permission.service.ts`
resolution path and the *existing* `branch-access.service.ts` branch-scoping
primitives — not a second, parallel permission engine. A module that needs
cross-tenant staff scoping extends the data the engine reads, never
duplicates the engine.

18.4 **Migration fields are additive and nullable.** Any field introduced
to carry the new ownership model onto an existing entity (`Tenant.ownerId`,
`StaffMember.ownerId`) must be optional/nullable at the type level and
tolerate `null` at runtime for the lifetime of the migration window — a
record without the new field must continue to behave exactly as it does
today, never throw, never silently misbehave. Backfilling is a separate,
explicit operation (§10.3 of the companion document), not a side effect of
adding the field.

18.5 **Ownership transfer moves state, not identity.** Transferring a
tenant to a new owner (`docs/BACKEND_API_CONTRACT.md` §39.4) reassigns
`Tenant.ownerId` and carries the tenant's branches, Configuration Registry
settings, and historical data with it. It does not implicitly transfer,
revoke, or grant any `StaffAssignment` — staff access is owned by the
*staff member's owner*, not by the tenant, so a transfer is silent with
respect to staff until the new owner acts.

18.6 **A Customer's relationship to Tenant/Branch is earned through
history, never through ownership structure.** `PlatformUser` →
`BusinessCustomer` → `BranchCustomer` (`docs/BACKEND_API_CONTRACT.md` §34)
is reused unmodified; nothing in the Owner/Tenant/Branch/Staff model
above changes how a Customer relates to a business. Customers are never
assigned, granted, or scoped the way Staff are.
