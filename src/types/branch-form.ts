import type { ImageFieldValue } from '@/components/ImageUploader'
import { EMPTY_IMAGE_FIELD } from '@/components/ImageUploader'
import { appendImageField } from '@/lib/multipart'
import {
  DEFAULT_BRANCH_CHECKOUT,
  mergeBranchCheckout,
} from '@/lib/branch-checkout'
import type {
  Branch,
  BranchBusinessHours,
  BranchCheckout,
  BranchType,
} from './branch'

export interface BranchFormState {
  name: string
  slug: string
  description: string
  type: BranchType
  address: string
  city: string
  country: string
  postalCode: string
  phone_number: string
  email: string
  image: ImageFieldValue
  coverImage: ImageFieldValue
  heroImage: ImageFieldValue
  timeZone: string
  currency: string
  language: string
  isDefault: boolean
  businessHours: BranchBusinessHours[]
  checkout: BranchCheckout
  marketplaceVisible: boolean
  reservationsEnabled: boolean
  maxCapacity?: number
  /** Comma-separated input in the form UI; stored as string[]. */
  cuisines: string
  amenities: string
}

const DAYS: BranchBusinessHours['day'][] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

export function defaultBranchFormBusinessHours(): BranchBusinessHours[] {
  return DAYS.map((day) => ({ day, open: '09:00', close: '22:00', isClosed: false }))
}

