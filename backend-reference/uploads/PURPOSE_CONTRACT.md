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

## Platform homepage hero

Django stores the hero: `GET /api/platform/homepage/hero/` (public; 404 until a
superuser saves one, and the Next BFF then shows its built-in default) and
`PUT` (platform superusers only), model `platform_settings.PlatformSetting`
key `homepage.hero`.

Hero images are uploaded with `purpose=website_media`, `entity_type=platform`,
`entity_id=homepage` and **no** `tenant_id` (platform superusers only, see
`uploads/authorization.py`). Each frame sends its `assetId`; saving the hero
marks those uploads ATTACHED (so orphan cleanup never deletes them) and
detaches the ones the new hero no longer uses.

## Branch direct upload

Branch create/update accept `image_asset_id` / `cover_image_asset_id` / `hero_image_asset_id`. Legacy multipart `image` / `cover_image` / `hero_image` binary fields remain on some serializers for compatibility; console uses direct uploads only.
