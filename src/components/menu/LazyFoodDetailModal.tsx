'use client'

/**
 * LazyFoodDetailModal — Phase 4.7 (P4.7.2 / P4.7.3)
 *
 * Splits the heavy FoodDetailModal (motion + relatedItems query +
 * extras logic) into its own dynamic chunk so it is NOT included in the
 * menu page's initial JS bundle.
 *
 * The modal is only mounted when the user opens it, by which time the chunk
 * has already loaded asynchronously — zero perceptible latency.
 *
 * Animations, UX, and API contracts are completely unchanged.
 * ssr: false is intentional — the modal is interactive-only and cannot
 * render meaningfully on the server.
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { FoodDetailModal as FoodDetailModalType } from './FoodDetailModal'

export const LazyFoodDetailModal = dynamic(
  () => import('./FoodDetailModal').then((m) => ({ default: m.FoodDetailModal })),
  { ssr: false, loading: () => null },
) as React.ComponentType<ComponentProps<typeof FoodDetailModalType>>