export const EMPTY_BRANCH_FORM: BranchFormState = {
  name: '',
  slug: '',
  description: '',
  type: 'physical',
  address: '',
  city: '',
  country: '',
  postalCode: '',
  phone_number: '',
  email: '',
  image: { ...EMPTY_IMAGE_FIELD },
  coverImage: { ...EMPTY_IMAGE_FIELD },
  heroImage: { ...EMPTY_IMAGE_FIELD },
  timeZone: '',
  currency: '',
  language: '',
  isDefault: false,
  businessHours: defaultBranchFormBusinessHours(),
  checkout: { ...DEFAULT_BRANCH_CHECKOUT },
  marketplaceVisible: true,
  reservationsEnabled: false,
  cuisines: '',
  amenities: '',
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SIMPLE_PHONE_RE = /^[+]?[\d\s()-]{7,20}$/

/** Empty required fields, invalid email/phone format, or invalid working hours (open >= close on an open day). */
export function validateBranchForm(form: BranchFormState): string | null {
  if (!form.name.trim() || !form.slug.trim() || !form.address.trim() || !form.city.trim() || !form.country.trim()) {
    return 'fillAllRequiredFieldsError'
  }
  if (!/^[a-z0-9-]+$/.test(form.slug.trim())) return 'invalidSlugError'
  if (form.email.trim() && !SIMPLE_EMAIL_RE.test(form.email.trim())) return 'invalidEmailError'
  if (form.phone_number.trim() && !SIMPLE_PHONE_RE.test(form.phone_number.trim())) return 'invalidPhoneError'
  for (const h of form.businessHours) {
    if (!h.isClosed && h.open >= h.close) return 'invalidWorkingHoursError'
  }
  return null
}

/** Multipart write request — `image`/`coverImage` are Files; response fields are CDN URLs. */
export interface BranchWriteRequest {
  name?: string
  slug?: string
  description?: string
  type?: BranchType
  location?: {
    address: string
    city: string
    country: string
    postalCode?: string
  }
  contact?: {
    phone_number?: string
    email?: string
  }
  managerId?: string
  businessHours?: BranchBusinessHours[]
  checkout?: BranchCheckout
  marketplaceVisible?: boolean
  reservationsEnabled?: boolean
  maxCapacity?: number
  image?: File
  coverImage?: File
  heroImage?: File
  removeImage?: boolean
  removeCoverImage?: boolean
  removeHeroImage?: boolean
  isDefault?: boolean
  timeZone?: string
  currency?: string
  language?: string
  cuisines?: string[]
  amenities?: string[]
}

function parseCommaList(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

export function branchFormToWriteRequest(form: BranchFormState): BranchWriteRequest {
  const request: BranchWriteRequest = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    location: {
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      postalCode: form.postalCode.trim() || undefined,
    },
    contact: {
      phone_number: form.phone_number.trim() || undefined,
      email: form.email.trim() || undefined,
    },
    businessHours: form.businessHours,
    checkout: form.checkout,
    marketplaceVisible: form.marketplaceVisible,
    reservationsEnabled: form.reservationsEnabled,
    maxCapacity: form.maxCapacity,
    isDefault: form.isDefault,
    timeZone: form.timeZone.trim() || undefined,
    currency: form.currency.trim() || undefined,
    language: form.language.trim() || undefined,
    cuisines: parseCommaList(form.cuisines),
    amenities: parseCommaList(form.amenities),
  }

  if (form.image.file) {
    request.image = form.image.file
  } else if (form.image.cleared) {
    request.removeImage = true
  }

  if (form.coverImage.file) {
    request.coverImage = form.coverImage.file
  } else if (form.coverImage.cleared) {
    request.removeCoverImage = true
  }

  if (form.heroImage.file) {
    request.heroImage = form.heroImage.file
  } else if (form.heroImage.cleared) {
    request.removeHeroImage = true
  }

  return request
}

export function buildBranchFormData(
  payload: BranchWriteRequest,
  options?: { tenantId?: string },
): FormData {
  const form = new FormData()

  if (options?.tenantId) {
    form.append('tenantId', options.tenantId)
  }

  if (payload.name != null) form.append('name', payload.name)
  if (payload.slug != null) form.append('slug', payload.slug)
  if (payload.description != null) form.append('description', payload.description)
  if (payload.type != null) form.append('type', payload.type)
  if (payload.location != null) form.append('location', JSON.stringify(payload.location))
  if (payload.contact != null) form.append('contact', JSON.stringify(payload.contact))
  if (payload.managerId != null) form.append('managerId', payload.managerId)
  if (payload.businessHours != null) form.append('businessHours', JSON.stringify(payload.businessHours))
  if (payload.checkout != null) form.append('checkout', JSON.stringify(payload.checkout))
  if (payload.marketplaceVisible != null) form.append('marketplaceVisible', String(payload.marketplaceVisible))
  if (payload.reservationsEnabled != null) form.append('reservationsEnabled', String(payload.reservationsEnabled))
  if (payload.maxCapacity != null) form.append('maxCapacity', String(payload.maxCapacity))
  if (payload.isDefault != null) form.append('isDefault', String(payload.isDefault))
  if (payload.timeZone != null) form.append('timeZone', payload.timeZone)
  if (payload.currency != null) form.append('currency', payload.currency)
  if (payload.language != null) form.append('language', payload.language)
  if (payload.cuisines != null) form.append('cuisines', JSON.stringify(payload.cuisines))
  if (payload.amenities != null) form.append('amenities', JSON.stringify(payload.amenities))

  appendImageField(form, 'image', payload.image, payload.removeImage)
  appendImageField(form, 'coverImage', payload.coverImage, payload.removeCoverImage)
  appendImageField(form, 'heroImage', payload.heroImage, payload.removeHeroImage)

  return form
}

export function branchToFormInput(branch: Branch): BranchFormState {
  return {
    name: branch.name,
    slug: branch.slug,
    description: branch.description ?? '',
    type: branch.type,
    address: branch.location.address,
    city: branch.location.city,
    country: branch.location.country,
    postalCode: branch.location.postalCode ?? '',
    phone_number: branch.contact.phone_number ?? '',
    email: branch.contact.email ?? '',
    image: {
      file: null,
      existingUrl: branch.image ?? '',
      cleared: false,
    },
    coverImage: {
      file: null,
      existingUrl: branch.coverImage ?? '',
      cleared: false,
    },
    heroImage: {
      file: null,
      existingUrl: branch.heroImage ?? '',
      cleared: false,
    },
    timeZone: branch.timeZone ?? '',
    currency: branch.currency ?? '',
    language: branch.language ?? '',
    isDefault: branch.isDefault ?? false,
    businessHours: branch.businessHours.length > 0 ? branch.businessHours : defaultBranchFormBusinessHours(),
    checkout: mergeBranchCheckout(DEFAULT_BRANCH_CHECKOUT, branch.checkout),
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
    cuisines: (branch.cuisines ?? []).join(', '),
    amenities: (branch.amenities ?? []).join(', '),
  }
}
