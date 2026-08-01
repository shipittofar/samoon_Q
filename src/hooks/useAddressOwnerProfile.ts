'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores'
import { authService, type GetMeResponse } from '@/services/auth.service'
import {
  assertAddressOwnerProfile,
  type AddressOwnerProfile,
} from '@/lib/address-profile'
import type { User } from '@/types'

/**
 * Resolves the authenticated user's identity fields for address API writes.
 * Uses useAuthStore first; falls back to React Query `['me']` cache, then
 * a single getMe() fetch only when the cache is empty.
 */
export function useAddressOwnerProfile() {
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const resolveUser = useCallback(async (): Promise<User | null> => {
    if (authUser?.first_name?.trim() && authUser?.last_name?.trim() && authUser.phone_number) {
      return authUser
    }

    const cached = queryClient.getQueryData<GetMeResponse>(['me'])
    if (cached?.user) {
      if (!authUser || cached.user.id === authUser.id) {
        setUser(cached.user)
      }
      return cached.user
    }

    if (!authUser) return null

    const fresh = await authService.getMe()
    queryClient.setQueryData(['me'], fresh)
    setUser(fresh.user)
    return fresh.user
  }, [authUser, queryClient, setUser])

  const requireProfile = useCallback(async (): Promise<AddressOwnerProfile> => {
    const user = await resolveUser()
    return assertAddressOwnerProfile(user)
  }, [resolveUser])

  return { authUser, requireProfile }
}
