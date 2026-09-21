import type { ImageFieldValue } from '@/components/ImageUploader'
import type { AssetId } from '@/types/upload'

/** JSON identity-image write for PATCH /tenants/{id}/. */
export interface TenantMediaWriteRequest {
  image_asset_id?: AssetId | null
  discover_avatar_asset_id?: AssetId | null
  discover_cover_asset_id?: AssetId | null
  hero_image_asset_id?: AssetId | null
}

export function imageFieldToMediaPatch(
  field: ImageFieldValue,
  key: keyof TenantMediaWriteRequest,
  uploadedAssetId?: AssetId,
): Partial<TenantMediaWriteRequest> {
  if (uploadedAssetId) return { [key]: uploadedAssetId }
  if (field.cleared) return { [key]: null }
  return {}
}
