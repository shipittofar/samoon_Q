'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Star, ShoppingBag, DollarSign, Percent, Loader2, AlertCircle, Mail, Phone } from 'lucide-react'
import { Badge } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useVendor, useVendorStats } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import type { VendorStatus } from '@/types'

const STATUS_BADGE: Record<VendorStatus, 'success' | 'warning' | 'secondary'> = {
  active: 'success',
  suspended: 'warning',
  pending: 'secondary',
  inactive: 'secondary',
}

const STATUS_KEY: Record<VendorStatus, string> = {
  active: 'statusActive',
  suspended: 'statusSuspended',
  pending: 'statusPending',
  inactive: 'statusInactive',
}

function VendorDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: vendor, isLoading, isError } = useVendor(id)
  const { data: stats } = useVendorStats(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-[var(--fg-muted)]">
        <Loader2 className="w-5 h-5 animate-spin"/>
        {t('loadingVendor')}
      </div>
    )
  }

  if (isError || !vendor) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertCircle className="w-8 h-8 text-[var(--danger-text)]"/>
        <p className="text-sm text-[var(--fg-muted)]">{t('vendorNotFound')}</p>
        <Link href="/console/vendors"className="text-sm text-[var(--info-text)] hover:underline">
          {t('backToVendors')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link href="/console/vendors"className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="w-3.5 h-3.5"/>
        {t('breadcrumbs.vendors')}
      </Link>

      {/* Header card */}
      <div className="bg-[var(--card)] border rounded-xl p-6">
        <div className="flex items-start gap-4 flex-wrap">
          {vendor.logoUrl && (
            <img src={vendor.logoUrl} alt={vendor.name} className="w-16 h-16 rounded-lg object-cover border"/>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--fg)]">{vendor.name}</h1>
              <Badge variant={STATUS_BADGE[vendor.status] ?? 'secondary'} className="capitalize">
                {t(STATUS_KEY[vendor.status] ?? 'statusInactive')}
              </Badge>
              {vendor.featured && <Badge variant="info">{t('featured')}</Badge>}
            </div>
            <p className="text-sm text-[var(--fg-muted)] mt-1">{vendor.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-[var(--fg-muted)]">
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-[var(--rating)]"/>
                {t('ratingWithCount', { rating: vendor.rating.toFixed(1), count: vendor.ratingCount })}
              </span>
              <span className="capitalize">{vendor.category.replace(/_/g, ' ')}</span>
              {vendor.stallNumber && <span>{t('stallNumberLabel', { number: vendor.stallNumber })}</span>}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[var(--fg-subtle)] text-xs">{t('contactEmailLabel')}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-[var(--fg-subtle)]"/>
              <span className="text-[var(--fg-secondary)]">{vendor.contactEmail}</span>
            </div>
          </div>
          {vendor.contactPhone && (
            <div>
              <p className="text-[var(--fg-subtle)] text-xs">{t('contactPhoneLabel')}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-[var(--fg-subtle)]"/>
                <span className="text-[var(--fg-secondary)]">{vendor.contactPhone}</span>
              </div>
            </div>
          )}
          <div>
            <p className="text-[var(--fg-subtle)] text-xs">{t('commissionRateLabel')}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Percent className="w-3.5 h-3.5 text-[var(--fg-subtle)]"/>
              <span className="text-[var(--fg-secondary)]">{vendor.commissionRate}%</span>
            </div>
          </div>
          <div>
            <p className="text-[var(--fg-subtle)] text-xs">{t('vendorIdLabel')}</p>
            <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">{vendor.id}</p>
          </div>
          <div>
            <p className="text-[var(--fg-subtle)] text-xs">{t('memberSinceLabel')}</p>
            <p className="text-[var(--fg-secondary)] mt-0.5">{formatDate(vendor.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('customerTableHeaders.orders'), value: stats.ordersCount.toLocaleString(), icon: ShoppingBag },
            { label: t('vendorRevenue'), value: formatCurrency(stats.revenue), icon: DollarSign },
            { label: t('commissionPaidLabel'), value: formatCurrency(stats.commissionPaid), icon: Percent },
            { label: t('avgRatingLabel'), value: stats.avgRating.toFixed(1), icon: Star },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-[var(--card)] border rounded-xl p-4">
              <Icon className="w-4 h-4 text-[var(--fg-subtle)] mb-2"/>
              <p className="text-xl font-bold text-[var(--fg)]">{value}</p>
              <p className="text-xs text-[var(--fg-subtle)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Vendor Detail">
      <PermissionGuard permission="vendors.view"fallback={<AccessDenied />}>
        <div className="min-h-screen bg-[var(--card-hover)]">
          <div className="pt-16">
            <VendorDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
