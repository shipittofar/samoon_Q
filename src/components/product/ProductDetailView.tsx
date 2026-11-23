'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Star, Clock, Flame, AlertTriangle } from 'lucide-react'
import { useBranchStore, useTenantStore } from '@/stores'
import { useAddToCart } from '@/hooks/useAddToCart'
import {
  useFavoriteAction,
  useRelatedItems,
  useItemReviews,
  useActiveBranchId,
  useExtraGroups,
  useMenuExtras,
} from '@/hooks'
import { Textarea } from '@/components/ui/Input'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { Badge, RatingStars } from '@/components/ui'
import { MenuTagBadge } from '@/components/menu/MenuTagBadge'
import { RatingBreakdown } from '@/components/reviews/RatingBreakdown'
import { ProductDetailMedia } from '@/components/product/ProductDetailMedia'
import { ProductDetailModifiers, validateExtraSelections } from '@/components/product/ProductDetailModifiers'
import { ProductPrice } from '@/components/product/ProductPrice'
import { RelatedProductsRail } from '@/components/product/RelatedProductsRail'
import { StickyPurchaseBar } from '@/components/product/StickyPurchaseBar'
import { useProductDetailState } from '@/components/product/useProductDetailState'
import { ProductDetailSectionTabs, type ProductDetailTab } from '@/components/product/ProductDetailSectionTabs'
import { buildRatingBreakdownFromReviews, getAssignedExtraGroups, formatNutritionValue } from '@/lib/product-detail-utils'
import { getDiscountedPrice } from '@/utils'
import { useMoney } from '@/hooks/use-money'
import { isBranchOrderingEnabled } from '@/lib/branch-checkout'
import { canOrderFromTenant } from '@/lib/tenant-state'
import { useTenantVertical } from '@/hooks/verticals'
import { ServiceItemFacts, useCatalogPriceLabel } from '@/components/menu/ServiceItemFacts'
import type { MenuItem } from '@/types'
import type { CartOwnershipInput } from '@/lib/active-cart'
import toast from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'

export interface ProductDetailViewProps {
  item: MenuItem
  active?: boolean
  branchId?: string
  onClose?: () => void
  onOpenRelated?: (item: MenuItem) => void
  orderingContext?: CartOwnershipInput
}

