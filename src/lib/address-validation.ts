import { z } from 'zod'
import type { AddressType } from '@/types/address'

export const ADDRESS_TYPES = ['home', 'work', 'office', 'warehouse', 'other'] as const satisfies readonly AddressType[]

/** Form schema — phone is injected from auth profile, never collected in the UI. */
export const userAddressSchema = z.object({
  address_type: z.enum(ADDRESS_TYPES),
  custom_label: z.string().max(64).optional().nullable(),
  country: z.string().min(2, 'required').max(2),
  province: z.string().min(1, 'required').max(128),
  city: z.string().min(1, 'required').max(128),
  district: z.string().min(1, 'required').max(128),
  street: z.string().min(1, 'required').max(256),
  building_number: z.string().max(32).optional().nullable(),
  unit: z.string().max(32).optional().nullable(),
  floor: z.string().max(16).optional().nullable(),
  postal_code: z.string().min(1, 'required').max(20),
  delivery_notes: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  is_default: z.boolean().optional(),
})

export type UserAddressFormData = z.infer<typeof userAddressSchema>

export const deliveryOverrideSchema = z.object({
  delivery_notes: z.string().max(500).optional().nullable(),
  unit: z.string().max(32).optional().nullable(),
  floor: z.string().max(16).optional().nullable(),
  building_number: z.string().max(32).optional().nullable(),
})
