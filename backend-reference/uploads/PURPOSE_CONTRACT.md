# Upload purpose contract (Django)

Source of truth observed from live OpenAPI (`GET /api/schema/`, `PurposeEnum`):

```text
branch_cover
branch_hero
branch_logo
menu_category
menu_item
menu_tag
tenant_discover_avatar
tenant_discover_cover
tenant_hero
tenant_logo
user_avatar
website_media
```

## Authorization (initiate description)

- `user_avatar` — self; no `tenant_id`
- `tenant_*` and `website_media` — `settings.edit`; **`tenant_id` required**
- `menu_*` — `menu.manage` + **`branch_id` required** (Branch UUID); `tenant_id` required
- `branch_*` — tenant-scoped; **`tenant_id` required**. `branch_id` / `entity_id` optional until the branch exists. Do not send `entity_type=branch` without `entity_id` — initiate then returns `entity_id (branch) is required`. Attach with `image_asset_id` / `cover_image_asset_id` / `hero_image_asset_id` on branch create.

## Frontend → backend mapping (stale names removed)

| Former FE purpose | Canonical purpose | Required context | Business attach |
| --- | --- | --- | --- |
| `branch_image` | `branch_logo` | `tenant_id` | Branch `image_asset_id` |
| `branch_cover` | `branch_cover` | `tenant_id` | Branch `cover_image_asset_id` |
| `branch_hero` | `branch_hero` | `tenant_id` | Branch `hero_image_asset_id` |
| `platform_hero` | `website_media` | `tenant_id` (tenant website); platform homepage has **no** PurposeEnum entry | Tenant website layout URLs / platform BFF URLs |
| `website_hero` | `website_media` | `tenant_id` | Tenant website hero backgrounds |
| `tenant_gallery` | `website_media` | `tenant_id` | Marketplace gallery URLs in tenant settings |
| `avatar` | `user_avatar` | none | `PATCH …/avatar/` with `avatar_asset_id` |
| `menu_extra` | `menu_item` | `tenant_id` + `branch_id` | Extra API has **no** image field today; upload ignored on attach |

## Platform homepage gap

Django `PurposeEnum` has **no** platform-scoped purpose. Platform homepage hero is a Next BFF (`/api/platform/homepage/hero/`) that stores CDN URLs; Django `/api/platform/homepage/hero/` returns 404.

Frontend maps platform hero uploads to `website_media` (only freeform-media purpose in the enum). That purpose still requires `tenant_id` per initiate rules, so **platform-admin hero file upload remains incomplete** until the backend either:

1. Adds `platform_hero` (recommended): platform superuser auth, **no** `tenant_id`, attach = platform homepage CMS; or
2. Explicitly allows platform superusers to initiate `website_media` with `tenant_id=null` and `entity_type=platform`.

Do **not** invent a fake tenant_id for platform assets.

## Branch direct upload

Branch create/update accept `image_asset_id` / `cover_image_asset_id` / `hero_image_asset_id`. Legacy multipart `image` / `cover_image` / `hero_image` binary fields remain on some serializers for compatibility; console uses direct uploads only.
