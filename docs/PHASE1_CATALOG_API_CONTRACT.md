# Phase 1 — Catalog API Contract (Business Verticals)

> Status: **frontend implemented against mock data** · backend: to implement
> Roadmap: [BUSINESS_SERVICES_ROADMAP.md](BUSINESS_SERVICES_ROADMAP.md) · Source of truth for shapes: `src/verticals/registry.ts`

Phase 1 lets the platform host non-food businesses. The first two verticals are
**beauty salon / barber** (`beauty_salon`) and **clinic / medical** (`clinic`).
Everything here is **additive and backward compatible**: existing food tenants,
menu items and payloads do not change.

---

## 1. Business types

Add two values wherever business types are validated (Tenant `business_types`,
provisioning `business_type`, module keys):

| value | family | cart / online ordering | notes |
|---|---|---|---|
| `restaurant`, `cafe`, `bar`, `food_court`, `food_truck`, `mobile_cafe` | food | yes | unchanged |
| `beauty_salon` | service | **no** | services, packages and retail products |
| `clinic` | service | **no** | services and packages only |

`Tenant.business_types` keeps its meaning (module keys). A tenant's *vertical*
is the first known value in that array.

### Provisioning

`POST` tenant provision accepts `business_type: "beauty_salon" | "clinic"`.
Recommended default feature flags (the frontend sends these as `settings.featureFlags`):

```json
{
  "menu.enabled": true,
  "ordering.enabled": false,
  "qr_table.enabled": false,
  "delivery.enabled": false,
  "reservations.enabled": true,
  "reviews.enabled": true,
  "promotions.enabled": true,      // clinic: false
  "analytics.enabled": true,
  "notifications.enabled": true
}
```

Branches of service tenants should have no online order types enabled in their
checkout config (the frontend also hides the cart for service verticals regardless).

---

## 2. Menu item → catalog item (two new optional fields)

The existing menu item resource is reused — same endpoints, same branch scoping.
Two **optional** fields are added to read and write payloads:

| field | type | default when absent | meaning |
|---|---|---|---|
| `item_kind` | `"product" \| "service" \| "package"` | vertical default (`product` for food, `service` for salon/clinic) | what the entry is |
| `attributes` | object (flat, see §3) | `{}` | vertical-specific fields |

### Read (GET item / list)

```json
{
  "id": "…",
  "branch_id": "…",
  "category_id": "…",
  "name": "Women's haircut",
  "description": "Wash, cut and blow-dry",
  "price": 450000,
  "item_kind": "service",
  "attributes": {
    "duration_minutes": 60,
    "price_is_starting": true,
    "requires_appointment": true,
    "audience": "women"
  },
  "...": "all existing fields unchanged"
}
```

Legacy rows may omit both fields — the frontend treats that as the vertical default.

### Write (POST / PATCH item)

- **Food tenants:** the frontend sends **exactly the legacy payload** — no `item_kind`, no `attributes`.
- **Service tenants:** the frontend omits `calories` and `preparation_time`, and sends `item_kind` + `attributes`.
  `preparation_time` must therefore be **optional** (nullable) for service tenants.

```json
{
  "name": "General consultation",
  "description": "",
  "price": 800000,
  "category_id": "…",
  "available": true,
  "is_active": true,
  "is_featured": false,
  "is_popular": false,
  "tag_ids": [],
  "item_kind": "service",
  "attributes": {
    "duration_minutes": 20,
    "requires_appointment": true,
    "consultation_mode": "both"
  }
}
```

---

## 3. Attribute schema per vertical

Attributes are a flat JSON object. The frontend only sends keys that apply to the
item's kind, already typed and validated; the backend should **validate the same rules**
and reject (400) unknown keys or wrong types for the tenant's vertical.

### Shared by `beauty_salon` and `clinic` (kinds: `service`, `package`)

| key | type | rules |
|---|---|---|
| `duration_minutes` | integer | 5 ≤ n ≤ 1440 |
| `price_is_starting` | boolean | price is a "from" price |
| `requires_appointment` | boolean | must be booked in advance |

### `beauty_salon` only (kinds: `service`, `package`)

| key | type | allowed values |
|---|---|---|
| `audience` | string enum | `all`, `women`, `men`, `kids` |

Item kinds: `service` (default), `package`, `product` (retail products have no attributes).

### `clinic` only (all kinds)

| key | type | allowed values |
|---|---|---|
| `consultation_mode` | string enum | `in_person`, `online`, `both` |
| `preparation_notes` | string | free text, trimmed, max length suggested 1000 |

Item kinds: `service` (default), `package`.

### Suggested Django model change

```python
class MenuItem(models.Model):
    # … existing fields …
    item_kind = models.CharField(max_length=16, choices=ITEM_KIND_CHOICES, null=True, blank=True)
    attributes = models.JSONField(default=dict, blank=True)
    preparation_time = models.PositiveIntegerField(null=True, blank=True)  # was required
```

Validation lives in the serializer, keyed by the branch's tenant vertical, mirroring
`src/verticals/registry.ts` (consider generating both from one JSON schema later).

---

## 4. Filtering (optional, nice to have)

`GET` list may accept `item_kind=service|package|product` to filter. Not required by the
current frontend.

---

## 5. Out of scope for Phase 1

- Multiple menus per business, schedules, per-branch price overrides — **Phase 2**.
- Appointments (staff, slots, booking flow) — **Phase 3**; until then `reservations` is the booking channel.
- AI image generation — **Phase 4**.
