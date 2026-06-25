'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Tag, Calendar, Percent, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { usePromotions } from '@/hooks'
import { formatDate } from '@/utils'
import type { PromotionType } from '@/types'

const TYPE_LABEL: Record<PromotionType, string> = {
  percentage_discount: 'Percentage Discount',
  fixed_discount:      'Fixed Discount',
  buy_one_get_one:     'Buy One Get One',
  happy_hour:          'Happy Hour',
}

function PromotionDetailContent({ id }: { id: string }) {
  const { data: promotions, isLoading, isError } = usePromotions()
  const promotion = promotions?.find((p) => p.id === id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading promotion…
      </div>
    )
  }

  if (isError || !promotion) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <XCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-600">Promotion not found.</p>
        <Link href="/admin/promotions" className="text-sm text-blue-600 hover:underline">
          Back to Promotions
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link href="/admin/promotions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-3.5 h-3.5" />
        Promotions
      </Link>

      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Tag className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{promotion.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{promotion.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {promotion.active ? (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Inactive
              </Badge>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t text-sm">
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Type</dt>
            <dd className="font-medium text-gray-800">{TYPE_LABEL[promotion.type]}</dd>
          </div>
          {promotion.discountPercent !== undefined && (
            <div>
              <dt className="text-gray-400 text-xs mb-0.5">Discount</dt>
              <dd className="font-medium text-gray-800 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5" />
                {promotion.discountPercent}%
              </dd>
            </div>
          )}
          {promotion.discountAmount !== undefined && (
            <div>
              <dt className="text-gray-400 text-xs mb-0.5">Fixed Amount</dt>
              <dd className="font-medium text-gray-800">${promotion.discountAmount.toFixed(2)}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Starts</dt>
            <dd className="font-medium text-gray-800 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              {formatDate(promotion.schedule.startAt)}
            </dd>
          </div>
          {promotion.schedule.endAt && (
            <div>
              <dt className="text-gray-400 text-xs mb-0.5">Ends</dt>
              <dd className="font-medium text-gray-800 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                {formatDate(promotion.schedule.endAt)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Promotion ID</dt>
            <dd className="font-mono text-xs text-gray-500">{promotion.id}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Created</dt>
            <dd className="font-medium text-gray-800">{formatDate(promotion.createdAt)}</dd>
          </div>
        </dl>

        {promotion.applicableItemIds.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-400 mb-2">Applies to {promotion.applicableItemIds.length} item(s)</p>
            <div className="flex flex-wrap gap-1.5">
              {promotion.applicableItemIds.map((itemId) => (
                <span key={itemId} className="px-2 py-0.5 rounded bg-gray-50 border text-xs font-mono text-gray-600">
                  {itemId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PromotionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Promotion Detail">
      <PermissionGuard permission="promotions.view" fallback={<AccessDenied />}>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="pt-16">
            <PromotionDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
