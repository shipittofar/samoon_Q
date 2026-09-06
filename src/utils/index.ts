import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { parseDecimal } from './decimal'

export { parseDecimal } from './decimal'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: string | number | null | undefined,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseDecimal(amount))
}

export function formatDate(date: string | Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatTime(date: string | Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .trim()
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length).trim() + '…'
}

export function getDiscountedPrice(price: string | number, discount?: number): number {
  const numericPrice = parseDecimal(price)
  if (!discount) return numericPrice
  return numericPrice * (1 - discount / 100)
}

export function generateStars(rating: number): string {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5 ? 1 : 0
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half)
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (groups, item) => {
      const k = String(item[key])
      groups[k] = groups[k] ?? []
      groups[k].push(item)
      return groups
    },
    {} as Record<string, T[]>,
  )
}

export function isRTL(locale: string): boolean {
  return ['fa', 'ar', 'he', 'ur'].includes(locale)
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export { resolveMediaUrl, getMediaBaseUrl, isUnoptimizedMediaUrl } from './media-url'
export { buildPublicUrl, hrefToPublicUrl } from './public-url'
export { buildTenantNavigation, getSmartCTA, getBusinessTypeBadge } from './navigation'
export type { TenantNavLink, SmartCTA } from './navigation'
export {
  PUBLIC_BASE_URL,
  buildPublicSections,
  buildPublicCTAs,
  buildFooterLinks,
  buildTenantMetadata,
  buildBranchMetadata,
  buildTenantJsonLd,
  buildBranchJsonLd,
} from './public-context'
export type { PublicCTALink, PublicCTASet, FooterQuickLink } from './public-context'
export { buildCustomerJourney } from './journey'
export type { PrimaryBusinessType, CustomerJourney, BuildCustomerJourneyOptions } from './journey'
export {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  buildDrfPaginationParams,
  getTotalPages,
  paginateList,
  toPaginatedResponse,
} from './pagination'
export type { ResolvedDrfPaginationParams } from './pagination'
