import type { ImageFieldValue } from '@/components/ImageUploader'
import { EMPTY_IMAGE_FIELD } from '@/components/ImageUploader'
import {
  DEFAULT_BRANCH_CHECKOUT,
  mergeBranchCheckout,
} from '@/lib/branch-checkout'
import { checkoutConfigKeyToWire } from '@/lib/checkout-options'
import { parseMapCoordinates } from '@/lib/coordinates'
import type {
  Branch,
  BranchBusinessHours,
  BranchCheckout,
  BranchType,
} from './branch'

export interface BranchFormState {
  name: string
  description: string
  type: BranchType
  address: string
  city: string
  country: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  phone_number: string
  email: string
  website: string
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
  cuisines: string[]
  amenities: string[]
}

const DAYS: BranchBusinessHours['day'][] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

export function defaultBranchFormBusinessHours(): BranchBusinessHours[] {
  return DAYS.map((day) => ({ day, open: '09:00', close: '22:00', isClosed: false }))
}

export const EMPTY_BRANCH_FORM: BranchFormState = {
  name: '',
  description: '',
  type: 'physical',
  address: '',
  city: '',
  country: '',
  postalCode: '',
  latitude: null,
  longitude: null,
  phone_number: '',
  email: '',
  website: '',
  image: { ...EMPTY_IMAGE_FIELD },
  coverImage: { ...EMPTY_IMAGE_FIELD },
  heroImage: { ...EMPTY_IMAGE_FIELD },
  timeZone: '',
  currency: '',
  language: '',
  isDefault: false,
  businessHours: defaultBranchFormBusinessHours(),
  checkout: {
    ...DEFAULT_BRANCH_CHECKOUT,
    orderTypes: { ...DEFAULT_BRANCH_CHECKOUT.orderTypes },
    payments: { ...DEFAULT_BRANCH_CHECKOUT.payments },
    delivery: { ...DEFAULT_BRANCH_CHECKOUT.delivery },
  },
  marketplaceVisible: true,
  reservationsEnabled: false,
  cuisines: [],
  amenities: [],
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SIMPLE_PHONE_RE = /^[+]?[\d\s()-]{7,20}$/
const SIMPLE_WEBSITE_RE = /^https?:\/\/[^\s]+$/i

export type BranchCreateStep =
  | 'basic'
  | 'location'
  | 'contact'
  | 'media'
  | 'operations'
  | 'catalog'

function uniqueBusinessDays(hours: BranchBusinessHours[]): BranchBusinessHours[] {
  const seen = new Set<string>()
  const out: BranchBusinessHours[] = []
  for (const day of DAYS) {
    const match = hours.find((h) => h.day === day)
    if (match && !seen.has(day)) {
      seen.add(day)
      out.push(match)
    } else if (!seen.has(day)) {
      seen.add(day)
      out.push({ day, open: '09:00', close: '22:00', isClosed: false })
    }
  }
  return out
}

function hoursError(form: BranchFormState): string | null {
  for (const h of uniqueBusinessDays(form.businessHours)) {
    if (!h.isClosed && h.open >= h.close) return 'invalidWorkingHoursError'
  }
  return null
}

function contactFormatError(form: BranchFormState): string | null {
  if (form.email.trim() && !SIMPLE_EMAIL_RE.test(form.email.trim())) return 'invalidEmailError'
  if (form.phone_number.trim() && !SIMPLE_PHONE_RE.test(form.phone_number.trim())) return 'invalidPhoneError'
  if (form.website.trim() && !SIMPLE_WEBSITE_RE.test(form.website.trim())) return 'invalidWebsiteError'
  return null
}

/** Edit-form validation. Slug is backend-owned and is not collected or sent. */
export function validateBranchForm(form: BranchFormState): string | null {
  if (!form.name.trim() || !form.address.trim() || !form.city.trim() || !form.country.trim()) {
    return 'fillAllRequiredFieldsError'
  }
  const contact = contactFormatError(form)
  if (contact) return contact
  return hoursError(form)
}

export function validateBranchCreateStep(form: BranchFormState, step: BranchCreateStep): string | null {
  if (step === 'basic') {
    if (!form.name.trim()) return 'fillAllRequiredFieldsError'
    return null
  }
  if (step === 'location') {
    if (!form.address.trim() || !form.city.trim() || !form.country.trim()) return 'fillAllRequiredFieldsError'
    return null
  }
  if (step === 'contact') return contactFormatError(form)
  if (step === 'operations') return hoursError(form)
  return null
}

export function validateBranchCreateForm(form: BranchFormState): string | null {
  for (const step of ['basic', 'location', 'contact', 'operations'] as const) {
    const err = validateBranchCreateStep(form, step)
    if (err) return err
  }
  return null
}

export interface BranchWriteLocation {
  address: string
  city: string
  country: string
  postalCode?: string
  latitude?: number | null
  longitude?: number | null
}

export interface BranchWriteContact {
  phone_number?: string
  email?: string
  website?: string
}

/** Multipart write request for update (nested checkout still used). */
export interface BranchWriteRequest {
  name?: string
  description?: string
  type?: BranchType
  location?: BranchWriteLocation
  contact?: BranchWriteContact
  managerId?: string
  businessHours?: BranchBusinessHours[]
  checkout?: BranchCheckout
  marketplaceVisible?: boolean
  reservationsEnabled?: boolean
  maxCapacity?: number
  image_asset_id?: import('@/types/upload').AssetId | null
  cover_image_asset_id?: import('@/types/upload').AssetId | null
  hero_image_asset_id?: import('@/types/upload').AssetId | null
  isDefault?: boolean
  timeZone?: string
  currency?: string
  language?: string
  cuisines?: string[]
  amenities?: string[]
}

/** Canonical console create payload — flattened checkout, no slug. */
export interface BranchCreateRequest {
  name: string
  description?: string
  type: BranchType
  location: BranchWriteLocation
  contact?: BranchWriteContact
  businessHours: BranchBusinessHours[]
  isDefault?: boolean
  orderingEnabled: boolean
  deliveryEnabled: boolean
  pickupEnabled: boolean
  tableOrderingEnabled: boolean
  deliveryRadius?: number
  minimumOrder?: string
  defaultOrderType?: string
  cashPaymentEnabled: boolean
  cardPaymentEnabled: boolean
  onlinePaymentEnabled: boolean
  walletPaymentEnabled: boolean
  cashOnDeliveryEnabled: boolean
  defaultPaymentMethod?: string
  sameDayDeliveryEnabled: boolean
  scheduledDeliveryEnabled: boolean
  contactlessDeliveryEnabled: boolean
  marketplaceVisible: boolean
  reservationsEnabled: boolean
  maxCapacity?: number
  cuisines?: string[]
  amenities?: string[]
  image_asset_id?: import('@/types/upload').AssetId | null
  cover_image_asset_id?: import('@/types/upload').AssetId | null
  hero_image_asset_id?: import('@/types/upload').AssetId | null
}

function buildLocation(
  form: BranchFormState,
  options?: { emitNullCoordinates?: boolean },
): BranchWriteLocation {
  const location: BranchWriteLocation = {
    address: form.address.trim(),
    city: form.city.trim(),
    country: form.country.trim(),
    postalCode: form.postalCode.trim() || undefined,
  }
  const coords = parseMapCoordinates(form.latitude, form.longitude)
  if (coords) {
    location.latitude = coords.lat
    location.longitude = coords.lng
  } else if (options?.emitNullCoordinates) {
    location.latitude = null
    location.longitude = null
  }
  return location
}

function buildContact(form: BranchFormState): BranchWriteContact {
  return {
    phone_number: form.phone_number.trim() || undefined,
    email: form.email.trim() || undefined,
    website: form.website.trim() || undefined,
  }
}

function appendImagesFromForm(
  request: {
    image_asset_id?: string | null
    cover_image_asset_id?: string | null
    hero_image_asset_id?: string | null
  },
  form: BranchFormState,
) {
  if (!form.image.file && form.image.cleared) request.image_asset_id = null
  if (!form.coverImage.file && form.coverImage.cleared) request.cover_image_asset_id = null
  if (!form.heroImage.file && form.heroImage.cleared) request.hero_image_asset_id = null
}

export function flattenCheckoutForCreate(checkout: BranchCheckout): Pick<
  BranchCreateRequest,
  | 'orderingEnabled'
  | 'deliveryEnabled'
  | 'pickupEnabled'
  | 'tableOrderingEnabled'
  | 'deliveryRadius'
  | 'minimumOrder'
  | 'defaultOrderType'
  | 'cashPaymentEnabled'
  | 'cardPaymentEnabled'
  | 'onlinePaymentEnabled'
  | 'walletPaymentEnabled'
  | 'cashOnDeliveryEnabled'
  | 'defaultPaymentMethod'
  | 'sameDayDeliveryEnabled'
  | 'scheduledDeliveryEnabled'
  | 'contactlessDeliveryEnabled'
> {
  const defaultOrder = checkout.orderTypes.default
  const defaultPayment = checkout.payments.default
  return {
    orderingEnabled: checkout.orderingEnabled,
    deliveryEnabled: !!checkout.orderTypes.delivery,
    pickupEnabled: !!checkout.orderTypes.pickup,
    tableOrderingEnabled: !!checkout.orderTypes.dineIn,
    deliveryRadius: checkout.delivery.radius ?? undefined,
    minimumOrder: checkout.delivery.minimumOrder ?? undefined,
    defaultOrderType: defaultOrder ? checkoutConfigKeyToWire(String(defaultOrder)) : undefined,
    cashPaymentEnabled: !!checkout.payments.cash,
    cardPaymentEnabled: !!checkout.payments.card,
    onlinePaymentEnabled: !!checkout.payments.online,
    walletPaymentEnabled: !!checkout.payments.wallet,
    cashOnDeliveryEnabled: !!checkout.payments.cashOnDelivery,
    defaultPaymentMethod: defaultPayment ? checkoutConfigKeyToWire(String(defaultPayment)) : undefined,
    sameDayDeliveryEnabled: !!checkout.delivery.sameDay,
    scheduledDeliveryEnabled: !!checkout.delivery.scheduled,
    contactlessDeliveryEnabled: !!checkout.delivery.contactless,
  }
}

export function branchFormToWriteRequest(form: BranchFormState): BranchWriteRequest {
  const request: BranchWriteRequest = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    location: buildLocation(form, { emitNullCoordinates: true }),
    contact: buildContact(form),
    businessHours: uniqueBusinessDays(form.businessHours),
    checkout: form.checkout,
    marketplaceVisible: form.marketplaceVisible,
    reservationsEnabled: form.reservationsEnabled,
    maxCapacity: form.maxCapacity,
    isDefault: form.isDefault,
    timeZone: form.timeZone.trim() || undefined,
    currency: form.currency.trim() || undefined,
    language: form.language.trim() || undefined,
    cuisines: form.cuisines,
    amenities: form.amenities,
  }
  appendImagesFromForm(request, form)
  return request
}

