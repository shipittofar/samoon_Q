'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Extra, ExtraGroup } from '@/types'

export function useProductDetailState(itemId: string | undefined, active: boolean) {
  const [quantity, setQuantity] = useState(1)
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([])
  const [notes, setNotes] = useState('')
  const [showNutrition, setShowNutrition] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [addedToCart, setAddedToCart] = useState(false)
  const [extrasError, setExtrasError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setQuantity(1)
    setSelectedExtras([])
    setNotes('')
    setShowNutrition(false)
    setShowInstructions(false)
    setShowReviews(false)
    setReviewRating(5)
    setReviewComment('')
    setAddedToCart(false)
    setExtrasError(null)
  }, [])

  useEffect(() => {
    if (!itemId || !active) return
    reset()
  }, [itemId, active, reset])

  const toggleExtra = useCallback((extra: Extra, group?: ExtraGroup) => {
    setExtrasError(null)
    setSelectedExtras((prev) => {
      const isSelected = prev.some((e) => e.id === extra.id)

      if (group?.selection_type === 'single') {
        if (isSelected) return prev.filter((e) => e.group_id !== group.id)
        return [...prev.filter((e) => e.group_id !== group.id), extra]
      }

      if (group && group.max_selection > 0) {
        const inGroupCount = prev.filter((e) => e.group_id === group.id).length
        if (!isSelected && inGroupCount >= group.max_selection) return prev
      }

      if (isSelected) return prev.filter((e) => e.id !== extra.id)
      return [...prev, extra]
    })
  }, [])

  return {
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
    reviewRating,
    setReviewRating,
    reviewComment,
    setReviewComment,
    addedToCart,
    setAddedToCart,
    extrasError,
    setExtrasError,
    reset,
  }
}
