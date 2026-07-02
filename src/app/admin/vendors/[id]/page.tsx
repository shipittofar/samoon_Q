'use client'

import { use } from 'react'
import Link from 'next/link'
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

function VendorDetailContent({ id }: { id: string }) {
  const { data: vendor, isLoading, isError } = useVendor(id)
  const { data: stats } = useVendorStats(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading vendor…
      </div>
    )
  }

  if (isError || !vendor) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-600">Vendor not found.</p>
        <Link href="/admin/vendors" className="text-sm text-blue-600 hover:underline">
          Back to Vendors
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link href="/admin/vendors" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-3.5 h-3.5" />
        Vendors
      </Link>

      {/* Header card */}
      <div className="bg-white border rounded-xl p-6">
        <div className="flex items-start gap-4 flex-wrap">
          {vendor.logoUrl && (
            <img src={vendor.logoUrl} alt={vendor.name} className="w-16 h-16 rounded-lg object-cover border" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
              <Badge variant={STATUS_BADGE[vendor.status] ?? 'secondary'} className="capitalize">
                {vendor.status}
              </Badge>
              {vendor.featured && <Badge variant="info">Featured</Badge>}
            </div>
            <p className="text-sm text-gray-500 mt-1">{vendor.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                {vendor.rating.toFixed(1)} ({vendor.ratingCount} ratings)
              </span>
              <span className="capitalize">{vendor.category.replace(/_/g, ' ')}</span>
              {vendor.stallNumber && <span>Stall {vendor.stallNumber}</span>}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Contact Email</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-700">{vendor.contactEmail}</span>
            </div>
          </div>
          {vendor.contactPhone && (
            <div>
              <p className="text-gray-400 text-xs">Contact Phone</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-700">{vendor.contactPhone}</span>
              </div>
            </div>
          )}
          <div>
            <p className="text-gray-400 text-xs">Commission Rate</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Percent className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-700">{vendor.commissionRate}%</span>
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Vendor ID</p>
            <p className="font-mono text-xs text-gray-500 mt-0.5">{vendor.id}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Member Since</p>
            <p className="text-gray-700 mt-0.5">{formatDate(vendor.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Orders', value: stats.ordersCount.toLocaleString(), icon: ShoppingBag },
            { label: 'Revenue', value: formatCurrency(stats.revenue), icon: DollarSign },
            { label: 'Commission Paid', value: formatCurrency(stats.commissionPaid), icon: Percent },
            { label: 'Avg Rating', value: stats.avgRating.toFixed(1), icon: Star },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white border rounded-xl p-4">
              <Icon className="w-4 h-4 text-gray-400 mb-2" />
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
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
      <PermissionGuard permission="vendors.view" fallback={<AccessDenied />}>
        <div className="min-h-screen bg-gray-50">
          <div className="pt-16">
            <VendorDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