export function branchFormToCreateRequest(form: BranchFormState): BranchCreateRequest {
  const contact = buildContact(form)
  const hasContact = Boolean(contact.phone_number || contact.email || contact.website)
  const request: BranchCreateRequest = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    location: buildLocation(form),
    contact: hasContact ? contact : undefined,
    businessHours: uniqueBusinessDays(form.businessHours),
    isDefault: form.isDefault,
    ...flattenCheckoutForCreate(form.checkout),
    marketplaceVisible: form.marketplaceVisible,
    reservationsEnabled: form.reservationsEnabled,
    maxCapacity: form.maxCapacity,
    cuisines: form.cuisines,
    amenities: form.amenities,
  }
  appendImagesFromForm(request, form)
  return request
}

export function mapBranchUpdateError(err: unknown): string {
  const ax = err as { response?: { status?: number; data?: unknown }; message?: string }
  const status = ax.response?.status
  const message = (err instanceof Error ? err.message : ax.message) ?? ''
  const dataStr = typeof ax.response?.data === 'string'
    ? ax.response.data
    : JSON.stringify(ax.response?.data ?? '')
  const blob = `${message} ${dataStr}`
  if (status === 401 || status === 403) return 'branchUpdateForbidden'
  if (status === 404) return 'branchUpdateNotFound'
  if (message === 'duplicate_slug' || /duplicate[_ ]?slug/i.test(blob)) return 'duplicateSlugError'
  if (/duplicate[_ ]?(branch|name)|already exists/i.test(blob)) return 'duplicateBranchNameError'
  if (status === 400) return 'branchUpdateValidationError'
  return 'failedToUpdateBranchRetry'
}