export function ProductDetailView({
  item,
  active = true,
  branchId,
  onClose,
  onOpenRelated,
  orderingContext,
}: ProductDetailViewProps) {
  const t = useTranslations('menu')
  const tCommon = useTranslations('common')
  const tNotifications = useTranslations('notifications')
  const locale = useLocale()
  const scrollRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)
  const [priorityImage, setPriorityImage] = useState(true)
  const [addingToCart, setAddingToCart] = useState(false)
  const [desktopTab, setDesktopTab] = useState<ProductDetailTab>('details')
  const [isLg, setIsLg] = useState(false)

  const { addToCart } = useAddToCart()
  const tenant = useTenantStore((s) => s.tenant)
  const branchCheckout = useBranchStore((s) => s.activeBranch?.checkout)
  // Phase 1 — service verticals (salon, clinic) have no cart in any context.
  const vertical = useTenantVertical()
  const priceLabel = useCatalogPriceLabel()
  const orderingEnabled = !vertical.supportsCart
    ? false
    : orderingContext
      ? true
      : canOrderFromTenant(tenant) && isBranchOrderingEnabled(branchCheckout)
  const { favorited, isPending, handleFavorite } = useFavoriteAction(item.id)
  const activeBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? activeBranchId

  const {
    quantity,
    setQuantity,
    selectedExtras,
    toggleExtra,
    notes,
    setNotes,
    showNutrition,
    setShowNutrition,
    showInstructions,
    setShowInstructions,
    showReviews,
    setShowReviews,
    addedToCart,
    setAddedToCart,
    extrasError,
    setExtrasError,
  } = useProductDetailState(item.id, active)

  const queryEnabled = active && !!scopedBranchId
  const { data: related, isLoading: relatedLoading } = useRelatedItems(scopedBranchId, item.id, { enabled: queryEnabled })
  const { data: reviewsData, isLoading: reviewsLoading } = useItemReviews(item.id, { enabled: active })
  const { data: extraGroups } = useExtraGroups(scopedBranchId, { enabled: queryEnabled })
  const { data: branchExtras } = useMenuExtras(scopedBranchId, { enabled: queryEnabled })

  const discountedPrice = item.discount ? getDiscountedPrice(item.price, item.discount) : item.price
  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0)
  const unitPrice = discountedPrice + extrasTotal
  const totalPrice = unitPrice * quantity
  const money = useMoney()
  // Shown in the visitor's currency, computed like the cart line will be.
  const totalMoney = money.cartLine({ menu_item: item, extras: selectedExtras, unit_price: unitPrice, quantity })
  const totalPriceLabel = money.formatIn(totalMoney.amount, totalMoney.currency)
  const assignedGroups = getAssignedExtraGroups(extraGroups, item.extra_group_ids)
  const ratingBreakdown = reviewsData?.results.length
    ? buildRatingBreakdownFromReviews(reviewsData.results)
    : null

  useEffect(() => {
    setPriorityImage(true)
    setDesktopTab('details')
    scrollRef.current?.scrollTo({ top: 0 })
    titleRef.current?.focus()
    if (liveRef.current) {
      liveRef.current.textContent = t('productChangedAnnouncement', { name: item.name })
    }
  }, [item.id, item.name, t])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsLg(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const handleAddToCart = useCallback(() => {
    if (!orderingEnabled) return
    const validation = validateExtraSelections(assignedGroups, selectedExtras)
    if (!validation.valid) {
      setExtrasError(t('selectGroupRequired', { group: validation.message ?? '' }))
      if (isLg) setDesktopTab('customize')
      return
    }
    setAddingToCart(true)
    const result = addToCart(
      { ...item, discounted_price: discountedPrice },
      quantity,
      selectedExtras,
      notes || undefined,
      orderingContext,
    )
    if (result.ok) {
      toast.success(tNotifications('itemAddedToCart', { item: item.name }), { icon: '🛒' })
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 2000)
    }
    setAddingToCart(false)
  }, [
    assignedGroups,
    selectedExtras,
    setExtrasError,
    t,
    isLg,
    addToCart,
    orderingContext,
    item,
    discountedPrice,
    quantity,
    notes,
    tNotifications,
    setAddedToCart,
    orderingEnabled,
  ])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!active || !item.available) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleAddToCart()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, item.available, handleAddToCart])

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: item.description, url })
      } catch {
        /* cancelled */
      }
    } else if (url) {
      await navigator.clipboard.writeText(url)
      toast.success(t('linkCopied'))
    }
  }

  const previewReviews = reviewsData?.results.slice(0, 2) ?? []
  const showDetailsTab = !isLg || desktopTab === 'details'
  const showCustomizeTab = !isLg || desktopTab === 'customize'
  const showReviewsTab = !isLg || desktopTab === 'reviews'

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div ref={liveRef} className="sr-only"aria-live="polite"aria-atomic="true"/>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <ProductDetailMedia
            item={item}
            favorited={favorited}
            favoritePending={isPending}
            onFavorite={handleFavorite}
            onClose={onClose}
            favoriteLabel={t('addToFavorites')}
            unfavoriteLabel={t('removeFromFavorites')}
            closeLabel={tCommon('close')}
            newLabel={t('new')}
            popularLabel={t('popular')}
            discountLabel={(percent) => t('discount', { percent })}
            priority={priorityImage}
            showClose
            onShare={handleShare}
            shareLabel={t('shareProduct')}
          />

          <div className="flex-1 p-6 lg:p-8 space-y-8 min-w-0">
            <header className="space-y-4">
              <h1
                ref={titleRef}
                id="product-detail-title"
                tabIndex={-1}
                className="text-3xl font-[var(--font-display)] font-bold text-[var(--fg)] tracking-tight outline-none"
              >
                {item.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--fg-muted)]">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-[var(--rating)] fill-[var(--rating)]"aria-hidden="true"/>
                  <strong className="text-[var(--fg)]">{item.rating}</strong>
                  <span>{t('reviewCount', { count: item.rating_count })}</span>
                </span>
                {vertical.usesFoodFields ? (
                  <>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5"aria-hidden="true"/>
                      {t('prepTime', { min: item.preparation_time })}
                    </span>
                    {item.calories != null && (
                      <span className="flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5"aria-hidden="true"/>
                        {t('calories', { count: item.calories })}
                      </span>
                    )}
                  </>
                ) : (
                  <ServiceItemFacts item={item} />
                )}
              </div>

              <ProductPrice
                price={item.price}
                discountedPrice={discountedPrice}
                discountPercent={item.discount}
                totalPrice={totalPrice}
                showTotal={quantity > 1 || selectedExtras.length > 0}
                totalLabel={t('totalLabel', { price: totalPriceLabel })}
                labels={{ price: money.formatItem(item), discounted: money.formatItem(item, { discounted: true }) }}
                formatPrice={(formatted) => priceLabel(item, formatted)}
              />

              {!item.available && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3 text-sm text-[var(--warning-text)]"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0"aria-hidden="true"/>
                  {t('unavailable')}
                </div>
              )}

              <p className="text-[var(--fg-muted)] text-sm leading-relaxed">{item.description}</p>

              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <MenuTagBadge key={tag.id} tag={tag} className="capitalize"/>
                  ))}
                </div>
              )}

              {item.allergens && item.allergens.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[var(--fg-muted)] flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--rating)]"aria-hidden="true"/>
                    {t('containsAllergens')}
                  </span>
                  {item.allergens.map((allergen) => (
                    <Badge key={allergen} variant="warning"className="text-[10px] capitalize">
                      {allergen}
                    </Badge>
                  ))}
                </div>
              )}
            </header>

            <div className="hidden lg:block">
              <ProductDetailSectionTabs
                active={desktopTab}
                onChange={setDesktopTab}
                detailsLabel={t('tabDetails')}
                customizeLabel={t('tabCustomize')}
                reviewsLabel={t('tabReviews')}
              />
            </div>

            {showDetailsTab && (
              <div className="space-y-6"role="tabpanel">
                {item.nutritional_info && (
                  <CollapsibleSection
                    title={t('nutritionalInfo')}
                    open={showNutrition}
                    onToggle={() => setShowNutrition((v) => !v)}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(item.nutritional_info).map(([key, val]) => (
                        <div key={key} className="bg-[var(--card-hover)] rounded-xl p-3 text-center">
                          <p className="text-xs text-[var(--fg-muted)] capitalize">{key}</p>
                          <p className="text-sm font-semibold text-[var(--fg)]">
                            {formatNutritionValue(key, val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            )}

            {showCustomizeTab && (
              <div className="space-y-6"role="tabpanel">
                <ProductDetailModifiers
                  item={item}
                  groups={extraGroups}
                  branchExtras={branchExtras}
                  selectedExtras={selectedExtras}
                  onToggleExtra={toggleExtra}
                  addExtrasLabel={t('addExtras')}
                  requiredLabel={t('required')}
                  chooseUpToLabel={(name, max) => t('chooseUpTo', { name, max })}
                  validationError={extrasError}
                />

                <CollapsibleSection
                  title={t('specialRequests')}
                  open={showInstructions}
                  onToggle={() => setShowInstructions((v) => !v)}
                >
                  <Textarea
                    placeholder={t('specialRequestsPlaceholder')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </CollapsibleSection>
              </div>
            )}

            {showReviewsTab && (
              <section aria-labelledby="reviews-heading"className="space-y-4"role="tabpanel">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-[var(--rating)] fill-[var(--rating)]"aria-hidden="true"/>
                  <h2 id="reviews-heading"className="text-base font-semibold text-[var(--fg)]">
                    {t('reviews')}
                  </h2>
                  {reviewsData && (
                    <span className="text-sm text-[var(--fg-muted)]">
                      · {reviewsData.average_rating.toFixed(1)} ({reviewsData.count})
                    </span>
                  )}
                </div>

                {ratingBreakdown && ratingBreakdown.total > 0 && (
                  <RatingBreakdown breakdown={ratingBreakdown} className="max-w-sm"/>
                )}

                {reviewsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-16 rounded-xl bg-[var(--card-hover)] animate-pulse"/>
                    ))}
                  </div>
                ) : previewReviews.length > 0 ? (
                  <div className="space-y-3">
                    {previewReviews.map((review) => (
                      <div key={review.id} className="rounded-xl bg-[var(--card-hover)] p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-[var(--fg)]">
                            {review.user.first_name} {review.user.last_name}
                          </span>
                          <RatingStars rating={review.rating} size="sm"/>
                          <span className="text-[10px] text-[var(--fg-muted)] ms-auto">
                            {new Date(review.created_at).toLocaleDateString(locale)}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--fg-muted)]">{t('noReviewsYet')}</p>
                )}

                {(reviewsData?.results.length ?? 0) > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowReviews((v) => !v)}
                    aria-expanded={showReviews}
                    className="text-sm font-medium text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
                  >
                    {showReviews ? t('showFewerReviews') : t('seeAllReviews')}
                  </button>
                )}

                {showReviews && reviewsData && reviewsData.results.length > 2 && (
                  <div className="space-y-3">
                    {reviewsData.results.slice(2).map((review) => (
                      <div key={review.id} className="rounded-xl bg-[var(--card-hover)] p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-[var(--fg)]">
                            {review.user.first_name} {review.user.last_name}
                          </span>
                          <RatingStars rating={review.rating} size="sm"/>
                          <span className="text-[10px] text-[var(--fg-muted)] ms-auto">
                            {new Date(review.created_at).toLocaleDateString(locale)}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-[var(--fg-muted)]">{t('reviewAfterOrder')}</p>
              </section>
            )}
          </div>
        </div>

        <RelatedProductsRail
          items={related}
          loading={relatedLoading}
          title={t('related')}
          onOpenDetail={onOpenRelated}
        />
      </div>

      {orderingEnabled && (
      <StickyPurchaseBar
        quantity={quantity}
        onQuantityChange={setQuantity}
        onAddToCart={handleAddToCart}
        available={item.available}
        loading={addingToCart}
        added={addedToCart}
        ctaLabel={t('addToCartWithPrice', { price: totalPriceLabel })}
        unavailableLabel={t('unavailable')}
        addedLabel={t('added')}
        decreaseLabel={t('decreaseQuantity')}
        increaseLabel={t('increaseQuantity')}
      />
      )}
    </div>
  )
}