export function mapBranchCreateError(err: unknown): string {
  const ax = err as { response?: { status?: number; data?: unknown }; message?: string }
  const status = ax.response?.status
  const message = (err instanceof Error ? err.message : ax.message) ?? ''
  const dataStr = typeof ax.response?.data === 'string'
    ? ax.response.data
    : JSON.stringify(ax.response?.data ?? '')
  const blob = `${message} ${dataStr}`
  if (status === 403) return 'branchCreateForbidden'
  if (status === 404) return 'branchCreateTenantNotFound'
  if (
    message === 'duplicate_branch' ||
    message === 'duplicate_name' ||
    /duplicate[_ ]?(branch|name)|already exists/i.test(blob)
  ) {
    return 'duplicateBranchNameError'
  }
  if (status === 400) return 'branchCreateValidationError'
  return 'failedToCreateBranchRetry'
}

/** Neutral base for Edit hydration — does not apply Create form defaults. */
const HYDRATE_CHECKOUT_BASE: BranchCheckout = {
  orderingEnabled: false,
  orderTypes: {
    delivery: false,
    pickup: false,
    dineIn: false,
    default: null,
  },
  payments: {
    cash: false,
    cashOnDelivery: false,
    card: false,
    online: false,
    wallet: false,
    default: null,
  },
  delivery: {
    radius: null,
    minimumOrder: null,
    sameDay: false,
    scheduled: false,
    contactless: false,
  },
}

export function hydrateBranchCheckout(checkout?: BranchCheckout): BranchCheckout {
  return mergeBranchCheckout(HYDRATE_CHECKOUT_BASE, checkout)
}

export function branchToFormInput(branch: Branch): BranchFormState {
  const coords = parseMapCoordinates(branch.location.latitude, branch.location.longitude)
  return {
    name: branch.name,
    description: branch.description ?? '',
    type: branch.type,
    address: branch.location.address,
    city: branch.location.city,
    country: branch.location.country,
    postalCode: branch.location.postalCode ?? '',
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    phone_number: branch.contact.phone_number ?? '',
    email: branch.contact.email ?? '',
    website: branch.contact.website ?? '',
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
    businessHours: uniqueBusinessDays(
      branch.businessHours.length > 0 ? branch.businessHours : defaultBranchFormBusinessHours(),
    ),
    checkout: hydrateBranchCheckout(branch.checkout),
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
    cuisines: branch.cuisines ?? [],
    amenities: branch.amenities ?? [],
  }
}
